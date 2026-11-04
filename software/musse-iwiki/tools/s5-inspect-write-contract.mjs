/**
 * S5-C: write-tool discovery via tools/list ONLY. Never executes tools/call.
 * This does not prove that any operation is safe, atomic, authorized, or reversible.
 * No request is sent without an explicit --live flag.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";

const TOOL = /^[a-z][a-z0-9_]{0,63}$/;
const FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const MUTATION = /(?:^|_)(?:create|update|write|edit|append|patch|delete|archive|restore|remove|add)(?:_|$)/;
const VERSION = /(?:version|revision|etag|if_match|expected|hash)/i;

export function summarizeS5WriteToolCandidates(tools) {
  if (!Array.isArray(tools)) throw new Error("S5_TOOLS_INVALID");
  const mutations = [];
  for (const t of tools) {
    if (!t || typeof t.name !== "string" || !TOOL.test(t.name) || !MUTATION.test(t.name)) continue;
    if (mutations.some((item) => item.name === t.name)) continue;
    if (mutations.length >= 32) break;
    const props = t.inputSchema && typeof t.inputSchema === "object" &&
      t.inputSchema.properties && typeof t.inputSchema.properties === "object" &&
      !Array.isArray(t.inputSchema.properties) ? t.inputSchema.properties : {};
    const fields = Object.keys(props).filter((name) => FIELD.test(name)).slice(0, 64);
    const required = Array.isArray(t.inputSchema?.required) ?
      t.inputSchema.required.filter((name) => typeof name === "string" && fields.includes(name)) : [];
    mutations.push({ name: t.name, fields, required,
      hasVersionNamedField: fields.some((field) => VERSION.test(field)) });
  }
  return {
    inspection: "S5-C tools/list only; never tools/call",
    advertisedToolCount: tools.length,
    mutationCandidates: mutations,
    atomicConditionalWriteVerified: false,
    serverSideWritePermissionVerified: false,
    note: "Names and fields are sanitized hints, not an authorization, atomicity, argument, or response contract.",
  };
}

export async function inspectS5FromFile(configFile, clientFactory) {
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const connection = extractConnection(config); // pinned endpoint and existing private token
  const client = clientFactory(connection);
  // Do not call read_doc, mutation tools, or any tools/call method.
  return summarizeS5WriteToolCandidates(await client.listTools());
}

async function main(argv) {
  if (!argv.includes("--live")) {
    process.stdout.write("Usage: node tools/s5-inspect-write-contract.mjs --live [--config <private-path>]\nDefault: no config read/network; --live performs only initialize + tools/list.\n");
    return;
  }
  const configIndex = argv.indexOf("--config");
  if (argv[0] !== "--live" ||
      (configIndex === -1 && argv.length !== 1) ||
      (configIndex !== -1 && (configIndex !== 1 || argv.length !== 3 || !argv[2]))) {
    throw new Error("S5_ARGUMENTS_INVALID");
  }
  const file = configIndex >= 0 ? argv[2] :
    join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
  const { IwikiMcpClient } = await import("../src/store/iwiki-mcp-client.ts");
  const result = await inspectS5FromFile(file, (connection) => new IwikiMcpClient(connection));
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch(() => {
    process.stderr.write("S5-C inspection failed (configuration, arguments or network); no raw details emitted.\n");
    process.exitCode = 1;
  });
}
