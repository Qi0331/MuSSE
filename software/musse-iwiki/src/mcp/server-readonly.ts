import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { TaskService } from "../service/task-service.ts";
import { IwikiMcpClient } from "../store/iwiki-mcp-client.ts";
import { OfficialIwikiReadStore } from "../store/official-iwiki-read.ts";
import { readonlyDocumentIds, readonlyDocumentIdsFromFile } from "./document-ids.ts";
import { extractConnection } from "../../tools/inspect-readonly.mjs";
import { handleReadonlyRpc } from "./readonly-protocol.ts";

/**
 * S4-B/C standalone stdio entry point. No local persistence, no write capability,
 * and no connection until a task query is actually invoked.
 *
 * S4-D Windows deployment defaults (after separate approval):
 *   $HOME/MuSSE-MCP-Local/musse-bridge/xiaozhi.config.json
 *   $HOME/MuSSE-MCP-Local/musse-bridge/musse-iwiki-readonly.json
 * Optional env overrides preserve existing S4-B/C compatibility.
 * Never put document IDs or credentials in the xiaozhi-client service entry:
 * its upstream config converter can log the entry. Private data stays on disk.
 */
export async function buildReadonlyTaskService(env: NodeJS.ProcessEnv): Promise<TaskService> {
  const configFile = env.MUSSE_IWIKI_PRIVATE_CONFIG_FILE ??
    join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
  const mappingFile = env.MUSSE_IWIKI_PRIVATE_MAPPING_FILE ??
    join(dirname(configFile), "musse-iwiki-readonly.json");
  const documentIds = env.MUSSE_IWIKI_TASK_DOC_ID
    ? readonlyDocumentIds(env)
    : await readonlyDocumentIdsFromFile(mappingFile);
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const connection = extractConnection(config); // reuse S2-A verified official endpoint selection
  const store = new OfficialIwikiReadStore(
    new IwikiMcpClient(connection),
    documentIds,
  );
  return new TaskService(store);
}

export async function main(): Promise<void> {
  const service = await buildReadonlyTaskService(process.env);
  process.stderr.write("[musse-iwiki] S4-B/C read-only business server ready\n");
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      process.stderr.write("[musse-iwiki] invalid JSON request\n");
      continue;
    }
    const reply = await handleReadonlyRpc(service, parsed);
    if (reply) process.stdout.write(`${JSON.stringify(reply)}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(() => {
    // No raw errors: even local configuration exceptions can contain private data.
    process.stderr.write("[musse-iwiki] S4-B/C server unavailable (configuration or startup error)\n");
    process.exitCode = 1;
  });
}
