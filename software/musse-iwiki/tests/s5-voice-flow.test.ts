import assert from "node:assert/strict";
import test from "node:test";
import { createS5VoiceFlow } from "../src/write/voice-flow.ts";
import { S5GateError } from "../src/write/guarded-write.ts";
import type { S5AtomicPort, S5Planner } from "../src/write/guarded-write.ts";

const intent = { type: "task_complete", taskId: "T-001" };
const fail = (code: string) => (e: unknown) => e instanceof S5GateError && e.code === code;

function fixture() {
  let content = "original";
  let writes = 0;
  const port: S5AtomicPort = {
    supportsAtomicConditionalWrite: false,
    async read() { return { content, revision: "" }; },
    async compareAndWrite() { throw new Error("unavailable"); },
    async writeWithoutCondition(_document, next) { writes++; content = next; },
  };
  const planner: S5Planner = (_action, before) => ({ content: before + ":done", preview: "把 T-001 标记为完成" });
  return {
    port, planner,
    get writes() { return writes; },
    get content() { return content; },
    webEdit(next: string) { content = next; },
  };
}

test("S5-E two-turn flow requires an explicit phrase and never writes on prepare", async () => {
  const f = fixture();
  const voice = createS5VoiceFlow(f.port, f.planner, { concurrencyMode: "check-before-write" });
  const p = await voice.prepare(intent);
  assert.match(p.preview, /T-001/);
  assert.match(p.question, /确认写入/);
  assert.equal(f.writes, 0);
  await assert.rejects(voice.confirm(p.operationId, "可以吧"), fail("S5_EXPLICIT_CONFIRMATION_REQUIRED"));
  assert.equal(f.writes, 0);
  const result = await voice.confirm(p.operationId, "确认写入");
  assert.equal(result.status, "VERIFIED");
  assert.equal(f.content, "original:done");
  assert.equal(f.writes, 1);
  await assert.rejects(voice.confirm(p.operationId, "确认写入"), fail("S5_UNKNOWN_PROPOSAL"));
});

test("S5-E accepts only unambiguous confirmation with optional final sentence punctuation", async () => {
  for (const spoken of ["确认写入。", "确认保存。", "确认写入!", "确认保存！", "确认写入."]) {
    const f = fixture();
    const voice = createS5VoiceFlow(f.port, f.planner, { concurrencyMode: "check-before-write" });
    const p = await voice.prepare(intent);
    const result = await voice.confirm(p.operationId, spoken);
    assert.equal(result.status, "VERIFIED");
    assert.equal(f.writes, 1);
  }
  const f = fixture();
  const voice = createS5VoiceFlow(f.port, f.planner, { concurrencyMode: "check-before-write" });
  const p = await voice.prepare(intent);
  for (const spoken of ["保存。", "可以", "确认写入？", "确认保存吗？", "不要确认写入", "确认写入。取消"]) {
    await assert.rejects(voice.confirm(p.operationId, spoken), fail("S5_EXPLICIT_CONFIRMATION_REQUIRED"));
    assert.equal(f.writes, 0);
  }
  await voice.confirm(p.operationId, "确认写入。");
  assert.equal(f.writes, 1);
});

test("S5-E a confirmation cannot target another proposal or a canceled one", async () => {
  const f = fixture();
  const voice = createS5VoiceFlow(f.port, f.planner, { concurrencyMode: "check-before-write" });
  const p = await voice.prepare(intent);
  await assert.rejects(voice.confirm("not-the-proposal", "确认写入"), fail("S5_UNKNOWN_PROPOSAL"));
  voice.cancel(p.operationId);
  await assert.rejects(voice.confirm(p.operationId, "确认写入"), fail("S5_UNKNOWN_PROPOSAL"));
  assert.equal(f.writes, 0);
});

test("S5-E web change while waiting for voice confirmation cancels the original plan", async () => {
  const f = fixture();
  const voice = createS5VoiceFlow(f.port, f.planner, { concurrencyMode: "check-before-write" });
  const p = await voice.prepare(intent);
  f.webEdit("changed-on-iWiki-website");
  await assert.rejects(voice.confirm(p.operationId, "确认保存"), fail("S5_CONFLICT"));
  assert.equal(f.writes, 0);
  assert.equal(f.content, "changed-on-iWiki-website");
});

test("S5-E expired voice approval cannot save a stale plan", async () => {
  const f = fixture();
  let time = 100_000;
  const voice = createS5VoiceFlow(f.port, f.planner, {
    concurrencyMode: "check-before-write", clock: () => time, ttlMs: 1000,
  });
  const p = await voice.prepare(intent);
  time = p.expiresAt + 1;
  await assert.rejects(voice.confirm(p.operationId, "确认写入"), fail("S5_APPROVAL_REJECTED"));
  assert.equal(f.writes, 0);
});
