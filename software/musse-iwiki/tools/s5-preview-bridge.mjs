/**
 * S5 voice preview launcher registration for xiaozhi on Windows.
 * --install-preview must be run explicitly. No write mode is installed.
 * This changes only a NEW third service key, keeps original/S4 entries,
 * backs up the configuration, and never prints private values or paths.
 */
import { constants as fsConstants } from "node:fs";
import { copyFile, open, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(scriptDir, "../src/mcp/server-s5-preview.ts");
const privateDir = join(homedir(), "MuSSE-MCP-Local", "musse-bridge");
const configFile = join(privateDir, "xiaozhi.config.json");
const mappingFile = join(privateDir, "musse-iwiki-readonly.json");
const serviceKey = "musse_iwiki_s5_preview";
const officialEndpoint = "https://ssemarket.cn/iwiki-api/mcp";

const object = (x) => x && typeof x === "object" && !Array.isArray(x);

function verifiedConfig(config) {
  const servers = config?.mcpServers;
  if (!object(servers) || !object(servers.iwiki) ||
      servers.iwiki.type !== "http" || servers.iwiki.url !== officialEndpoint ||
      typeof servers.iwiki.headers?.Authorization !== "string" ||
      !/^Bearer [^\s]+$/.test(servers.iwiki.headers.Authorization) ||
      !object(servers.musse_iwiki_readonly)) {
    throw Error("S5_PRESERVE_S4_PREREQUISITE_FAILED");
  }
  return servers;
}

function verifiedMapping(mapping) {
  if (!object(mapping) || typeof mapping.taskDocId !== "string" ||
      !/^page-[A-Za-z0-9_-]{1,100}$/.test(mapping.taskDocId) ||
      (mapping.notesDocId !== undefined &&
        (typeof mapping.notesDocId !== "string" ||
         !/^page-[A-Za-z0-9_-]{1,100}$/.test(mapping.notesDocId)))) {
    throw Error("S5_PRIVATE_READ_MAPPING_INVALID");
  }
}

async function loadJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { throw Error("S5_PRIVATE_CONFIG_UNAVAILABLE"); }
}

function exactEntry(entry, runtime, server) {
  return object(entry) && entry.command === runtime &&
    Array.isArray(entry.args) && entry.args.length === 1 &&
    entry.args[0] === server && Object.keys(entry).sort().join(",") === "args,command";
}

async function atomicConfig(path, config) {
  const tmp = path + ".s5-preview-tmp-" + process.pid;
  let made = false;
  try {
    const f = await open(tmp, "wx", 0o600);
    made = true;
    try { await f.writeFile(JSON.stringify(config, null, 2) + "\n", "utf8"); }
    finally { await f.close(); }
    await rename(tmp, path);
  } finally {
    if (made) await rm(tmp, { force: true }).catch(() => {});
  }
}

export async function installPreview(configPath, mappingPath, runtime = process.execPath, server = serverPath) {
  const config = await loadJson(configPath);
  const servers = verifiedConfig(config);
  verifiedMapping(await loadJson(mappingPath));
  if (Object.hasOwn(servers, serviceKey) ||
      Object.keys(servers).some((key) =>
        key !== serviceKey && /^musse.*(?:s5|voice.*write)/i.test(key))) {
    throw Error("S5_OTHER_SERVICE_PRESENT");
  }
  const backup = configPath + ".s5-preview-backup-" + new Date().toISOString().replace(/[-:.TZ]/g, "") + ".bak";
  try { await copyFile(configPath, backup, fsConstants.COPYFILE_EXCL); }
  catch { throw Error("S5_PRIVATE_BACKUP_FAILED"); }
  servers[serviceKey] = { command: runtime, args: [server] };
  try { await atomicConfig(configPath, config); }
  catch { throw Error("S5_PREVIEW_INSTALL_FAILED_BACKUP_AVAILABLE"); }
  const updated = await loadJson(configPath);
  verifiedConfig(updated);
  if (!exactEntry(updated.mcpServers[serviceKey], runtime, server)) {
    throw Error("S5_PREVIEW_VERIFY_FAILED_BACKUP_AVAILABLE");
  }
  return "S5_PREVIEW_INSTALLED_RESTART_XIAOZHI";
}

export async function rollbackPreview(configPath, runtime = process.execPath, server = serverPath) {
  const config = await loadJson(configPath);
  const servers = verifiedConfig(config);
  if (!Object.hasOwn(servers, serviceKey)) return "S5_PREVIEW_ALREADY_ABSENT";
  if (!exactEntry(servers[serviceKey], runtime, server)) {
    throw Error("S5_PREVIEW_ENTRY_CHANGED_REFUSING_ROLLBACK");
  }
  delete servers[serviceKey];
  await atomicConfig(configPath, config);
  return "S5_PREVIEW_REMOVED_RESTART_XIAOZHI";
}

export async function previewStatus(configPath, runtime = process.execPath, server = serverPath) {
  const servers = verifiedConfig(await loadJson(configPath));
  if (!Object.hasOwn(servers, serviceKey)) return "S5_PREVIEW_ABSENT";
  return exactEntry(servers[serviceKey], runtime, server)
    ? "S5_PREVIEW_PRESENT" : "S5_PREVIEW_ENTRY_UNEXPECTED";
}

async function main(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
    process.stdout.write("Usage: node tools/s5-preview-bridge.mjs --install-preview | --status | --rollback-preview\n" +
      "No argument: inert help. Explicit preview install backs up private config and preserves iWiki+S4; no write capability.\n");
    return;
  }
  if (args.length !== 1) throw Error("S5_PREVIEW_USAGE_INVALID");
  if (args[0] === "--status") {
    process.stdout.write(await previewStatus(configFile) + "\n"); return;
  }
  if (args[0] === "--install-preview") {
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major < 22 || (major === 22 && minor < 18)) throw Error("NODE_VERSION_TOO_OLD");
    process.stdout.write(await installPreview(configFile, mappingFile) + "\n"); return;
  }
  if (args[0] === "--rollback-preview") {
    process.stdout.write(await rollbackPreview(configFile) + "\n"); return;
  }
  throw Error("S5_PREVIEW_USAGE_INVALID");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    const safe = error instanceof Error && /^S5_[A-Z0-9_]+$|^NODE_VERSION_TOO_OLD$/.test(error.message)
      ? error.message : "S5_PREVIEW_OPERATION_FAILED";
    process.stderr.write(safe + "\n");
    process.exitCode = 1;
  });
}
