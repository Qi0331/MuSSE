/** MuSSE S6 dedicated service installer. Zero remote iWiki writes. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const fail = code => { throw Error(code); };
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
try {
  if (process.argv.length !== 3 || process.argv[2] !== '--install') fail('S6_INSTALL_FLAG_REQUIRED');
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) fail('NODE_VERSION_TOO_OLD');
  const home = os.homedir();
  const dir = path.join(home, 'MuSSE-MCP-Local', 'musse-bridge');
  const configFile = path.join(dir, 'xiaozhi.config.json');
  const mappingFile = path.join(dir, 'musse-iwiki-readonly.json');
  const scopeFile = path.join(dir, 'musse-iwiki-s6-scope.json');
  const server = path.join(home, 'MuSSE-Lab', 'MuSSE-S6', 'software', 'musse-iwiki', 'src', 'mcp', 'server-s6-write.ts');
  const key = 'musse_iwiki_s6_goals';
  for (const f of [configFile, mappingFile, scopeFile, server]) if (!fs.existsSync(f)) fail('REQUIRED_FILE_MISSING');
  const raw = fs.readFileSync(configFile, 'utf8');
  const original = JSON.parse(raw);
  const servers = original?.mcpServers;
  if (!isObj(original) || !isObj(servers) || !/^wss:\/\//.test(original.mcpEndpoint ?? '')) fail('INVALID_CONFIG');
  if (servers.iwiki?.type !== 'http' || servers.iwiki.url !== 'https://ssemarket.cn/iwiki-api/mcp' ||
      !/^Bearer \S+$/.test(servers.iwiki.headers?.Authorization ?? '')) fail('INVALID_IWIKI');
  for (const name of ['musse_iwiki_readonly', 'musse_iwiki_s5_write']) {
    if (!isObj(servers[name]) || typeof servers[name].command !== 'string' ||
        !Array.isArray(servers[name].args) || servers[name].args.length === 0) fail('EXISTING_SERVICE_MISSING');
  }
  if (Object.hasOwn(servers, key)) fail('S6_ALREADY_PRESENT');
  const scope = JSON.parse(fs.readFileSync(scopeFile, 'utf8'));
  const mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
  if (scope?.mode !== 'space' || typeof scope.spaceId !== 'string' || !scope.spaceId ||
      !/^page-[A-Za-z0-9_-]{1,100}$/.test(mapping?.taskDocId ?? '')) fail('S6_PRIVATE_CONFIG_INVALID');
  const env = {
    MUSSE_S6_WRITE_ENABLED: '1',
    MUSSE_IWIKI_PRIVATE_CONFIG_FILE: configFile,
    MUSSE_IWIKI_PRIVATE_MAPPING_FILE: mappingFile,
    MUSSE_S6_SCOPE_FILE: scopeFile,
  };
  const input = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  ].map(x => JSON.stringify(x)).join('\n') + '\n';
  const smoke = spawnSync(process.execPath, [server], {
    input, encoding: 'utf8', timeout: 15000, maxBuffer: 65536,
    windowsHide: true, env: { ...process.env, ...env },
  });
  if (smoke.error || smoke.status !== 0) fail('S6_OFFLINE_SMOKE_FAILED');
  const replies = smoke.stdout.trim().split(/\r?\n/).map(x => JSON.parse(x));
  const names = replies.find(x => x.id === 2)?.result?.tools?.map(x => x.name);
  if (replies.length !== 2 || replies.find(x => x.id === 1)?.result?.serverInfo?.name !== 'musse-iwiki-s6-goals' ||
      JSON.stringify(names) !== JSON.stringify(['musse_goal_find','musse_goal_prepare','musse_goal_confirm','musse_goal_cancel']))
    fail('S6_OFFLINE_TOOLS_MISMATCH');
  const modified = { ...original, mcpServers: { ...servers, [key]: { command: process.execPath, args: [server], env } } };
  const withoutS6 = structuredClone(modified);
  delete withoutS6.mcpServers[key];
  if (JSON.stringify(withoutS6) !== JSON.stringify(original)) fail('EXISTING_CONFIG_CHANGED');
  if (fs.readFileSync(configFile, 'utf8') !== raw) fail('CONFIG_CHANGED_EXTERNALLY');
  const suffix = String(Date.now()) + '-' + String(process.pid);
  const backup = configFile + '.s6-safe-backup-' + suffix + '.bak';
  const temp = configFile + '.s6-safe-temp-' + suffix;
  fs.copyFileSync(configFile, backup, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(temp, JSON.stringify(modified, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const candidate = JSON.parse(fs.readFileSync(temp, 'utf8'));
  if (!isObj(candidate.mcpServers[key]) || Object.keys(candidate.mcpServers).length !== Object.keys(servers).length + 1)
    fail('S6_CANDIDATE_INVALID');
  fs.renameSync(temp, configFile);
  const applied = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (JSON.stringify(applied) !== JSON.stringify(modified)) fail('S6_INSTALL_VERIFY_FAILED');
  console.log('S6_INSTALL=SUCCESS');
  console.log('S6_OFFLINE_MCP_TOOLS=4');
  console.log('ORIGINAL_SERVICES_UNCHANGED=TRUE');
  console.log('PRIVATE_BACKUP_SAVED=TRUE');
  console.log('REMOTE_WRITES=0');
} catch (error) {
  const code = /^[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'S6_INSTALL_ABORTED';
  console.error(code);
  process.exitCode = 1;
}
