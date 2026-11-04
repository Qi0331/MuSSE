import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { installWrite, rollbackWrite, writeStatus } from "../tools/s5-write-bridge.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const server = resolve(here, "../src/mcp/server-s5-write.ts");
const SECRET = "NEVER_PRINT_PRIVATE_S5_TEST_TOKEN";
const TASK_ID = "page-TEST_S5_PRIVATE_TASK";
const baseConfig = {
  mcpServers: {
    iwiki: {
      type: "http",
      url: "https://ssemarket.cn/iwiki-api/mcp",
      headers: { Authorization: "Bearer " + SECRET },
    },
    musse_iwiki_readonly: { command: "node", args: ["EXISTING_S4_PATH"] },
  },
};
const mapping = { taskDocId: TASK_ID };
const contract = {
  toolName: "edit_doc",
  documentIdArgument: "doc_id",
  contentArgument: "content",
};

async function tempPrivate() {
  const dir = await mkdtemp(join(tmpdir(), "musse-s5-write-install-"));
  const paths = {
    dir,
    config: join(dir, "xiaozhi.config.json"),
    mapping: join(dir, "musse-iwiki-readonly.json"),
    contract: join(dir, "musse-iwiki-write.json"),
  };
  await writeFile(paths.config, JSON.stringify(baseConfig, null, 2));
  await writeFile(paths.mapping, JSON.stringify(mapping));
  return paths;
}

test("S5-I one-command install creates verified contract, adds writable service without replacing original/S4, then rolls back", async () => {
  const p = await tempPrivate();
  try {
    const before = JSON.parse(await readFile(p.config, "utf8"));
    assert.equal(await writeStatus(p.config), "S5_WRITE_ABSENT");
    const status = await installWrite(p.config, p.mapping, p.contract);
    assert.equal(status, "S5_WRITE_INSTALLED_TASKS_ONLY_RESTART_XIAOZHI");
    assert.deepEqual(JSON.parse(await readFile(p.contract, "utf8")), contract);
    const after = JSON.parse(await readFile(p.config, "utf8"));
    assert.deepEqual(after.mcpServers.iwiki, before.mcpServers.iwiki);
    assert.deepEqual(after.mcpServers.musse_iwiki_readonly, before.mcpServers.musse_iwiki_readonly);
    assert.deepEqual(after.mcpServers.musse_iwiki_s5_write,
      { command: process.execPath, args: [server] });
    assert.equal(await writeStatus(p.config), "S5_WRITE_PRESENT");
    assert.equal(await installWrite(p.config, p.mapping, p.contract), "S5_WRITE_ALREADY_INSTALLED");
    const backups = (await readdir(p.dir)).filter((s) => s.includes(".s5-write-backup-"));
    assert.equal(backups.length, 1);
    assert.deepEqual(JSON.parse(await readFile(join(p.dir, backups[0]), "utf8")), before);
    assert.equal(await rollbackWrite(p.config), "S5_WRITE_REMOVED_RESTART_XIAOZHI");
    assert.deepEqual(JSON.parse(await readFile(p.config, "utf8")), before);
    assert.equal(await rollbackWrite(p.config), "S5_WRITE_ALREADY_ABSENT");
    assert.equal(JSON.stringify(after).includes(SECRET), true); // remains local, not logged
  } finally { await rm(p.dir, { recursive: true, force: true }); }
});

test("S5-I actual writable server subprocess exposes prepare/confirm/cancel from private contract without network calls", async () => {
  const p = await tempPrivate();
  try {
    await writeFile(p.contract, JSON.stringify(contract));
    const rpc = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: {
        name: "musse_write_confirm", arguments: { operationId: "not-prepared", spokenText: "确认写入" },
      } },
    ];
    const child = spawnSync(process.execPath, [server], {
      input: rpc.map((x) => JSON.stringify(x)).join("\n") + "\n",
      encoding: "utf8", windowsHide: true, timeout: 12000,
      env: {
        ...process.env,
        MUSSE_IWIKI_PRIVATE_CONFIG_FILE: p.config,
        MUSSE_IWIKI_PRIVATE_MAPPING_FILE: p.mapping,
        MUSSE_S5_WRITE_CONTRACT_FILE: p.contract,
        // Explicitly no write flag: the opt-in launcher enables its own child only.
        MUSSE_S5_WRITE_ENABLED: "",
      },
    });
    assert.equal(child.status, 0);
    const answers = child.stdout.trim().split(/\r?\n/).map((s) => JSON.parse(s));
    assert.equal(answers.length, 3);
    assert.deepEqual(answers[1].result.tools.map((x) => x.name),
      ["musse_write_prepare", "musse_write_confirm", "musse_write_cancel"]);
    assert.deepEqual(answers[2].result.structuredContent,
      { ok: false, code: "S5_UNKNOWN_PROPOSAL" });
    assert.equal(answers[2].result.isError, true);
    assert.equal(child.stdout.includes(SECRET), false);
    assert.equal(child.stdout.includes(TASK_ID), false);
    assert.equal(child.stderr.includes(SECRET), false);
    assert.equal(child.stderr.includes(TASK_ID), false);
  } finally { await rm(p.dir, { recursive: true, force: true }); }
});

test("S5-I invalid or missing private mapping fails without registering writer or adding contract", async () => {
  const p = await tempPrivate();
  try {
    const original = await readFile(p.config, "utf8");
    await writeFile(p.mapping, JSON.stringify({ taskDocId: "../unsafe" }));
    await assert.rejects(installWrite(p.config, p.mapping, p.contract), /S5_PRIVATE_MAPPING_INVALID/);
    assert.equal(await readFile(p.config, "utf8"), original);
    assert.equal((await readdir(p.dir)).some((s) => s.includes("write.json")), false);
    await rm(p.mapping);
    await assert.rejects(installWrite(p.config, p.mapping, p.contract), /S5_PRIVATE_FILE_UNAVAILABLE/);
  } finally { await rm(p.dir, { recursive: true, force: true }); }
});

test("S5-I refuses conflicting write contract or preview service instead of overwriting private config", async () => {
  const p = await tempPrivate();
  try {
    const original = await readFile(p.config, "utf8");
    await writeFile(p.contract, JSON.stringify({ ...contract, contentArgument: "wrong" }));
    await assert.rejects(installWrite(p.config, p.mapping, p.contract), /S5_PRIVATE_WRITE_CONTRACT_CONFLICT/);
    assert.equal(await readFile(p.config, "utf8"), original);
    await writeFile(p.contract, JSON.stringify(contract));
    const config = structuredClone(baseConfig);
    config.mcpServers.musse_iwiki_s5_preview = { command: "node", args: ["preview"] };
    await writeFile(p.config, JSON.stringify(config));
    await assert.rejects(installWrite(p.config, p.mapping, p.contract), /S5_OTHER_VOICE_SERVICE_PRESENT/);
    assert.deepEqual(JSON.parse(await readFile(p.config, "utf8")), config);
  } finally { await rm(p.dir, { recursive: true, force: true }); }
});

test("S5-I notes mapping is optional, but when present the writer announces both targets", async () => {
  const p = await tempPrivate();
  try {
    await writeFile(p.mapping, JSON.stringify({ taskDocId: TASK_ID, notesDocId: "page-TEST_NOTES" }));
    assert.equal(await installWrite(p.config, p.mapping, p.contract),
      "S5_WRITE_INSTALLED_TASKS_AND_NOTES_RESTART_XIAOZHI");
  } finally { await rm(p.dir, { recursive: true, force: true }); }
});
