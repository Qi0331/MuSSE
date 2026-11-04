/**
 * S5-G local deployment-readiness inventory. Opt-in, read-only and offline.
 * Does NOT activate S5, edit bridge configuration, call MCP tools, or print
 * private IDs, documents, raw config, tokens or filesystem paths.
 *
 * Usage:
 *   npm run preflight:s5                        (help, no file access)
 *   npm run preflight:s5 -- --local-readonly     (private local status only)
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENDPOINT = "https://ssemarket.cn/iwiki-api/mcp";
const PAGE_ID = /^page-[A-Za-z0-9_-]{1,100}$/;

async function safelyReadJson(path) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return { state: "PRESENT", value };
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { state: "MISSING" };
    }
    return { state: "INVALID" };
  }
}

const isRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/** No raw private value, ID, path or secret is ever returned. */
export function summarizeS5LocalStatus(bridge, mapping, contract, env = {}) {
  const servers = isRecord(bridge) && isRecord(bridge.mcpServers)
    ? bridge.mcpServers : null;
  const official = servers?.iwiki;
  const officialState = isRecord(official) && official.type === "http" && official.url === ENDPOINT &&
    typeof official.headers?.Authorization === "string" &&
    /^Bearer [^\s]+$/.test(official.headers.Authorization) ? "CONFIGURED" : "NOT_CONFIRMED";
  const readonlyState = servers && Object.hasOwn(servers, "musse_iwiki_readonly")
    ? "REGISTERED" : "NOT_CONFIRMED";
  const s5Registered = servers === null ? "UNKNOWN" :
    Object.keys(servers).some((key) => /(?:musse.*(?:s5|write)|voice.*write)/i.test(key))
      ? "PRESENT" : "ABSENT";
  const taskMapped = isRecord(mapping) && typeof mapping.taskDocId === "string" &&
    PAGE_ID.test(mapping.taskDocId);
  const notesMapped = isRecord(mapping) && typeof mapping.notesDocId === "string" &&
    PAGE_ID.test(mapping.notesDocId);
  const mappingState = taskMapped && (mapping.notesDocId === undefined || notesMapped)
    ? "TASK_VALID" : "NOT_CONFIRMED";
  const contractState = isRecord(contract) &&
    contract.toolName === "edit_doc" &&
    contract.documentIdArgument === "doc_id" &&
    contract.contentArgument === "content"
      ? "VERIFIED_FIELDS" : "NOT_CONFIRMED";
  const nodeParts = process.versions.node.split(".").map(Number);
  const nodeOk = nodeParts[0] > 22 || (nodeParts[0] === 22 && nodeParts[1] >= 18);
  return {
    inspection: "LOCAL_READONLY_NO_MCP_CALLS_NO_CHANGES",
    nodeSupported: nodeOk,
    officialIwiki: officialState,
    s4Readonly: readonlyState,
    s5BridgeEntry: s5Registered,
    taskMapping: mappingState,
    notesMapping: notesMapped ? "PRESENT_VALID" : "NOT_CONFIRMED",
    writeContract: contractState,
    writeFlagInThisShell: env.MUSSE_S5_WRITE_ENABLED === "1" ? "SET" : "NOT_SET",
    liveVoiceValidated: false,
    productionWriteAuthorized: false,
  };
}

export async function inspectS5LocalFiles(
  configPath, mappingPath, contractPath, env = {},
) {
  const [config, mapping, contract] = await Promise.all([
    safelyReadJson(configPath), safelyReadJson(mappingPath), safelyReadJson(contractPath),
  ]);
  const result = summarizeS5LocalStatus(config.value, mapping.value, contract.value, env);
  return {
    ...result,
    bridgeConfigFile: config.state,
    mappingFile: mapping.state,
    contractFile: contract.state,
  };
}

async function main(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
    process.stdout.write(
      "Usage: npm run preflight:s5 -- --local-readonly\n" +
      "No arguments: help only. --local-readonly reads local private JSON in memory, " +
      "reports sanitized status, NEVER changes files, starts servers or calls iWiki.\n",
    );
    return;
  }
  if (args.length !== 1 || args[0] !== "--local-readonly") {
    throw Error("S5_PREFLIGHT_ARGUMENTS_INVALID");
  }
  const privateDir = join(homedir(), "MuSSE-MCP-Local", "musse-bridge");
  const configPath = join(privateDir, "xiaozhi.config.json");
  const mappingPath = join(dirname(configPath), "musse-iwiki-readonly.json");
  const contractPath = join(dirname(configPath), "musse-iwiki-write.json");
  const result = await inspectS5LocalFiles(configPath, mappingPath, contractPath, process.env);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch(() => {
    process.stderr.write("S5_PREFLIGHT_FAILED\n");
    process.exitCode = 1;
  });
}
