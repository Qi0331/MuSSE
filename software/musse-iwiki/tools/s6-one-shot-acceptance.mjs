/**
 * 小七 S6 one-command acceptance for exactly two isolated test documents.
 *
 * Automatic, read-only stages: real goal discovery, task table validation,
 * prepare/cancel for goal_update, goal_create and goal_record_progress.
 *
 * Optional, EXPLICITLY approved live stages:
 *   1) append a marker to G-999's existing description (edit_doc);
 *   2) create isolated G-998 (create_markdown_doc);
 *   3) append one 0%-when-unlinked progress record to G-998 (edit_doc).
 *
 * One separate terminal confirmation AFTER preview per live stage.
 * No delete, no retry, no S5 reconfiguration, no unauthorised write.
 * On unknown remote outcome STOP: never automatically re-run the script.
 */
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { readonlyDocumentIdsFromFile } from "../src/mcp/document-ids.ts";
import { DOC_PATHS } from "../src/store/wiki-store.ts";
import { parseTaskTable } from "../src/markdown/tasks.ts";
import { createS6GoalFlow } from "../src/goals/s6-goal-flow.ts";
import { scanGoals, validateScope } from "../src/goals/s6-goal-discovery.ts";
import { createOfficialS6GoalPort } from "../src/goals/s6-official-port.ts";

const ORIGINAL_ID = "G-999";
const CREATED_ID = "G-998";
const MARKER = " [小七 S6 一次性验收]";
const PROGRESS_NOTE = "小七 S6 受控进度写入验收（隔离测试）";

function check(value, code) {
  if (!value) throw Error(code);
}

function readOnlyFacade(port) {
  return {
    listDirectChildren: port.listDirectChildren,
    readDoc: port.readDoc,
    readTaskTable: port.readTaskTable,
    async createDoc() { throw Error("S6_READONLY_WRITE_FORBIDDEN"); },
    async editDoc() { throw Error("S6_READONLY_WRITE_FORBIDDEN"); },
  };
}

/**
 * Pure workflow orchestrator, injectable for offline regression tests.
 * No write is even attempted unless the local user types the EXACT per-stage
 * confirmation string after seeing that stage's preview.
 */
export async function runS6OneShot(port, scope, options) {
  validateScope(scope);
  check(scope.mode === "space", "S6_SCOPE_MODE_INVALID");
  const { ask, beforeFirstWrite, report = () => {} } = options;
  check(typeof ask === "function" && typeof beforeFirstWrite === "function", "S6_NO_CONSENT_CHANNEL");

  const readPort = readOnlyFacade(port);
  const initial = await scanGoals(readPort, scope);
  check(initial.has(ORIGINAL_ID), "S6_G999_MISSING");
  check(!initial.has(CREATED_ID), "S6_G998_ALREADY_EXISTS");
  check(initial.size === 1, "S6_OTHER_GOALS_PRESENT"); // only the previously approved isolated page
  const current = initial.get(ORIGINAL_ID);
  const oldDescription = current.goal.description;
  check(!oldDescription.includes(MARKER.trim()), "S6_ALREADY_WRITTEN");
  check(oldDescription.length + MARKER.length <= 1000, "S6_DESCRIPTION_TOO_LONG");
  const taskTable = await readPort.readTaskTable();
  const tasks = parseTaskTable(taskTable);
  const update = {
    type: "goal_update", goalId: ORIGINAL_ID,
    changes: { description: oldDescription + MARKER },
  };
  const create = {
    type: "goal_create", goalId: CREATED_ID,
    title: "小七 S6 自动创建验收",
    description: "隔离测试文档，完成验收后由用户自行决定保留或清理",
    phases: [{ id: "P1", name: "功能验证" }],
  };
  const progressPreview = {
    type: "goal_record_progress", goalId: ORIGINAL_ID,
    note: PROGRESS_NOTE,
  };
  const dryFlow = createS6GoalFlow(readPort, scope, { ttlMs: 600_000 });
  for (const [key, intent] of [
    ["goal_update", update], ["goal_create", create],
    ["goal_record_progress", progressPreview],
  ]) {
    const prepared = await dryFlow.prepare(intent);
    check(prepared.status === "AWAITING_APPROVAL", "S6_DRY_PREVIEW_FAILED");
    check(dryFlow.cancel(prepared.operationId).canceled &&
      dryFlow.status(prepared.operationId) === "CANCELED", "S6_DRY_CANCEL_FAILED");
    report({ type: "dry_pass", action: key });
  }

  const audit = {
    inspection: "S6_ONE_SHOT_ACCEPTANCE",
    initialGoals: initial.size,
    taskTableVerified: true,
    taskCount: tasks.length,
    previewCancelActions: 3,
    writesAttempted: 0,
    verifiedWrites: 0,
    stage: "consent_pending",
  };
  report({ type: "preflight_pass", audit: { ...audit } });

  const writeFlow = createS6GoalFlow(port, scope, { ttlMs: 600_000 });
  const stages = [
    {
      label: "修改 G-999 的说明（保留原说明并添加验收标记）",
      confirmPhrase: "确认修改 G-999",
      intent: update,
    },
    {
      label: "新建隔离目标 G-998（创建后保留，不自动删除）",
      confirmPhrase: "确认创建 G-998",
      intent: create,
    },
    {
      label: "向 G-998 追加一条进度历史（不修改任务总表）",
      confirmPhrase: "确认记录 G-998",
      intent: { type: "goal_record_progress", goalId: CREATED_ID, note: PROGRESS_NOTE },
    },
  ];

  for (let i = 0; i < stages.length; i++) {
    const item = stages[i];
    audit.stage = "stage_" + (i + 1) + "_preview";
    const prepared = await writeFlow.prepare(item.intent);
    check(prepared.status === "AWAITING_APPROVAL", "S6_LIVE_PREVIEW_FAILED");
    report({ type: "consent_request", step: i + 1, total: stages.length,
      label: item.label, confirmPhrase: item.confirmPhrase });
    const answer = await ask(item.confirmPhrase);
    if (answer.trim() !== item.confirmPhrase) {
      writeFlow.cancel(prepared.operationId);
      audit.stage = "CANCELED_AT_" + (i + 1);
      report({ type: "declined", step: i + 1 });
      return { ...audit, finalStatus: audit.writesAttempted === 0 ?
        "CANCELED_NO_WRITES" : "PARTIAL_VERIFIED_STOP" };
    }
    // Backup original page before FIRST remote modification. Exclusive local
    // file creation, NEVER overwrite existing config or real iWiki data.
    if (i === 0) await beforeFirstWrite(current.content);
    audit.stage = "stage_" + (i + 1) + "_confirm";
    audit.writesAttempted++;
    const done = await writeFlow.confirm(prepared.operationId, "确认写入");
    check(done.status === "VERIFIED", "S6_REMOTE_NOT_VERIFIED");
    audit.verifiedWrites++;
    report({ type: "verified", step: i + 1 });
  }
  audit.stage = "verified";
  const finalGoals = await scanGoals(readPort, scope);
  check(finalGoals.has(ORIGINAL_ID) && finalGoals.has(CREATED_ID) &&
    finalGoals.size === 2, "S6_FINAL_GOALS_UNVERIFIED");
  check(finalGoals.get(ORIGINAL_ID).goal.description.endsWith(MARKER),
    "S6_FINAL_UPDATE_UNVERIFIED");
  check(finalGoals.get(CREATED_ID).goal.history.some((entry) =>
    entry.note === PROGRESS_NOTE), "S6_FINAL_PROGRESS_UNVERIFIED");

  return { ...audit, finalGoalCount: finalGoals.size,
    editVerified: true, createVerified: true, progressVerified: true,
    finalStatus: "VERIFIED" };
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--once") {
    process.stdout.write("Usage: npm run accept:s6 -- --once\n" +
      "One interactive run: 3 read-only preview/cancel tests, then at most 3 separately approved\n" +
      "writes affecting ONLY G-999 and new isolated G-998. Type anything else to cancel.\n");
    return;
  }
  if (!process.stdin.isTTY) {
    process.stderr.write("S6_INTERACTIVE_TTY_REQUIRED: no writes attempted.\n");
    process.exitCode = 1;
    return;
  }
  let stage = "initialization";
  let attempted = 0;
  let verified = 0;
  let backupMade = false;
  let rl;
  try {
    const privateDir = join(homedir(), "MuSSE-MCP-Local", "musse-bridge");
    const scope = JSON.parse(await readFile(
      join(privateDir, "musse-iwiki-s6-scope.json"), "utf8"));
    validateScope(scope);
    check(scope.mode === "space", "S6_SCOPE_MODE_INVALID");
    const ids = await readonlyDocumentIdsFromFile(
      join(privateDir, "musse-iwiki-readonly.json"));
    const connection = extractConnection(JSON.parse(await readFile(
      join(privateDir, "xiaozhi.config.json"), "utf8")));
    const client = new IwikiMcpClient(connection);
    const basePort = createOfficialS6GoalPort(client, ids[DOC_PATHS.tasks]);
    const port = {
      ...basePort,
      async createDoc(...args) { attempted++; return basePort.createDoc(...args); },
      async editDoc(...args) { attempted++; return basePort.editDoc(...args); },
    };

    rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = async (phrase) => (await rl.question(
      "输入「" + phrase + "」执行此项真实 iWiki 写入；输入 0 或其他内容停止：\n> ")).trim();
    process.stdout.write("小七 S6 一次性验收：自动只读预检，然后逐项确认隔离测试写入。\n" +
      "不删除任何文档，不改任务表，不更改原 S5 配置。写入不确定时立即停止且不重试。\n");
    const outcome = await runS6OneShot(port, scope, {
      ask: answer,
      async beforeFirstWrite(content) {
        const name = "s6-g999-backup-" + Date.now() + "-" + randomUUID().slice(0, 8) + ".md";
        await writeFile(join(privateDir, name), content, { flag: "wx", mode: 0o600 });
        backupMade = true;
        process.stdout.write("G-999 原文已独立备份在 Windows 私有目录，未改原配置。\n");
      },
      report(event) {
        if (event.type === "dry_pass") {
          process.stdout.write("只读预览/取消：" + event.action + " 通过。\n");
        } else if (event.type === "preflight_pass") {
          process.stdout.write("作用域与任务表验证通过，任务数 " +
            event.audit.taskCount + "；准备进入逐项授权。\n");
        } else if (event.type === "consent_request") {
          stage = "stage_" + event.step;
          process.stdout.write("\n[" + event.step + "/" + event.total + "] " +
            event.label + "\n");
        } else if (event.type === "verified") {
          verified++;
          process.stdout.write("第 " + event.step + " 项已远端写入并严格读回确认。\n");
        }
      },
    });
    process.stdout.write(JSON.stringify({
      ...outcome, remoteWriteCallsStarted: attempted,
      remoteWritesReadbackVerified: verified, localBackupSaved: backupMade,
    }, null, 2) + "\n");
  } catch (error) {
    const code = typeof error?.code === "string" && /^S6_[A-Z0-9_]+$/.test(error.code)
      ? error.code : "S6_ACCEPTANCE_STOPPED";
    process.stderr.write(JSON.stringify({
      inspection: "S6_ONE_SHOT_ACCEPTANCE",
      status: "STOPPED",
      stage,
      code,
      remoteWriteCallsStarted: attempted,
      remoteWritesReadbackVerified: verified,
      localBackupSaved: backupMade,
      warning: "Do not rerun automatically: verify G-999/G-998 in the iWiki UI if any write was started. Never paste private config or raw errors.",
    }, null, 2) + "\n");
    process.exitCode = 1;
  } finally {
    rl?.close();
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
