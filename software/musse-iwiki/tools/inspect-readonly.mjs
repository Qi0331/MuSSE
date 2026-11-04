/**
 * S2-A only: inspect the official iWiki MCP tools/list, never tools/call.
 * No token, endpoint, document content or unfiltered server error is printed.
 * This tool does NOT change the existing xiaozhi-client production setup.
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OFFICIAL_ENDPOINT = 'https://ssemarket.cn/iwiki-api/mcp';
export const QUERY_TOOL_NAMES = Object.freeze([
  'list_spaces', 'list_docs', 'list_doc_tree',
  'search_kb', 'read_doc', 'get_doc_outline',
]);
const SAFE_FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function extractConnection(config) {
  if (!config || typeof config !== 'object') throw new Error('CONFIG_INVALID');
  const entry = config.mcpServers?.iwiki;
  if (entry?.type !== 'http' || entry.url !== OFFICIAL_ENDPOINT) {
    throw new Error('CONFIG_INVALID');
  }
  const auth = entry.headers?.Authorization;
  if (typeof auth !== 'string' || !/^Bearer [^\s]+$/.test(auth)) {
    throw new Error('CONFIG_INVALID');
  }
  return { endpoint: OFFICIAL_ENDPOINT, token: auth.slice(7) };
}

function safeFields(inputSchema) {
  const schema = inputSchema && typeof inputSchema === 'object' ? inputSchema : {};
  const properties = schema.properties && typeof schema.properties === 'object'
    && !Array.isArray(schema.properties) ? schema.properties : {};
  const fields = Object.keys(properties).filter((name) => SAFE_FIELD.test(name)).slice(0, 64);
  const required = Array.isArray(schema.required)
    ? schema.required.filter((name) => typeof name === 'string' && fields.includes(name))
    : [];
  return { fields, required };
}

export function summarizeTools(tools) {
  if (!Array.isArray(tools)) throw new Error('TOOLS_INVALID');
  const names = new Map();
  for (const tool of tools) {
    if (tool && typeof tool.name === 'string' && QUERY_TOOL_NAMES.includes(tool.name)
        && !names.has(tool.name)) names.set(tool.name, tool);
  }
  return {
    inspection: 'S2-A tools/list only; no documents read and no write tools called',
    totalAdvertisedTools: tools.length,
    queries: QUERY_TOOL_NAMES.map((name) => {
      const tool = names.get(name);
      if (!tool) return { name, present: false };
      return { name, present: true, ...safeFields(tool.inputSchema) };
    }),
    note: 'Field names are a sanitized summary, not a verified argument or response contract.',
  };
}

export async function inspectFromFile(configFile, clientFactory) {
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  const connection = extractConnection(config);
  const client = clientFactory(connection);
  // Only initialize and tools/list. Deliberately no callTool, even for list_spaces.
  return summarizeTools(await client.listTools());
}

async function main(argv) {
  const help = 'Usage: node tools/inspect-readonly.mjs --live [--config <local-private-config-path>]\n' +
    'No flag: no file read and no network request. --live uses the existing private Windows config, makes only MCP initialize and tools/list requests, and prints a sanitized summary.';
  if (!argv.includes('--live')) {
    process.stdout.write(help + '\n');
    return;
  }
  const configIndex = argv.indexOf('--config');
  if (argv[0] !== '--live' ||
      (configIndex === -1 && argv.length !== 1) ||
      (configIndex !== -1 && (configIndex !== 1 || argv.length !== 3 || !argv[2]))) {
    throw new Error('ARGUMENTS_INVALID');
  }
  const file = configIndex >= 0 ? argv[configIndex + 1] :
    join(homedir(), 'MuSSE-MCP-Local', 'musse-bridge', 'xiaozhi.config.json');
  const { IwikiMcpClient } = await import('../src/store/iwiki-mcp-client.ts');
  const result = await inspectFromFile(file, (connection) => new IwikiMcpClient(connection));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch(() => {
    // Never disclose raw exceptions: upstream HTTP errors can contain sensitive response bodies.
    process.stderr.write('S2-A inspection failed (arguments, local config, network or MCP protocol). No private details printed.\n');
    process.exitCode = 1;
  });
}
