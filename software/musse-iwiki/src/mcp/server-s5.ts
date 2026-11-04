import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { extractConnection } from "../../tools/inspect-readonly.mjs";
import { readonlyDocumentIdsFromFile } from "./document-ids.ts";
import { IwikiMcpClient } from "../store/iwiki-mcp-client.ts";
import { createOfficialIwikiBestEffortPort } from "../write/official-iwiki-best-effort.ts";
import type { IwikiBestEffortContract } from "../write/official-iwiki-best-effort.ts";
import { planS5Mutation } from "../write/plan-write.ts";
import { createS5VoiceFlow } from "../write/voice-flow.ts";
import { handleS5VoiceRpc } from "./s5-voice-protocol.ts";

/**
 * Separate S5 stdio entrypoint, NOT installed in Windows or the existing bridge.
 *
 * Explicit opt-in to launch: MUSSE_S5_WRITE_ENABLED=1, private contract file
 * and existing private doc mapping. No tool name, page ID or token is bundled.
 * Best-effort concurrency: pre-write read comparison + post-write verification.
 */
export async function buildS5VoiceFlow(env: NodeJS.ProcessEnv) {
  if (env.MUSSE_S5_WRITE_ENABLED !== "1") throw new Error("S5_NOT_ENABLED");
  const configFile = env.MUSSE_IWIKI_PRIVATE_CONFIG_FILE ??
    join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
  const privateDir = dirname(configFile);
  const mappingFile = env.MUSSE_IWIKI_PRIVATE_MAPPING_FILE ??
    join(privateDir, "musse-iwiki-readonly.json");
  const contractFile = env.MUSSE_S5_WRITE_CONTRACT_FILE ??
    join(privateDir, "musse-iwiki-write.json");

  const ids = await readonlyDocumentIdsFromFile(mappingFile);
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const connection = extractConnection(config);
  const contract = JSON.parse(await readFile(contractFile, "utf8")) as IwikiBestEffortContract;
  const client = new IwikiMcpClient(connection);
  const port = createOfficialIwikiBestEffortPort(client, ids, contract);
  return createS5VoiceFlow(port, planS5Mutation, { concurrencyMode: "check-before-write" });
}

/**
 * Injectable stdio transport for offline integration tests. No config, token
 * or network access occurs here; main() supplies the explicitly enabled flow.
 */
export async function serveS5VoiceStdio(
  flow: ReturnType<typeof createS5VoiceFlow>,
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<void> {
  const rl = createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let message: unknown;
    try { message = JSON.parse(line); }
    catch {
      process.stderr.write("[musse-iwiki] S5 invalid JSON request\n");
      continue;
    }
    const response = await handleS5VoiceRpc(flow, message);
    if (response) output.write(`${JSON.stringify(response)}\n`);
  }
}

export async function main(): Promise<void> {
  const flow = await buildS5VoiceFlow(process.env);
  process.stderr.write("[musse-iwiki] S5 voice-write MCP ready (best-effort concurrency)\n");
  await serveS5VoiceStdio(flow, process.stdin, process.stdout);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(() => {
    // Do not print private paths, tokens, tool arguments or upstream errors.
    process.stderr.write("[musse-iwiki] S5 writer unavailable (opt-in or private mapping/contract missing)\n");
    process.exitCode = 1;
  });
}
