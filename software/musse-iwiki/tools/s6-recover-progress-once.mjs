/**
 * S6 targeted recovery for the G-998 progress write that was NOT OBSERVED
 * after an earlier ambiguous edit. This is NOT a retry of the full S6 suite.
 *
 * Phase 1: read-only preflight; validates the pinned space, G-999/G-998,
 *          authoritative task table, and absence of the precise progress row.
 * Phase 2: explicit new per-operation terminal approval, THEN at most
 *          ONE edit_doc against the verified G-998 page ID.
 * Phase 3: always perform one read-only reconciliation (even if ACK fails).
 *
 * No remote create/delete; never write G-999 or task table. All errors and
 * output are sanitized; no raw private ID/markdown/token/endpoint exposed.
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
import { validateScope, scanGoals } from "../src/goals/s6-goal-discovery.ts";
import { createOfficialS6GoalPort } from "../src/goals/s6-official-port.ts";
import { createS6GoalFlow } from "../src/goals/s6-goal-flow.ts";
import { appendProgressRecord, computeGoalProgress } from "../src/markdown/goals.ts";
import { parseTaskTable } from "../src/markdown/tasks.ts";
import { formatShanghai } from "../src/date.ts";
import { summarizeEditResponse } from "./s5-probe-edit-doc.mjs";

const NOTE = "小七 S6 受控进度写入验收（隔离测试）";
const G999_MARKER = "[小七 S6 一次性验收]";
const G998_TITLE = "小七 S6 自动创建验收";
const CONFIRM = "确认单次补写 G-998";

const fail = (code) => { throw Error(code); };
const SAFE_CODES = new Set(["IWIKI_RPC_ERROR", "IWIKI_HTTP_ERROR",
  "IWIKI_PROTOCOL_ERROR", "S6_REMOTE_UNAVAILABLE", "S6_REMOTE_UNCONFIRMED"]);
const safeErrorCode = (error) => SAFE_CODES.has(error?.code) ? error.code : "OTHER_REMOTE_ERROR";

export function createS6SingleEditGuard(client, control) {
  return {
    async listTools() {
      return (await client.listTools()).filter((t) =>
        ["list_docs", "read_doc", "edit_doc"].includes(t.name));
    },
    async callTool(name, args) {
      if (name === "list_docs" || name === "read_doc") return client.callTool(name, args);
      if (name !== "edit_doc" || !control.armed || control.attempted !== 0 ||
          args?.doc_id !== control.targetDocId || typeof args?.content !== "string") {
        throw Error("S6_RECOVERY_WRITE_FORBIDDEN");
      }
      control.attempted++;
      control.armed = false;
      try {
        const response = await client.callTool(name, args);
        control.ack = summarizeEditResponse(response);
        return response;
      } catch (error) {
        control.remoteErrorCode = safeErrorCode(error);
        throw error;
      }
    },
  };
}

/** The pure, injectable business run: tests and Windows share the same gates. */
export async function recoverS6ProgressOnce(port, scope, control, options) {
  validateScope(scope);
  if (scope.mode !== "space") fail("S6_WRONG_SCOPE");
  const { ask, backup, report = () => {}, clock = Date.now } = options;
  if (typeof ask !== "function" || typeof backup !== "function") fail("S6_CONSENT_REQUIRED");

  report({ type: "stage", stage: "goal_scan" });
  const goals = await scanGoals(port, scope);
  const g999 = goals.get("G-999");
  const g998 = goals.get("G-998");
  const checks = {
    goalCountTwo: goals.size === 2,
    g999Present: Boolean(g999),
    g999MarkerValid: Boolean(g999?.goal.description.includes(G999_MARKER)),
    g998Present: Boolean(g998),
    g998TitleValid: Boolean(g998?.goal.title === G998_TITLE),
    g998IdValid: Boolean(g998?.entry.title === "G-998"),
    progressAlreadyPresent: Boolean(g998?.goal.history.some((h) => h.note === NOTE)),
  };
  report({ type: "preflight_check", checks });
  if (!checks.goalCountTwo || !checks.g999Present || !checks.g999MarkerValid ||
      !checks.g998Present || !checks.g998TitleValid || !checks.g998IdValid)
    fail("S6_TEST_TARGET_CHANGED");
  if (checks.progressAlreadyPresent) fail("S6_PROGRESS_ALREADY_EXISTS");

  control.targetDocId = g998.entry.docId;
  report({ type: "stage", stage: "task_read" });
  const tasks = parseTaskTable(await port.readTaskTable());
  const percent = computeGoalProgress(g998.goal, tasks).percent;
  report({ type: "stage", stage: "progress_build" });
  const ts = clock();
  const expected = appendProgressRecord(g998.content, {
    date: formatShanghai(new Date(ts)).slice(0, 10),
    percent, note: NOTE,
  });
  // Fail closed if the prepared write is identical to prior content.
  if (expected === g998.content) fail("S6_NO_CHANGE");
  report({ type: "stage", stage: "prepare" });
  const flow = createS6GoalFlow(port, scope, { clock: () => ts, ttlMs: 600_000 });
  const prepared = await flow.prepare({
    type: "goal_record_progress", goalId: "G-998", note: NOTE,
  });
  if (prepared.status !== "AWAITING_APPROVAL") fail("S6_PREVIEW_FAILED");

  report({ type: "preview", progressPercent: percent });
  report({ type: "stage", stage: "consent" });
  const answer = await ask(CONFIRM);
  if (answer.trim() !== CONFIRM) {
    flow.cancel(prepared.operationId);
    return {
      inspection: "S6_TARGETED_PROGRESS_RECOVERY",
      status: "CANCELED_NO_WRITES", writeAttempts: control.attempted,
      writeRetryPermitted: false,
    };
  }
  report({ type: "stage", stage: "backup" });
  await backup(g998.content);
  report({ type: "stage", stage: "write_and_readback" });
  control.armed = true;
  let flowResult = "UNCONFIRMED";
  try {
    const result = await flow.confirm(prepared.operationId, "确认写入");
    if (result?.status === "VERIFIED") flowResult = "ACK_AND_READBACK_VERIFIED";
  } catch (error) {
    flowResult = error?.code === "S6_WRITE_UNCERTAIN"
      ? "WRITE_UNCERTAIN" : error?.code === "S6_READBACK_UNCERTAIN"
      ? "READBACK_UNCERTAIN" : error?.code === "S6_CONFLICT"
      ? "PREWRITE_CONFLICT" : "FLOW_STOPPED";
  } finally {
    control.armed = false;
  }

  // Never retry, regardless of what the edit tool returned. Read only.
  let finalStatus = "READBACK_UNAVAILABLE_NO_RETRY";
  let matchingRecords = null;
  try {
    const after = await scanGoals(port, scope);
    const a999 = after.get("G-999"), a998 = after.get("G-998");
    if (after.size === 2 && a999?.content === g999.content && a998?.entry.docId === g998.entry.docId) {
      matchingRecords = a998.goal.history.filter((row) => row.note === NOTE).length;
      if (a998.content === expected && matchingRecords === 1) {
        finalStatus = flowResult === "ACK_AND_READBACK_VERIFIED"
          ? "VERIFIED" : "PERSISTED_ACK_UNCONFIRMED";
      } else if (a998.content === g998.content && matchingRecords === 0) {
        finalStatus = "UNCHANGED_NO_RETRY";
      } else {
        finalStatus = "DIFFERENT_NO_RETRY";
      }
    } else {
      finalStatus = "SCOPE_CHANGED_NO_RETRY";
    }
  } catch { /* never log raw remote errors or text */ }

  return {
    inspection: "S6_TARGETED_PROGRESS_RECOVERY",
    status: finalStatus,
    flowResult,
    writeAttempts: control.attempted,
    progressRecordsObserved: matchingRecords,
    editResponse: control.ack,
    remoteErrorCode: control.remoteErrorCode,
    writeRetryPermitted: false,
  };
}

async function main(args) {
  if (args.length !== 1 || args[0] !== "--once") {
    process.stdout.write("Usage: npm run recover:s6-progress -- --once\n" +
      "Read-only preflight, fresh explicit consent, at most ONE G-998 edit, read-only reconciliation.\n" +
      "Do NOT run if G-998's progress was updated manually after the last audit.\n");
    return;
  }
  if (!process.stdin.isTTY) {
    process.stderr.write("S6_INTERACTIVE_TERMINAL_REQUIRED: no writes.\n");
    process.exitCode = 1;
    return;
  }
  let rl;
  const control = {
    armed: false, attempted: 0, targetDocId: null,
    ack: null, remoteErrorCode: null,
  };
  let backupSaved = false;
  let failureStage = "local_config";
  let preflightChecks = null;
  try {
    const dir = join(homedir(), "MuSSE-MCP-Local", "musse-bridge");
    const scope = JSON.parse(await readFile(join(dir, "musse-iwiki-s6-scope.json"), "utf8"));
    validateScope(scope);
    const ids = await readonlyDocumentIdsFromFile(join(dir, "musse-iwiki-readonly.json"));
    const connection = extractConnection(JSON.parse(await readFile(
      join(dir, "xiaozhi.config.json"), "utf8")));
    const client = new IwikiMcpClient(connection);
    const guard = createS6SingleEditGuard(client, control);
    const port = createOfficialS6GoalPort(guard, ids[DOC_PATHS.tasks]);
    rl = createInterface({ input: process.stdin, output: process.stdout });
    const result = await recoverS6ProgressOnce(port, scope, control, {
      report(ev) {
        if (ev.type === "stage") failureStage = ev.stage;
        if (ev.type === "preflight_check") preflightChecks = ev.checks;
        if (ev.type === "preview") process.stdout.write(
          "预检通过：G-998 的验收进度记录仍不存在；将新增一条 " +
          ev.progressPercent + "% 的记录；G-999 和任务总表不变。\n");
      },
      ask: async (phrase) => (await rl.question(
        "若同意针对 G-998 单次补写，输入「" + phrase +
        "」；输入 0 取消：\n> ")).trim(),
      async backup(content) {
        const path = join(dir, "s6-g998-recovery-backup-" + Date.now() + "-" +
          randomUUID().slice(0, 8) + ".md");
        await writeFile(path, content, { flag: "wx", mode: 0o600 });
        backupSaved = true;
        process.stdout.write("G-998 原文已独立备份至 Windows 私有目录。\n");
      },
    });
    process.stdout.write(JSON.stringify({ ...result, backupSaved }, null, 2) + "\n");
    if (result.status !== "VERIFIED" && result.status !== "PERSISTED_ACK_UNCONFIRMED" &&
        result.status !== "CANCELED_NO_WRITES") process.exitCode = 2;
  } catch (error) {
    // Only locally-defined S6_ codes or known domain error codes are exposed.
    // Never print raw exceptions: remote messages may contain credentials/IDs.
    const rawCode = typeof error?.code === "string" && error.code.startsWith("S6_")
      ? error.code : typeof error?.message === "string" &&
        /^S6_[A-Z0-9_]+$/.test(error.message) ? error.message : null;
    process.stderr.write(JSON.stringify({
      inspection: "S6_TARGETED_PROGRESS_RECOVERY",
      status: "STOPPED_NO_RETRY",
      failureStage,
      failureCode: rawCode ?? "CHECK_FAILED",
      preflightChecks,
      writeAttempts: control.attempted,
      editResponse: control.ack, remoteErrorCode: control.remoteErrorCode,
      backupSaved, writeRetryPermitted: false,
    }, null, 2) + "\n");
    process.exitCode = 1;
  } finally { rl?.close(); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main(process.argv.slice(2));
