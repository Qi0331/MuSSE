/**
 * S6 goal-only MCP entrypoint, intentionally NOT registered in Windows.
 * Existing S4 and S5 processes/services and mappings remain unchanged.
 * Private scope file is stored alongside existing local bridge configs.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { extractConnection } from "../../tools/inspect-readonly.mjs";
import { readonlyDocumentIdsFromFile } from "./document-ids.ts";
import { IwikiMcpClient } from "../store/iwiki-mcp-client.ts";
import { DOC_PATHS } from "../store/wiki-store.ts";
import { validateScope } from "../goals/s6-goal-discovery.ts";
import type { GoalScope } from "../goals/s6-goal-discovery.ts";
import { createOfficialS6GoalPort } from "../goals/s6-official-port.ts";
import { createS6GoalFlow } from "../goals/s6-goal-flow.ts";
import { handleS6GoalRpc } from "./s6-goal-protocol.ts";

export async function buildS6GoalFlow(env: NodeJS.ProcessEnv) {
  if (env.MUSSE_S6_WRITE_ENABLED !== "1") throw new Error("S6_NOT_ENABLED");
  const configFile = env.MUSSE_IWIKI_PRIVATE_CONFIG_FILE ??
    join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
  const dir = dirname(configFile);
  const mappingFile = env.MUSSE_IWIKI_PRIVATE_MAPPING_FILE ?? join(dir, "musse-iwiki-readonly.json");
  const scopeFile = env.MUSSE_S6_SCOPE_FILE ?? join(dir, "musse-iwiki-s6-scope.json");
  const scope = JSON.parse(await readFile(scopeFile, "utf8")) as GoalScope;
  validateScope(scope);
  const ids = await readonlyDocumentIdsFromFile(mappingFile);
  const connection = extractConnection(JSON.parse(await readFile(configFile, "utf8")));
  const client = new IwikiMcpClient(connection);
  return createS6GoalFlow(createOfficialS6GoalPort(client, ids[DOC_PATHS.tasks]), scope);
}

export async function serveS6GoalStdio(
  flow: ReturnType<typeof createS6GoalFlow>,
  input: NodeJS.ReadableStream, output: NodeJS.WritableStream,
) {
  const rl = createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let message: unknown;
    try { message = JSON.parse(line); }
    catch { process.stderr.write("[musse-iwiki] S6 invalid JSON request\n"); continue; }
    const response = await handleS6GoalRpc(flow, message);
    if (response) output.write(JSON.stringify(response) + "\n");
  }
}
export async function mainS6() {
  const flow = await buildS6GoalFlow(process.env);
  process.stderr.write("[musse-iwiki] S6 goal-only MCP ready\n");
  await serveS6GoalStdio(flow, process.stdin, process.stdout);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mainS6().catch(() => {
    process.stderr.write("[musse-iwiki] S6 unavailable; check private local configuration\n");
    process.exitCode = 1;
  });
}
