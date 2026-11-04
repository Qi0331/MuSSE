/**
 * S6 one-shot, real-iWiki READ-ONLY goal preview/cancel check.
 * There is deliberately NO --confirm or write flag; the client allows
 * only list_docs and read_doc regardless of the caller's behavior.
 * Never print private config, IDs, document content, token or upstream errors.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { readonlyDocumentIdsFromFile } from "../src/mcp/document-ids.ts";
import { DOC_PATHS } from "../src/store/wiki-store.ts";
import { createS6GoalFlow } from "../src/goals/s6-goal-flow.ts";
import { validateScope } from "../src/goals/s6-goal-discovery.ts";
import { createOfficialS6GoalPort } from "../src/goals/s6-official-port.ts";

const READ_TOOLS = new Set(["list_docs", "read_doc"]);

/** Hard barrier: neither this facade nor the exposed goal port can write. */
export function createS6PreviewReadOnlyPort(client, taskDocId, metrics = { reads: 0 }) {
  const guardedClient = {
    async listTools() {
      return (await client.listTools()).filter((tool) => READ_TOOLS.has(tool.name));
    },
    async callTool(name, args) {
      if (!READ_TOOLS.has(name)) throw Error("S6_READ_ONLY_WRITE_FORBIDDEN");
      metrics.reads += 1;
      return client.callTool(name, args);
    },
  };
  const port = createOfficialS6GoalPort(guardedClient, taskDocId);
  return {
    listDirectChildren: port.listDirectChildren,
    readDoc: port.readDoc,
    readTaskTable: port.readTaskTable,
    async createDoc() { throw Error("S6_READ_ONLY_WRITE_FORBIDDEN"); },
    async editDoc() { throw Error("S6_READ_ONLY_WRITE_FORBIDDEN"); },
  };
}

export async function runS6PreviewCancel(port, scope) {
  validateScope(scope);
  if (scope.mode !== "space") throw Error("S6_SCOPE_MODE_INVALID");
  const flow = createS6GoalFlow(port, scope);
  const found = await flow.find("G999");
  if (found.goal.id !== "G999" || found.documentTitle !== "G999")
    throw Error("S6_TEST_GOAL_NOT_VERIFIED");
  const prepared = await flow.prepare({
    type: "goal_update",
    goalId: "G999",
    changes: { description: "小七 S6 预览取消验收 " + randomUUID().slice(0, 8) },
  });
  if (prepared.status !== "AWAITING_APPROVAL" || !prepared.preview.includes("G999"))
    throw Error("S6_PREVIEW_UNVERIFIED");
  const canceled = flow.cancel(prepared.operationId);
  const finalStatus = flow.status(prepared.operationId);
  if (canceled.canceled !== true || finalStatus !== "CANCELED")
    throw Error("S6_CANCEL_UNVERIFIED");
  return { goalVerified: true, prepared: true, canceled: true, finalStatus };
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--read-only") {
    process.stdout.write("Usage: npm run preview:s6 -- --read-only\n" +
      "Only list_docs, read_doc, prepare and cancel. No write mode exists.\n");
    return;
  }
  try {
    const privateDir = join(homedir(), "MuSSE-MCP-Local", "musse-bridge");
    const scope = JSON.parse(await readFile(join(privateDir, "musse-iwiki-s6-scope.json"), "utf8"));
    validateScope(scope);
    if (scope.mode !== "space") throw Error("S6_SCOPE_MODE_INVALID");
    const ids = await readonlyDocumentIdsFromFile(join(privateDir, "musse-iwiki-readonly.json"));
    const connection = extractConnection(JSON.parse(await readFile(
      join(privateDir, "xiaozhi.config.json"), "utf8")));
    const client = new IwikiMcpClient(connection);
    const metrics = { reads: 0 };
    const port = createS6PreviewReadOnlyPort(client, ids[DOC_PATHS.tasks], metrics);
    const result = await runS6PreviewCancel(port, scope);
    process.stdout.write(JSON.stringify({
      inspection: "S6_PREVIEW_CANCEL_READ_ONLY",
      goalId: "G999",
      ...result,
      readCalls: metrics.reads,
      writesAttempted: 0,
      readyForWrite: false,
    }, null, 2) + "\n");
  } catch {
    process.stderr.write("S6_PREVIEW_CANCEL_FAILED: no iWiki write attempted; " +
      "do not share private config or raw exceptions.\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
