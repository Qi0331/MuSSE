/**
 * MuSSE S4-D Windows bridge helper. No third-party dependencies.
 * Usage: node tools/s4d-bridge.mjs --smoke | --install | --status | --rollback
 * This helper never logs tokens, document IDs, raw tool results or configuration.
 */
import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { copyFile, open, readFile, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '..');
const serverPath = join(project, 'src', 'mcp', 'server-readonly.ts');
const bridgeDir = join(homedir(), 'MuSSE-MCP-Local', 'musse-bridge');
const configPath = join(bridgeDir, 'xiaozhi.config.json');
const serviceKey = 'musse_iwiki_readonly';
const officialUrl = 'https://ssemarket.cn/iwiki-api/mcp';
const names = [
  'task_query', 'schedule_today', 'schedule_upcoming', 'schedule_overdue',
  'goal_query', 'note_query',
];

function assertNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) throw Error('NODE_VERSION_TOO_OLD');
}

async function getConfig() {
  let raw;
  try { raw = await readFile(configPath, 'utf8'); }
  catch { throw Error('PRIVATE_CONFIG_NOT_FOUND'); }
  let config;
  try { config = JSON.parse(raw); }
  catch { throw Error('PRIVATE_CONFIG_NOT_STRICT_JSON'); }
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
      !config.mcpServers || typeof config.mcpServers !== 'object' ||
      Array.isArray(config.mcpServers) ||
      config.mcpServers.iwiki?.type !== 'http' ||
      config.mcpServers.iwiki?.url !== officialUrl) {
    throw Error('ORIGINAL_IWIKI_SERVICE_UNEXPECTED');
  }
  return config;
}

async function writeConfig(config) {
  const tmp = `${configPath}.s4d-tmp-${process.pid}`;
  let created = false;
  try {
    const file = await open(tmp, 'wx', 0o600);
    created = true;
    try { await file.writeFile(JSON.stringify(config, null, 2) + '\n', 'utf8'); }
    finally { await file.close(); }
    await rename(tmp, configPath);
  } finally {
    if (created) await rm(tmp, { force: true }).catch(() => {});
  }
}

function makeRequest(id, method, params = {}) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

async function smoke() {
  const child = spawn(process.execPath, [serverPath], {
    cwd: project,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  let overflow = false;
  let timedOut = false;
  child.stdout.on('data', chunk => {
    output += chunk.toString('utf8');
    if (output.length > 1_000_000) {
      overflow = true;
      child.kill();
    }
  });
  child.stderr.on('data', () => { /* never relay raw private errors */ });
  const completion = new Promise((resolveDone, reject) => {
    child.on('error', () => reject(Error('S4D_CHILD_START_FAILED')));
    child.on('close', code => resolveDone(code));
  });
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, 45_000);
  const input = [
    makeRequest(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'musse-s4d-smoke', version: '0.1.0' },
    }),
    makeRequest(2, 'tools/list'),
    makeRequest(3, 'tools/call', { name: 'task_query', arguments: {} }),
    makeRequest(4, 'tools/call', { name: 'task_create', arguments: {} }),
  ].join('\n') + '\n';
  child.stdin.on('error', () => {}); // child may exit early on invalid local config
  child.stdin.end(input);
  let exitCode;
  try { exitCode = await completion; }
  finally { clearTimeout(timer); }
  if (timedOut || overflow || exitCode !== 0) throw Error('S4D_SMOKE_PROCESS_FAILED');
  let replies;
  try {
    replies = output.trim().split(/\r?\n/).map(x => JSON.parse(x));
  } catch { throw Error('S4D_SMOKE_INVALID_MCP_RESPONSE'); }
  const byId = new Map(replies.map(x => [x.id, x]));
  if (byId.size !== 4) throw Error('S4D_SMOKE_MISSING_RESPONSES');
  const listed = byId.get(2)?.result?.tools;
  if (!Array.isArray(listed) || listed.length !== names.length ||
      names.some(name => !listed.some(tool => tool?.name === name))) {
    throw Error('S4D_SMOKE_TOOLS_MISMATCH');
  }
  const query = byId.get(3)?.result;
  if (query?.isError || !Array.isArray(query?.structuredContent?.data)) {
    throw Error('S4D_SMOKE_QUERY_FAILED');
  }
  if (byId.get(4)?.result?.isError !== true) {
    throw Error('S4D_SMOKE_WRITE_BLOCK_FAILED');
  }
  const tasks = query.structuredContent.data;
  if (tasks.some(task => !task || typeof task !== 'object' ||
      !['todo', 'done', 'archived'].includes(task.status))) {
    throw Error('S4D_SMOKE_TASK_SHAPE_INVALID');
  }
  console.log('S4D_MCP_SMOKE_OK');
  console.log(`tools=${listed.length}`);
  console.log(`total=${tasks.length}`);
  console.log(`todo=${tasks.filter(t => t.status === 'todo').length}`);
  console.log(`done=${tasks.filter(t => t.status === 'done').length}`);
  console.log('write_blocked=true');
}

async function install() {
  await smoke();
  const config = await getConfig();
  if (Object.hasOwn(config.mcpServers, serviceKey)) {
    throw Error('S4D_SERVICE_ALREADY_PRESENT');
  }
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const backup = `${configPath}.s4d-backup-${timestamp}.bak`;
  try { await copyFile(configPath, backup, fsConstants.COPYFILE_EXCL); }
  catch { throw Error('S4D_BACKUP_FAILED'); }
  config.mcpServers[serviceKey] = { command: process.execPath, args: [serverPath] };
  try { await writeConfig(config); }
  catch { throw Error('S4D_CONFIG_WRITE_FAILED_BACKUP_AVAILABLE'); }
  const verified = await getConfig();
  if (verified.mcpServers[serviceKey]?.args?.[0] !== serverPath) {
    throw Error('S4D_CONFIG_VERIFY_FAILED_BACKUP_AVAILABLE');
  }
  console.log('S4D_BRIDGE_ENTRY_INSTALLED');
  console.log('ORIGINAL_IWIKI_PRESERVED');
  console.log('PRIVATE_BACKUP_CREATED');
  console.log('NEXT_RESTART_XIAOZHI');
}

async function rollback() {
  const config = await getConfig();
  const current = config.mcpServers[serviceKey];
  if (current === undefined) { console.log('S4D_BRIDGE_ENTRY_ALREADY_ABSENT'); return; }
  if (current?.args?.[0] !== serverPath || basename(current.command ?? '') !== basename(process.execPath)) {
    throw Error('S4D_SERVICE_ENTRY_CHANGED_REFUSING_ROLLBACK');
  }
  delete config.mcpServers[serviceKey];
  await writeConfig(config);
  console.log('S4D_BRIDGE_ENTRY_REMOVED');
  console.log('ORIGINAL_IWIKI_PRESERVED');
  console.log('NEXT_RESTART_XIAOZHI');
}

async function main() {
  assertNode();
  const mode = process.argv[2];
  if (process.argv.length !== 3) throw Error('USAGE_EXPECT_ONE_MODE');
  if (mode === '--smoke') return smoke();
  if (mode === '--install') return install();
  if (mode === '--rollback') return rollback();
  if (mode === '--status') {
    const config = await getConfig();
    console.log(Object.hasOwn(config.mcpServers, serviceKey)
      ? 'S4D_BRIDGE_ENTRY_PRESENT' : 'S4D_BRIDGE_ENTRY_ABSENT');
    console.log('ORIGINAL_IWIKI_PRESERVED');
    return;
  }
  throw Error('USAGE_EXPECT_ONE_MODE');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const safe = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message : 'S4D_OPERATION_FAILED';
    process.stderr.write(safe + '\n');
    process.exitCode = 1;
  });
}
