import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { installPreview, previewStatus, rollbackPreview } from "../tools/s5-preview-bridge.mjs";
import { handleS5VoiceRpc } from "../src/mcp/s5-voice-protocol.ts";
import { serveS5VoiceStdio } from "../src/mcp/server-s5.ts";
import { createS5VoiceFlow } from "../src/write/voice-flow.ts";
import { planS5Mutation } from "../src/write/plan-write.ts";
import { TASK_HEADER } from "../src/markdown/tasks.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const server = resolve(here, "../src/mcp/server-s5-preview.ts");
const token = "PRIVATE_TEST_TOKEN_NEVER_PRINT";
const privateId = "page-PRIVATE_EXAMPLE_NOT_REAL";
const config = {
  mcpServers: {
    iwiki: {
      type: "http", url: "https://ssemarket.cn/iwiki-api/mcp",
      headers: { Authorization: "Bearer " + token },
    },
    musse_iwiki_readonly: { command: "node", args: ["S4_UNCHANGED"] },
  },
};
const mapping = { taskDocId: privateId };
const rpc = (name, args) => ({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } });

test("S5-H preview bridge opt-in registration preserves both existing services and can roll back exactly", async () => {
  const dir = await mkdtemp(join(tmpdir(), "s5h-preview-"));
  const c = join(dir, "xiaozhi.config.json");
  const m = join(dir, "musse-iwiki-readonly.json");
  const runtime = "fake-node-runtime";
  const launch = "fake-preview-server.ts";
  try {
    await writeFile(c, JSON.stringify(config, null, 2));
    await writeFile(m, JSON.stringify(mapping));
    const original = JSON.parse(await readFile(c, "utf8"));
    assert.equal(await previewStatus(c, runtime, launch), "S5_PREVIEW_ABSENT");
    assert.equal(await installPreview(c, m, runtime, launch), "S5_PREVIEW_INSTALLED_RESTART_XIAOZHI");
    const after = JSON.parse(await readFile(c, "utf8"));
    assert.deepEqual(after.mcpServers.iwiki, original.mcpServers.iwiki);
    assert.deepEqual(after.mcpServers.musse_iwiki_readonly, original.mcpServers.musse_iwiki_readonly);
    assert.deepEqual(after.mcpServers.musse_iwiki_s5_preview, { command: runtime, args: [launch] });
    assert.equal(await previewStatus(c, runtime, launch), "S5_PREVIEW_PRESENT");
    const files = await readdir(dir);
    const backups = files.filter((f) => f.includes("s5-preview-backup-"));
    assert.equal(backups.length, 1);
    assert.deepEqual(JSON.parse(await readFile(join(dir, backups[0]), "utf8")), original);
    await assert.rejects(installPreview(c, m, runtime, launch), /S5_OTHER_SERVICE_PRESENT/);
    assert.equal(await rollbackPreview(c, runtime, launch), "S5_PREVIEW_REMOVED_RESTART_XIAOZHI");
    const restored = JSON.parse(await readFile(c, "utf8"));
    assert.deepEqual(restored, original);
    assert.equal(await rollbackPreview(c, runtime, launch), "S5_PREVIEW_ALREADY_ABSENT");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("S5-H preview bridge fails closed when S4 missing or private mapping missing, with no config changes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "s5h-fail-"));
  const c = join(dir, "xiaozhi.config.json");
  const m = join(dir, "musse-iwiki-readonly.json");
  try {
    await writeFile(c, JSON.stringify(config));
    const unchanged = await readFile(c, "utf8");
    await assert.rejects(installPreview(c, m), /S5_PRIVATE_CONFIG_UNAVAILABLE/);
    assert.equal(await readFile(c, "utf8"), unchanged);
    await writeFile(m, JSON.stringify(mapping));
    await writeFile(c, JSON.stringify({ mcpServers: { iwiki: config.mcpServers.iwiki } }));
    await assert.rejects(installPreview(c, m), /S5_PRESERVE_S4_PREREQUISITE_FAILED/);
    assert.equal((await readdir(dir)).some((f) => f.includes("backup")), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("S5-H real preview server process launches without write contract and refuses unlisted confirm", async () => {
  const dir = await mkdtemp(join(tmpdir(), "s5h-process-"));
  const c = join(dir, "xiaozhi.config.json");
  const m = join(dir, "musse-iwiki-readonly.json");
  try {
    await writeFile(c, JSON.stringify(config));
    await writeFile(m, JSON.stringify(mapping));
    const child = spawn(process.execPath, [server], {
      env: {
        ...process.env,
        MUSSE_IWIKI_PRIVATE_CONFIG_FILE: c,
        MUSSE_IWIKI_PRIVATE_MAPPING_FILE: m,
        MUSSE_S5_WRITE_ENABLED: "1", // preview entrypoint still must not expose confirm
        MUSSE_S5_WRITE_CONTRACT_FILE: join(dir, "missing-write-contract.json"),
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const output = [];
    child.stdout.on("data", (chunk) => output.push(chunk.toString()));
    child.stderr.on("data", () => {}); // Never expose private process failures.
    const exit = new Promise((resolveDone, reject) => {
      child.on("error", reject);
      child.on("close", resolveDone);
    });
    child.stdin.end([
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      JSON.stringify(rpc("musse_write_confirm", { operationId: "forged", spokenText: "确认写入" })),
    ].join("\n") + "\n");
    const timer = setTimeout(() => child.kill(), 10000);
    let exitCode;
    try { exitCode = await exit; } finally { clearTimeout(timer); }
    assert.equal(exitCode, 0);
    const replies = output.join("").trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.equal(replies.length, 3);
    assert.deepEqual(replies[1].result.tools.map((t) => t.name), ["musse_write_prepare", "musse_write_cancel"]);
    assert.deepEqual(replies[2].result.structuredContent, { ok: false, code: "S5_PREVIEW_ONLY" });
    assert.equal(replies[2].result.isError, true);
    assert.equal(output.join("").includes(token), false);
    assert.equal(output.join("").includes(privateId), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("S5-H preview MCP can prepare and cancel with a read-only port; explicit confirm cannot write", async () => {
  const original = [
    "# 任务总表",
    "| " + TASK_HEADER.join(" | ") + " |",
    "| " + TASK_HEADER.map(() => "---").join(" | ") + " |",
    "| T-001 | 语音预览测试 | 说明 | 学习 | P2 | todo | 2026-11-05 |  |  |  | 2026-11-04 10:00 |  |",
  ].join("\n");
  let reads = 0;
  const port = {
    supportsAtomicConditionalWrite: false,
    async read() { reads++; return { content: original, revision: "" }; },
    async compareAndWrite() { throw Error("CANNOT_WRITE"); },
  };
  const flow = createS5VoiceFlow(port, planS5Mutation, {
    clock: () => Date.parse("2026-11-04T09:00:00Z"),
  });
  const options = { previewOnly: true };
  const prepare = await handleS5VoiceRpc(flow, rpc("musse_write_prepare", {
    intent: { type: "task_complete", taskId: "T-001" },
  }), options);
  const content = prepare?.result?.structuredContent;
  assert.match(content.preview, /完成任务/);
  assert.equal(reads, 1);
  const forced = await handleS5VoiceRpc(flow, rpc("musse_write_confirm", {
    operationId: content.operationId, spokenText: "确认写入",
  }), options);
  assert.deepEqual(forced?.result?.structuredContent, { ok: false, code: "S5_PREVIEW_ONLY" });
  assert.equal(reads, 1);
  const cancel = await handleS5VoiceRpc(flow, rpc("musse_write_cancel", {
    operationId: content.operationId,
  }), options);
  assert.deepEqual(cancel?.result?.structuredContent, { canceled: true });
  assert.equal(reads, 1);
  const output = [];
  const writer = new Writable({ write(c, _e, done) { output.push(String(c)); done(); } });
  await serveS5VoiceStdio(flow, Readable.from([JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/list" }) + "\n"]), writer, options);
  assert.equal(JSON.parse(output.join("")).result.tools.length, 2);
});
