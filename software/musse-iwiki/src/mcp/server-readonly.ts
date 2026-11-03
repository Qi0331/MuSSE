import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { TaskService } from "../service/task-service.ts";
import { IwikiMcpClient } from "../store/iwiki-mcp-client.ts";
import { OfficialIwikiReadStore } from "../store/official-iwiki-read.ts";
import { readonlyDocumentIds } from "./document-ids.ts";
import { extractConnection } from "../../tools/inspect-readonly.mjs";
import { handleReadonlyRpc } from "./readonly-protocol.ts";

/**
 * S4-B/C standalone stdio entry point. No local persistence, no write capability,
 * and no connection until a task query is actually invoked.
 *
 * Both env vars must be set by the operator at a future authorized integration:
 *   MUSSE_IWIKI_PRIVATE_CONFIG_FILE: existing local xiaozhi.config.json path
 *   MUSSE_IWIKI_TASK_DOC_ID: required task table page-... ID
 *   MUSSE_IWIKI_NOTES_DOC_ID: optional notes page-... ID
 *   MUSSE_IWIKI_GOAL_DOC_IDS: optional JSON object mapping goal IDs to page-... IDs
 * Missing optional mappings fail closed on the corresponding query.
 * Neither secret nor document ID belongs in the public repository.
 */
export async function buildReadonlyTaskService(env: NodeJS.ProcessEnv): Promise<TaskService> {
  const configFile = env.MUSSE_IWIKI_PRIVATE_CONFIG_FILE;
  if (!configFile) throw new Error("S4_READONLY_CONFIG_MISSING");
  const documentIds = readonlyDocumentIds(env);
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
