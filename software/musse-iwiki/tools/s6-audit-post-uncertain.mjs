/**
 * Recover evidence after S6_WRITE_UNCERTAIN without ANY remote mutation.
 * Checks G-999, G-998 and the exact expected single progress record.
 * Does not retry edit_doc. Never logs private IDs, page text, tokens or errors.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { readonlyDocumentIdsFromFile } from "../src/mcp/document-ids.ts";
import { DOC_PATHS } from "../src/store/wiki-store.ts";
import { createOfficialS6GoalPort } from "../src/goals/s6-official-port.ts";
import { scanGoals, validateScope } from "../src/goals/s6-goal-discovery.ts";
import { parseTaskTable } from "../src/markdown/tasks.ts";
import { computeGoalProgress } from "../src/markdown/goals.ts";

const NOTE = "小七 S6 受控进度写入验收（隔离测试）";
const MARKER = "[小七 S6 一次性验收]";
const READ = new Set(["list_docs", "read_doc"]);

/** This facade blocks all mutations even if the underlying port is misused. */
export function s6RecoveryReadOnlyClient(client) {
  return {
    async listTools() { return (await client.listTools()).filter((t) => READ.has(t.name)); },
    async callTool(name, args) {
      if (!READ.has(name)) throw Error("S6_RECOVERY_WRITE_FORBIDDEN");
      return client.callTool(name, args);
    },
  };
}

/** No untrusted content, private IDs, notes, titles or full errors exposed. */
export function summarizeS6Recovery(goals, tasks) {
  const g999 = goals.get("G-999");
  const g998 = goals.get("G-998");
  const markerVerified = Boolean(g999?.goal?.description.includes(MARKER));
  const titleVerified = g998?.entry?.title === "G-998" && g998?.goal?.id === "G-998";
  const rows = g998?.goal?.history.filter((row) => row.note === NOTE) ?? [];
  const matches = rows.length;
  const expectedPercent = g998 ? computeGoalProgress(g998.goal, tasks).percent : null;
  const progressVerified = titleVerified && matches === 1 &&
    rows[0].percent === expectedPercent;
  let thirdWriteStatus = "NOT_OBSERVED_DO_NOT_RETRY";
  if (!titleVerified) thirdWriteStatus = "TARGET_UNVERIFIED";
  else if (matches > 1) thirdWriteStatus = "DUPLICATE_DO_NOT_RETRY";
  else if (progressVerified) thirdWriteStatus = "PERSISTED_VERIFIED";
  else if (matches === 1) thirdWriteStatus = "PERCENT_MISMATCH_DO_NOT_RETRY";
  return {
    inspection: "S6_POST_UNCERTAIN_READ_ONLY_AUDIT",
    goalCount: goals.size,
    g999MarkerVerified: markerVerified,
    g998ExistsAndValid: titleVerified,
    matchingProgressRecords: matches,
    progressMatchesCurrentTaskState: progressVerified,
    thirdWriteStatus,
    taskCount: tasks.length,
    writesAttempted: 0,
    writeRetryPermitted: false,
  };
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--read-only") {
    process.stdout.write("Usage: npm run audit:s6-uncertain -- --read-only\n" +
      "Reads only pinned goal and task pages; NEVER retries a write.\n");
    return;
  }
  let stage = "local_config";
  try {
    const privateDir = join(homedir(), "MuSSE-MCP-Local", "musse-bridge");
    const scope = JSON.parse(await readFile(join(privateDir, "musse-iwiki-s6-scope.json"), "utf8"));
    validateScope(scope);
    if (scope.mode !== "space") throw Error("S6_INVALID_SCOPE");
    const ids = await readonlyDocumentIdsFromFile(join(privateDir, "musse-iwiki-readonly.json"));
    const connection = extractConnection(JSON.parse(await readFile(
      join(privateDir, "xiaozhi.config.json"), "utf8")));
    const guarded = s6RecoveryReadOnlyClient(new IwikiMcpClient(connection));
    const port = createOfficialS6GoalPort(guarded, ids[DOC_PATHS.tasks]);
    stage = "goal_read";
    const goals = await scanGoals(port, scope);
    stage = "task_read";
    const tasks = parseTaskTable(await port.readTaskTable());
    stage = "audit";
    const report = summarizeS6Recovery(goals, tasks);
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!report.g999MarkerVerified || !report.g998ExistsAndValid ||
        report.thirdWriteStatus !== "PERSISTED_VERIFIED") process.exitCode = 2;
  } catch {
    process.stderr.write(JSON.stringify({
      inspection: "S6_POST_UNCERTAIN_READ_ONLY_AUDIT",
      status: "READ_ONLY_AUDIT_UNAVAILABLE",
      stage,
      writesAttempted: 0,
      writeRetryPermitted: false,
    }, null, 2) + "\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
