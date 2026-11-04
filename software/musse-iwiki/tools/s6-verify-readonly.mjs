/**
 * S6 end-to-end READ-ONLY local validation of goal-scope and the existing
 * 12-column task-doc mapping. No iWiki mutation or private data output.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { readonlyDocumentIdsFromFile } from "../src/mcp/document-ids.ts";
import { DOC_PATHS } from "../src/store/wiki-store.ts";
import { parseTaskTable, TASK_HEADER } from "../src/markdown/tasks.ts";
import { validateScope, scanGoals } from "../src/goals/s6-goal-discovery.ts";
import { createOfficialS6GoalPort } from "../src/goals/s6-official-port.ts";

const obj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export function summarizePinnedTaskDoc(response, docId) {
  if (!obj(response) || response.isError === true)
    throw Error("S6_TASK_UNVERIFIED");
  const envelopes = [];
  if (obj(response.structuredContent)) envelopes.push(response.structuredContent);
  if (Array.isArray(response.content)) for (const item of response.content) {
    if (typeof item?.text !== "string") continue;
    try { const parsed = JSON.parse(item.text); if (obj(parsed)) envelopes.push(parsed); }
    catch { /* never log */ }
  }
  if (!envelopes.length) throw Error("S6_TASK_UNVERIFIED");
  const verified = envelopes.map((item) => {
    if (item.ok !== true || !obj(item.data)) throw Error("S6_TASK_UNVERIFIED");
    const data = item.data;
    if (data.doc_id !== docId || typeof data.content !== "string" ||
        typeof data.title !== "string") throw Error("S6_TASK_UNVERIFIED");
    return { doc: data, tasks: parseTaskTable(data.content) };
  });
  if (!verified.every((item) => item.doc.title === verified[0].doc.title &&
      item.doc.content === verified[0].doc.content)) throw Error("S6_TASK_UNVERIFIED");
  return {
    titleMatches: verified[0].doc.title === "任务总表",
    columnCount: TASK_HEADER.length,
    taskCount: verified[0].tasks.length,
  };
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--read-only") {
    process.stdout.write("Usage: npm run verify:s6 -- --read-only\n" +
      "Read-only verification of pinned knowledge base and current task document.\n");
    return;
  }
  try {
    const privateDir = join(homedir(), "MuSSE-MCP-Local", "musse-bridge");
    const scope = JSON.parse(await readFile(join(privateDir, "musse-iwiki-s6-scope.json"), "utf8"));
    validateScope(scope);
    if (scope.mode !== "space") throw Error("S6_SCOPE_MODE_INVALID");
    const ids = await readonlyDocumentIdsFromFile(join(privateDir, "musse-iwiki-readonly.json"));
    const docId = ids[DOC_PATHS.tasks];
    const connection = extractConnection(JSON.parse(
      await readFile(join(privateDir, "xiaozhi.config.json"), "utf8")));
    const client = new IwikiMcpClient(connection);
    const port = createOfficialS6GoalPort(client, docId);
    const goals = await scanGoals(port, scope);
    const tasks = summarizePinnedTaskDoc(await client.callTool("read_doc", { doc_id: docId }), docId);
    const verified = tasks.titleMatches && tasks.columnCount === 12;
    process.stdout.write(JSON.stringify({
      inspection: "S6_LOCAL_READ_ONLY_VERIFICATION",
      goalScopeMode: "space",
      goalDocumentCount: goals.size,
      taskDocTitleMatches: tasks.titleMatches,
      taskTableColumnCount: tasks.columnCount,
      taskCount: tasks.taskCount,
      readyForReadOnly: verified,
      readyForWrite: false,
      writesAttempted: 0,
    }, null, 2) + "\n");
    if (!verified) process.exitCode = 1;
  } catch {
    process.stderr.write("S6_READ_ONLY_VERIFICATION_FAILED: inspect local configuration privately; no iWiki write attempted.\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
