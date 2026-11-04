/**
 * One-time local S5 service path repair: old MuSSE-S5F -> current MuSSE-S6.
 * Never contacts iWiki or emits user config, page IDs, or secrets.
 * Stop xiaozhi before use. --plan / --apply / --verify.
 */
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const scriptPath = fileURLToPath(import.meta.url);
const targetPath = resolve(dirname(scriptPath), "../src/mcp/server-s5-write.ts");
const configPath = join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
const oldPattern = /[\\/]MuSSE-S5F[\\/]software[\\/]musse-iwiki[\\/]src[\\/]mcp[\\/]server-s5-write\.ts$/i;
const newPattern = /[\\/]MuSSE-S6[\\/]software[\\/]musse-iwiki[\\/]src[\\/]mcp[\\/]server-s5-write\.ts$/i;
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const sameWinPath = (a, b) => win32.normalize(a).toLowerCase() === win32.normalize(b).toLowerCase();
const stop = (code) => { throw new Error(code); };

/** Pure planner; do not change any MCP service other than S5's exact args[0]. */
export function planS5Repoint(config, expectedScript, expectedNode) {
  const servers = config?.mcpServers;
  if (!isObj(servers) || !isObj(servers.iwiki) ||
      !isObj(servers.musse_iwiki_readonly) || !isObj(servers.musse_iwiki_s6_goals))
    stop("S5_REPOINT_SCOPE_UNVERIFIED");
  if (typeof expectedScript !== "string" || !newPattern.test(expectedScript) ||
      typeof expectedNode !== "string") stop("S5_REPOINT_TARGET_UNVERIFIED");
  const entry = servers.musse_iwiki_s5_write;
  if (!isObj(entry) || Object.keys(entry).sort().join(",") !== "args,command" ||
      typeof entry.command !== "string" ||
      !sameWinPath(entry.command, expectedNode) ||
      !Array.isArray(entry.args) || entry.args.length !== 1 ||
      typeof entry.args[0] !== "string") stop("S5_REPOINT_ENTRY_UNVERIFIED");
  if (sameWinPath(entry.args[0], expectedScript))
    return { state: "ALREADY_CURRENT", updated: config };
  if (!oldPattern.test(entry.args[0])) stop("S5_REPOINT_OLD_PATH_UNEXPECTED");
  const updated = JSON.parse(JSON.stringify(config));
  updated.mcpServers.musse_iwiki_s5_write.args[0] = expectedScript;
  return { state: "READY", updated };
}

async function readConfig(path) {
  let raw, config;
  try { raw = await readFile(path, "utf8"); }
  catch { stop("S5_REPOINT_CONFIG_UNREADABLE"); }
  try { config = JSON.parse(raw); }
  catch { stop("S5_REPOINT_CONFIG_NOT_JSON"); }
  return { raw, config };
}

async function verifySource() {
  let voice, launcher;
  try {
    voice = await readFile(resolve(dirname(scriptPath), "../src/write/voice-flow.ts"), "utf8");
    launcher = await readFile(targetPath, "utf8");
  } catch { stop("S5_REPOINT_SOURCE_UNREADABLE"); }
  if (!voice.includes("/^确认(?:写入|保存)?[。.!！]?$/u.test(spokenText.trim())") ||
      !launcher.includes("buildS5VoiceFlow"))
    stop("S5_REPOINT_NEW_CODE_UNVERIFIED");
}

async function main(args) {
  if (args.length !== 1 || !["--plan", "--apply", "--verify"].includes(args[0]))
    stop("S5_REPOINT_USAGE");
  if (process.platform !== "win32") stop("S5_REPOINT_WINDOWS_ONLY");
  await verifySource();
  const before = await readConfig(configPath);
  const plan = planS5Repoint(before.config, targetPath, process.execPath);
  if (args[0] === "--plan") {
    process.stdout.write("S5_REPOINT_" + plan.state + "; remoteWrites=0\n");
    return;
  }
  if (args[0] === "--verify") {
    if (plan.state !== "ALREADY_CURRENT") stop("S5_REPOINT_NOT_APPLIED");
    process.stdout.write("S5_REPOINT_PATH_VERIFIED; remoteWrites=0\n");
    return;
  }
  if (plan.state === "ALREADY_CURRENT") {
    process.stdout.write("S5_REPOINT_ALREADY_CURRENT; remoteWrites=0\n");
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let phrase = "";
  try {
    phrase = await rl.question("仅切换 S5 启动路径，保留其他服务。输入「确认修复S5路径」：\n> ");
  } finally { rl.close(); }
  if (phrase.trim() !== "确认修复S5路径") stop("S5_REPOINT_CANCELED");
  if ((await readConfig(configPath)).raw !== before.raw)
    stop("S5_REPOINT_CONFIG_CHANGED");

  // Private backup and exact content verification before writing.
  const backup = configPath + ".s5-repoint-backup-" + Date.now() + "-" + randomUUID().slice(0, 8);
  await copyFile(configPath, backup, constants.COPYFILE_EXCL);
  if (await readFile(backup, "utf8") !== before.raw)
    stop("S5_REPOINT_BACKUP_FAILED");
  const temp = configPath + ".s5-repoint-temp-" + process.pid + "-" + randomUUID().slice(0, 8);
  let pendingTemp = false;
  try {
    await writeFile(temp, JSON.stringify(plan.updated, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    pendingTemp = true;
    const staged = await readConfig(temp);
    if (planS5Repoint(staged.config, targetPath, process.execPath).state !== "ALREADY_CURRENT")
      stop("S5_REPOINT_STAGING_FAILED");
    if ((await readConfig(configPath)).raw !== before.raw)
      stop("S5_REPOINT_CONFIG_CHANGED");
    await rename(temp, configPath);
    pendingTemp = false;
    const after = await readConfig(configPath);
    if (JSON.stringify(after.config) !== JSON.stringify(plan.updated))
      stop("S5_REPOINT_READBACK_UNCERTAIN");
  } finally {
    if (pendingTemp) await rm(temp, { force: true }).catch(() => {});
  }
  process.stdout.write("S5_REPOINT_VERIFIED; privateBackupSaved=true; otherServicesPreserved=true; remoteWrites=0\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main(process.argv.slice(2)).catch((error) => {
    const code = /^S5_REPOINT_[A-Z0-9_]+$/.test(error?.message ?? "") ?
      error.message : "S5_REPOINT_FAILED_NO_AUTO_RETRY";
    process.stderr.write(code + "\n");
    process.exitCode = 1;
  });
