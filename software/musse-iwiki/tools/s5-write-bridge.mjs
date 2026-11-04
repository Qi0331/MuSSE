/**
 * Opt-in, one-command Windows S5 voice WRITE installer.
 * Exact existing iWiki + S4 services remain unchanged. We add only an S5 key.
 * Creates the verified nonsecret edit_doc field contract if absent, locally.
 * Never invokes iWiki MCP tools, never prints raw config, tokens or page IDs.
 *
 * node tools/s5-write-bridge.mjs --install-write | --status | --rollback-write
 */
import { spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { copyFile, open, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(scriptDir, "../src/mcp/server-s5-write.ts");
const privateDir = join(homedir(), "MuSSE-MCP-Local", "musse-bridge");
const configFile = join(privateDir, "xiaozhi.config.json");
const mappingFile = join(privateDir, "musse-iwiki-readonly.json");
const contractFile = join(privateDir, "musse-iwiki-write.json");
const serviceKey = "musse_iwiki_s5_write";
const endpoint = "https://ssemarket.cn/iwiki-api/mcp";
const PAGE_ID = /^page-[A-Za-z0-9_-]{1,100}$/;
const expectedContract = Object.freeze({
  toolName: "edit_doc", documentIdArgument: "doc_id", contentArgument: "content",
});
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

function configServers(config) {
  const servers = config?.mcpServers;
  if (!object(servers) || !object(servers.iwiki) ||
      servers.iwiki.type !== "http" || servers.iwiki.url !== endpoint ||
      typeof servers.iwiki.headers?.Authorization !== "string" ||
      !/^Bearer [^\s]+$/.test(servers.iwiki.headers.Authorization) ||
      !object(servers.musse_iwiki_readonly)) {
    throw Error("S5_ORIGINAL_SERVICES_NOT_CONFIRMED");
  }
  return servers;
}

function validateMapping(mapping) {
  if (!object(mapping) || !PAGE_ID.test(mapping.taskDocId) ||
      (mapping.notesDocId !== undefined && !PAGE_ID.test(mapping.notesDocId))) {
    throw Error("S5_PRIVATE_MAPPING_INVALID");
  }
  if (mapping.notesDocId !== undefined && mapping.taskDocId === mapping.notesDocId) {
    throw Error("S5_PRIVATE_MAPPING_INVALID");
  }
  return mapping.notesDocId !== undefined;
}

function validateContract(contract) {
  if (!object(contract) ||
      Object.keys(contract).sort().join(",") !== "contentArgument,documentIdArgument,toolName" ||
      Object.entries(expectedContract).some(([k, v]) => contract[k] !== v)) {
    throw Error("S5_PRIVATE_WRITE_CONTRACT_CONFLICT");
  }
}

async function loadJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { throw Error("S5_PRIVATE_FILE_UNAVAILABLE"); }
}

async function readRaw(path) {
  try { return await readFile(path, "utf8"); }
  catch { throw Error("S5_PRIVATE_FILE_UNAVAILABLE"); }
}

function exactEntry(entry, runtime, server) {
  return object(entry) && entry.command === runtime &&
    Array.isArray(entry.args) && entry.args.length === 1 &&
    entry.args[0] === server && Object.keys(entry).sort().join(",") === "args,command";
}

async function writePrivateJson(path, value) {
  const f = await open(path, "wx", 0o600);
  try { await f.writeFile(JSON.stringify(value, null, 2) + "\n", "utf8"); }
  finally { await f.close(); }
}

async function replaceConfig(path, config) {
  const temp = path + ".s5-write-tmp-" + process.pid;
  let created = false;
  try {
    const f = await open(temp, "wx", 0o600);
    created = true;
    try { await f.writeFile(JSON.stringify(config, null, 2) + "\n", "utf8"); }
    finally { await f.close(); }
    await rename(temp, path);
  } finally {
    if (created) await rm(temp, { force: true }).catch(() => {});
  }
}

/**
 * Smoke is offline: mainWrite only loads local JSON and creates an MCP client.
 * Send initialize/tools/list ONLY. Do not issue prepare, confirm or edit_doc.
 */
function smokeWriteProcess(runtime, server, configPath, mappingPath, writeContractPath) {
  const input = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
  ].join("\n") + "\n";
  const run = spawnSync(runtime, [server], {
    input, timeout: 12000, maxBuffer: 128000, windowsHide: true,
    env: {
      ...process.env,
      MUSSE_IWIKI_PRIVATE_CONFIG_FILE: configPath,
      MUSSE_IWIKI_PRIVATE_MAPPING_FILE: mappingPath,
      MUSSE_S5_WRITE_CONTRACT_FILE: writeContractPath,
      MUSSE_S5_WRITE_ENABLED: "1",
    },
    encoding: "utf8",
  });
  if (run.status !== 0 || run.error) throw Error("S5_WRITE_OFFLINE_SMOKE_FAILED");
  try {
    const replies = run.stdout.trim().split(/\r?\n/).map(JSON.parse);
    const tools = replies.find((x) => x.id === 2)?.result?.tools;
    if (replies.length !== 2 ||
        replies.find((x) => x.id === 1)?.result?.serverInfo?.name !== "musse-iwiki-voice-write" ||
        !Array.isArray(tools) ||
        tools.map((x) => x.name).join(",") !==
          "musse_write_prepare,musse_write_confirm,musse_write_cancel") {
      throw Error("S5_WRITE_OFFLINE_SMOKE_FAILED");
    }
  } catch { throw Error("S5_WRITE_OFFLINE_SMOKE_FAILED"); }
}

export async function installWrite(configPath, mappingPath, writeContractPath,
  runtime = process.execPath, server = serverPath, options = {}) {
  const originalRaw = await readRaw(configPath);
  let config;
  try { config = JSON.parse(originalRaw); }
  catch { throw Error("S5_PRIVATE_FILE_UNAVAILABLE"); }
  const servers = configServers(config);
  const notesMapped = validateMapping(await loadJson(mappingPath));
  if (Object.hasOwn(servers, serviceKey)) {
    if (exactEntry(servers[serviceKey], runtime, server)) {
      validateContract(await loadJson(writeContractPath));
      return "S5_WRITE_ALREADY_INSTALLED";
    }
    throw Error("S5_WRITE_ENTRY_ALREADY_PRESENT");
  }
  // Never silently leave two competing S5 conversational services enabled.
  if (Object.keys(servers).some((key) => /^musse.*(?:s5|voice.*write)/i.test(key))) {
    throw Error("S5_OTHER_VOICE_SERVICE_PRESENT");
  }
  let madeContract = false;
  let backup;
  try {
    try {
      validateContract(await loadJson(writeContractPath));
    } catch (error) {
      if (error?.message !== "S5_PRIVATE_FILE_UNAVAILABLE") throw error;
      try {
        await writePrivateJson(writeContractPath, expectedContract);
        madeContract = true;
      } catch (createError) {
        if (createError?.code === "EEXIST") {
          validateContract(await loadJson(writeContractPath));
        } else {
          throw Error("S5_PRIVATE_WRITE_CONTRACT_CREATE_FAILED");
        }
      }
    }
    // Tests may inject a fake runtime/server and choose not to spawn a child.
    // Production CLI never sets skipSmoke.
    if (!options.skipSmoke) {
      smokeWriteProcess(runtime, server, configPath, mappingPath, writeContractPath);
    }
    // Before touching private config, verify no other process edited it.
    if (await readRaw(configPath) !== originalRaw) throw Error("S5_BRIDGE_CHANGED_DURING_INSTALL");
    backup = configPath + ".s5-write-backup-" +
      new Date().toISOString().replace(/[-:.TZ]/g, "") + "-" + process.pid + ".bak";
    try { await copyFile(configPath, backup, fsConstants.COPYFILE_EXCL); }
    catch { throw Error("S5_PRIVATE_BACKUP_FAILED"); }
    servers[serviceKey] = { command: runtime, args: [server] };
    try { await replaceConfig(configPath, config); }
    catch { throw Error("S5_WRITE_INSTALL_FAILED_BACKUP_AVAILABLE"); }
    const updated = await loadJson(configPath);
    const afterServers = configServers(updated);
    if (!exactEntry(afterServers[serviceKey], runtime, server)) {
      throw Error("S5_WRITE_VERIFY_FAILED_BACKUP_AVAILABLE");
    }
    return notesMapped ? "S5_WRITE_INSTALLED_TASKS_AND_NOTES_RESTART_XIAOZHI" :
      "S5_WRITE_INSTALLED_TASKS_ONLY_RESTART_XIAOZHI";
  } catch (error) {
    // If nothing has been registered, do not leave behind a half-created contract.
    // If a backup exists, preserve it for manual recovery.
    if (!backup && madeContract) await rm(writeContractPath, { force: true }).catch(() => {});
    throw error;
  }
}

export async function rollbackWrite(configPath, runtime = process.execPath, server = serverPath) {
  const config = await loadJson(configPath);
  const servers = configServers(config);
  if (!Object.hasOwn(servers, serviceKey)) return "S5_WRITE_ALREADY_ABSENT";
  if (!exactEntry(servers[serviceKey], runtime, server)) {
    throw Error("S5_WRITE_ENTRY_CHANGED_REFUSING_ROLLBACK");
  }
  delete servers[serviceKey];
  await replaceConfig(configPath, config);
  return "S5_WRITE_REMOVED_RESTART_XIAOZHI";
}

export async function writeStatus(configPath, runtime = process.execPath, server = serverPath) {
  const servers = configServers(await loadJson(configPath));
  if (!Object.hasOwn(servers, serviceKey)) return "S5_WRITE_ABSENT";
  return exactEntry(servers[serviceKey], runtime, server)
    ? "S5_WRITE_PRESENT" : "S5_WRITE_ENTRY_UNEXPECTED";
}

async function main(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === "--help")) {
    process.stdout.write(
      "Usage: node tools/s5-write-bridge.mjs --install-write | --status | --rollback-write\n" +
      "Explicit install adds a third writable MCP service, private field contract and backup. " +
      "It does not call remote iWiki. Requires fresh user confirmation for each mutation.\n",
    );
    return;
  }
  if (args.length !== 1) throw Error("S5_WRITE_USAGE_INVALID");
  if (args[0] === "--install-write") {
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major < 22 || (major === 22 && minor < 18)) throw Error("NODE_VERSION_TOO_OLD");
    process.stdout.write(
      await installWrite(configFile, mappingFile, contractFile) + "\n",
    );
    return;
  }
  if (args[0] === "--status") {
    process.stdout.write(await writeStatus(configFile) + "\n");
    return;
  }
  if (args[0] === "--rollback-write") {
    process.stdout.write(await rollbackWrite(configFile) + "\n");
    return;
  }
  throw Error("S5_WRITE_USAGE_INVALID");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : "";
    const safe = /^S5_[A-Z0-9_]+$|^NODE_VERSION_TOO_OLD$/.test(message)
      ? message : "S5_WRITE_OPERATION_FAILED";
    process.stderr.write(safe + "\n");
    process.exitCode = 1;
  });
}
