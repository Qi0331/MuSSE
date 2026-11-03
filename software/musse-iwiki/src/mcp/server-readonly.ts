import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { TaskService } from "../service/task-service.ts";
import { IwikiMcpClient } from "../store/iwiki-mcp-client.ts";
import { OfficialIwikiReadStore } from "../store/official-iwiki-read.ts";
import { DOC_PATHS } from "../store/wiki-store.ts";
import { extractConnection } from "../../tools/inspect-readonly.mjs";
import { handleReadonlyRpc } from "./readonly-protocol.ts";

/**
 * S4-B standalone stdio entry point. No local persistence, no write capability,
 * and no connection until a task query is actually invoked.
 *
 * Both env vars must be set by the operator at a future authorized integration:
 *   MUSSE_IWIKI_PRIVATE_CONFIG_FILE: existing local xiaozhi.config.json path
 *   MUSSE_IWIKI_TASK_DOC_ID: explicit authoritative task table page-... ID
 * Neither secret nor document ID belongs in the public repository.
 */
export async function buildReadonlyTaskService(env: NodeJS.ProcessEnv): Promise<TaskService> {
  const configFile = env.MUSSE_IWIKI_PRIVATE_CONFIG_FILE;
  const docId = env.MUSSE_IWIKI_TASK_DOC_ID;
  if (!configFile || !docId || !/^page-[A-Za-z0-9_-]{1,100}$/.test(docId)) {
    throw new Error("S4B_CONFIG_MISSING_OR_INVALID");
  }
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const connection = extractConnection(config); // reuse S2-A verified official endpoint selection
  const store = new OfficialIwikiReadStore(
    new IwikiMcpClient(connection),
    { [DOC_PATHS.tasks]: docId },
  );
  return new TaskService(store);
}

export async function main(): Promise<void> {
  const service = await buildReadonlyTaskService(process.env);
  process.stderr.write("[musse-iwiki] S4-B read-only task server ready\n");
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
    process.stderr.write("[musse-iwiki] S4-B server unavailable (configuration or startup error)\n");
    process.exitCode = 1;
  });
}
