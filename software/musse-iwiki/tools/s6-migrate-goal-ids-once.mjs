/**
 * One-time, bounded G-998/G-999 -> G998/G999 migration.
 * Does NOT touch S4/S5 config, create/delete pages, or log private IDs/text/tokens.
 * Run with the xiaozhi bridge stopped while migrating. Never auto-retry a write.
 * --plan: read-only preflight; --apply: direct rename tool when verified;
 * --manual-title --apply: finish after the user manually renamed BOTH titles;
 * --verify: read-only postflight.
 */
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";
import { readonlyDocumentIdsFromFile } from "../src/mcp/document-ids.ts";
import { DOC_PATHS } from "../src/store/wiki-store.ts";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { parseGoal } from "../src/markdown/goals.ts";
import { parseTaskTable, updateTaskRow } from "../src/markdown/tasks.ts";
import { scanGoals, validateScope } from "../src/goals/s6-goal-discovery.ts";
import { createOfficialS6GoalPort } from "../src/goals/s6-official-port.ts";

export const CHANGES = Object.freeze([["G-998", "G998"], ["G-999", "G999"]]);
const LEGACY_ID = /^G-[0-9]{3,6}$/;
const CURRENT_ID = /^G[0-9]{3,6}$/;
const stop = (code) => { throw Error(code); };
const equal = (a, b) => a === b;
const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

/** Validate the complete pinned-space listing and BOTH exact old documents. */
export async function buildS6IdMigrationPlan(port, scope, { manualTitles = false } = {}) {
  validateScope(scope);
  if (scope.mode !== "space") stop("S6_MIGRATION_SCOPE_UNSUPPORTED");
  const list = await port.listDirectChildren(scope);
  if (!list?.complete || !Array.isArray(list.entries) || list.entries.length > 100)
    stop("S6_MIGRATION_LIST_UNVERIFIED");
  const byTitle = new Map();
  const seenIds = new Set();
  for (const entry of list.entries) {
    if (!entry || byTitle.has(entry.title) || seenIds.has(entry.docId))
      stop("S6_MIGRATION_DUPLICATE_DOCUMENT");
    byTitle.set(entry.title, entry);
    seenIds.add(entry.docId);
    if (!CURRENT_ID.test(entry.title) && !CHANGES.some(([oldId, newId]) =>
      entry.title === (manualTitles ? newId : oldId)))
      stop("S6_MIGRATION_UNEXPECTED_LEGACY_TITLE");
  }
  const docs = [];
  for (const [oldId, newId] of CHANGES) {
    const expectedTitle = manualTitles ? newId : oldId;
    if (byTitle.has(manualTitles ? oldId : newId)) stop("S6_MIGRATION_TARGET_COLLISION");
    const entry = byTitle.get(expectedTitle);
    if (!entry) stop("S6_MIGRATION_TARGET_NOT_FOUND");
    const before = await port.readDoc(entry.docId);
    const parsed = parseGoal(before);
    if (parsed.id !== oldId || !before.includes("- 目标ID: " + oldId))
      stop("S6_MIGRATION_BODY_ID_MISMATCH");
    const lines = before.split(/\r?\n/);
    const matches = lines.filter((line) =>
      new RegExp("^-[ \\t]*目标ID[:：][ \\t]*" + oldId + "[ \\t]*$").test(line));
    if (matches.length !== 1) stop("S6_MIGRATION_ID_LINE_NOT_UNIQUE");
    const after = before.replace(
      new RegExp("(^-[ \\t]*目标ID[:：][ \\t]*)" + oldId + "(?=[ \\t]*$)", "m"),
      "$1" + newId);
    if (parseGoal(after).id !== newId || equal(after, before))
      stop("S6_MIGRATION_INVALID_REWRITE");
    docs.push({ oldId, newId, docId: entry.docId, before, after });
  }
  // Every OTHER page must already be a valid modern goal, including its body.
  for (const entry of list.entries) {
    if (docs.some((d) => d.docId === entry.docId)) continue;
    const body = await port.readDoc(entry.docId);
    if (parseGoal(body).id !== entry.title || !CURRENT_ID.test(entry.title))
      stop("S6_MIGRATION_OTHER_PAGE_INVALID");
  }
  const taskBefore = await port.readTaskTable();
  const tasks = parseTaskTable(taskBefore);
  if (tasks.some((t) => LEGACY_ID.test(t.goalId) && !CHANGES.some(([oldId]) => oldId === t.goalId)))
    stop("S6_MIGRATION_UNSUPPORTED_TASK_REFERENCE");
  let taskAfter = taskBefore;
  let changedTasks = 0;
  for (const task of tasks) {
    const conversion = CHANGES.find(([oldId]) => oldId === task.goalId);
    if (!conversion) continue;
    taskAfter = updateTaskRow(taskAfter, task.id, { goalId: conversion[1] });
    changedTasks++;
  }
  const updated = parseTaskTable(taskAfter);
  if (updated.length !== tasks.length || updated.some((t, i) =>
    t.id !== tasks[i].id || t.goalId !== (CHANGES.find(([oldId]) => oldId === tasks[i].goalId)?.[1] ?? tasks[i].goalId)))
    stop("S6_MIGRATION_TASK_REWRITE_INVALID");
  return { docs, taskBefore, taskAfter, changedTasks, taskCount: tasks.length,
    docCount: list.entries.length };
}

/** Fail before writes unless a dedicated rename tool exposes a verified schema. */
export function selectS6RenameTool(tools) {
  if (!Array.isArray(tools)) return null;
  const allowed = ["rename_doc", "rename_document", "update_doc_title", "rename_markdown_doc"];
  for (const name of allowed) {
    const tool = tools.find((item) => item?.name === name);
    const schema = tool?.inputSchema;
    if (!isObject(schema) || !isObject(schema.properties) || !isObject(schema.properties.doc_id) ||
        schema.properties.doc_id.type !== "string") continue;
    const titleKey = ["new_title", "title"].find((key) =>
      isObject(schema.properties[key]) && schema.properties[key].type === "string");
    if (!titleKey || (Array.isArray(schema.required) &&
        schema.required.some((key) => key !== "doc_id" && key !== titleKey))) continue;
    return { name, titleKey };
  }
  return null;
}

function remoteConfirmed(response) {
  if (!isObject(response) || response.isError === true) return false;
  const rows = [];
  if (isObject(response.structuredContent)) rows.push(response.structuredContent);
  if (Array.isArray(response.content)) for (const row of response.content) {
    if (typeof row?.text !== "string") continue;
    try { const item = JSON.parse(row.text); if (isObject(item)) rows.push(item); }
    catch { /* no raw server output */ }
  }
  return rows.length > 0 && rows.every((r) => r.ok !== false && r.success !== false);
}

async function readExactTitle(port, scope, docId) {
  const list = await port.listDirectChildren(scope);
  const hits = list.entries.filter((item) => item.docId === docId);
  if (hits.length !== 1) stop("S6_MIGRATION_TITLE_READBACK_MISMATCH");
  return hits[0].title;
}

async function loadConnection() {
  const dir = join(homedir(), "MuSSE-MCP-Local", "musse-bridge");
  const config = JSON.parse(await readFile(join(dir, "xiaozhi.config.json"), "utf8"));
  const scope = JSON.parse(await readFile(join(dir, "musse-iwiki-s6-scope.json"), "utf8"));
  const ids = await readonlyDocumentIdsFromFile(join(dir, "musse-iwiki-readonly.json"));
  validateScope(scope);
  const client = new IwikiMcpClient(extractConnection(config));
  const port = createOfficialS6GoalPort(client, ids[DOC_PATHS.tasks]);
  return { dir, scope, port, client, taskId: ids[DOC_PATHS.tasks] };
}

async function saveBackup(dir, plan) {
  const name = "s6-goal-id-backup-" + Date.now() + "-" + randomUUID().slice(0, 8) + ".json";
  const path = join(dir, name);
  const snapshot = JSON.stringify({ kind: "S6_ID_MIGRATION_PREWRITE_BACKUP",
    docs: plan.docs.map((x) => ({ oldId: x.oldId, newId: x.newId,
      docId: x.docId, title: x.oldId, content: x.before })),
    taskContent: plan.taskBefore }, null, 2);
  await writeFile(path, snapshot, { flag: "wx", mode: 0o600 });
  if ((await readFile(path, "utf8")) !== snapshot) stop("S6_MIGRATION_BACKUP_FAILED");
  return name;
}

async function applyMigration(context, plan, renameTool, manualTitles) {
  let writes = 0;
  const { client, port, scope } = context;
  for (const doc of plan.docs) {
    if (!manualTitles) {
      // Exactly one remote rename attempt per target; never retry unknown results.
      writes++;
      const response = await client.callTool(renameTool.name, {
        doc_id: doc.docId, [renameTool.titleKey]: doc.newId,
      });
      const title = await readExactTitle(port, scope, doc.docId);
      if (title !== doc.newId || !remoteConfirmed(response))
        stop("S6_MIGRATION_RENAME_UNCERTAIN");
    }
    if (await port.readDoc(doc.docId) !== doc.before)
      stop("S6_MIGRATION_PREWRITE_CONFLICT");
    writes++;
    await port.editDoc(doc.docId, doc.after);
    if (await port.readDoc(doc.docId) !== doc.after ||
        await readExactTitle(port, scope, doc.docId) !== doc.newId)
      stop("S6_MIGRATION_BODY_READBACK_UNCERTAIN");
  }
  if (plan.changedTasks > 0) {
    if (await port.readTaskTable() !== plan.taskBefore)
      stop("S6_MIGRATION_TASK_PREWRITE_CONFLICT");
    writes++;
    await port.editDoc(context.taskId, plan.taskAfter);
    if (await port.readTaskTable() !== plan.taskAfter)
      stop("S6_MIGRATION_TASK_READBACK_UNCERTAIN");
  }
  const goals = await scanGoals(port, scope);
  for (const doc of plan.docs) {
    const found = goals.get(doc.newId);
    if (!found || found.entry.docId !== doc.docId || found.content !== doc.after)
      stop("S6_MIGRATION_FINAL_GOAL_MISMATCH");
  }
  if (parseTaskTable(await port.readTaskTable()).some((t) =>
      CHANGES.some(([oldId]) => t.goalId === oldId)))
    stop("S6_MIGRATION_FINAL_TASK_MISMATCH");
  return { status: "VERIFIED", migratedGoals: plan.docs.length,
    changedTasks: plan.changedTasks, goalCount: goals.size, writesStarted: writes };
}

async function verifyMigration(port, scope) {
  const goals = await scanGoals(port, scope);
  if (CHANGES.some(([oldId,newId]) => goals.has(oldId) || !goals.has(newId)))
    stop("S6_MIGRATION_FINAL_GOAL_MISMATCH");
  const tasks = parseTaskTable(await port.readTaskTable());
  if (tasks.some((t) => LEGACY_ID.test(t.goalId)))
    stop("S6_MIGRATION_FINAL_TASK_MISMATCH");
  return { status: "VERIFIED", goalCount: goals.size, taskCount: tasks.length, writesStarted: 0 };
}

async function main(args) {
  const mode = args.includes("--verify") ? "verify" : args.includes("--apply") ? "apply" :
    args.includes("--plan") ? "plan" : null;
  const manualTitles = args.includes("--manual-title");
  if (!mode || args.some((a) => !["--plan","--apply","--verify","--manual-title"].includes(a)) ||
      (args.filter((a) => a === "--apply" || a === "--plan" || a === "--verify").length !== 1) ||
      (manualTitles && mode === "verify")) {
    process.stderr.write("Usage: node tools/s6-migrate-goal-ids-once.mjs --plan | --apply | --manual-title --apply | --verify\n");
    process.exitCode = 2;
    return;
  }
  let writesStarted = 0;
  let backupName = null;
  try {
    const context = await loadConnection();
    if (mode === "verify") {
      process.stdout.write(JSON.stringify(await verifyMigration(context.port, context.scope)) + "\n");
      return;
    }
    const plan = await buildS6IdMigrationPlan(context.port, context.scope, { manualTitles });
    const renameTool = manualTitles ? null : selectS6RenameTool(await context.client.listTools());
    if (mode === "plan") {
      process.stdout.write(JSON.stringify({ mode: "READ_ONLY_PLAN", goals: plan.docs.length,
        taskCount: plan.taskCount, taskReferencesToChange: plan.changedTasks,
        renameToolVerified: Boolean(renameTool), manualTitleOption: !renameTool,
        writesStarted: 0 }) + "\n");
      return;
    }
    if (!manualTitles && !renameTool) stop("S6_MIGRATION_RENAME_TOOL_UNAVAILABLE");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try { answer = await rl.question("已核验两篇目标，将备份并迁移，输入『确认迁移 G998 G999』才执行：\n> "); }
    finally { rl.close(); }
    if (answer.trim() !== "确认迁移 G998 G999")
      stop("S6_MIGRATION_CANCELED");
    backupName = await saveBackup(context.dir, plan);
    // Once apply begins, all ambiguous outcomes block automatic retries.
    const outcome = await applyMigration(context, plan, renameTool, manualTitles);
    writesStarted = outcome.writesStarted;
    process.stdout.write(JSON.stringify({ ...outcome, privateBackupSaved: true,
      backupFile: backupName }) + "\n");
  } catch (error) {
    const code = /^S6_[A-Z0-9_]+$/.test(error?.message ?? "") ?
      error.message : "S6_MIGRATION_STOPPED_CHECK_LOCAL_BACKUP_AND_REMOTE_STATE";
    process.stderr.write(JSON.stringify({ status: "STOPPED_DO_NOT_RETRY",
      code, backupFile: backupName, privateBackupSaved: Boolean(backupName),
      warning: "After any remote write starts, inspect actual iWiki pages before any further action. Never paste backup or private IDs." }) + "\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main(process.argv.slice(2));
