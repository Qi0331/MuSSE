import assert from "node:assert/strict";
import test from "node:test";
import { createS5Gate, parseS5Intent, S5GateError } from "../src/write/guarded-write.ts";
import type { S5Action, S5AtomicPort, S5Planner } from "../src/write/guarded-write.ts";

function fake(atomic = true) {
  let content = "initial", revision = "r1", writes = 0, reads = 0;
  let failAfterWrite = false, failReadback = false;
  const port: S5AtomicPort = {
    supportsAtomicConditionalWrite: atomic,
    async read() {
      reads++;
      if (failReadback && writes > 0) return { content: "different", revision };
      return { content, revision };
    },
    async compareAndWrite(_doc, expected, next) {
      writes++;
      if (expected !== revision) throw Error("CAS conflict with SECRET_DOCUMENT");
      content = next;
      revision = "r2";
      if (failAfterWrite) throw Error("timeout with SECRET_TOKEN");
    },
  };
  const planner: S5Planner = (_action: S5Action, current) => ({ content: current + ":updated", preview: "修改预览" });
  return { port, planner, get writes() { return writes; }, get reads() { return reads; },
    setContent(v: string) { content = v; revision = "external"; },
    setRevision(v: string) { revision = v; }, failAfter() { failAfterWrite = true; }, failReadback() { failReadback = true; } };
}
const intent = { type: "task_complete", taskId: "T-001" };
const match = (code: string) => (err: unknown) => err instanceof S5GateError && err.code === code;

test("S5 strict allowlist rejects forged approval, hidden fields and bad dates", () => {
  for (const value of [
    { ...intent, confirmed: true }, { ...intent, taskId: "../secret" },
    { type: "task_update", taskId: "T-001", changes: { status: "done" } },
    { type: "task_update", taskId: "T-001", changes: { title: "" } },
    { type: "task_update", taskId: "T-001", changes: {} },
    { type: "task_create", title: "abc", dueDate: "2026-02-30" },
    { type: "task_create", title: "abc", dueDate: "2026-11-04", dueTime: "24:00" },
    { type: "note_create", content: "" }, { type: "goal_record_progress", goalId: "G-1", note: "x" },
  ]) assert.throws(() => parseS5Intent(value), S5GateError);
  assert.deepEqual(parseS5Intent({ type: "task_update", taskId: "T-001", changes: { dueTime: "", priority: "P1" } }),
    { type: "task_update", taskId: "T-001", changes: { dueTime: "", priority: "P1" } });
});

test("S5 prepare only reads; commit without independent approval fails", async () => {
  const f = fake();
  const gate = createS5Gate(f.port, f.planner);
  const proposal = await gate.untrusted.prepare(intent);
  assert.equal(proposal.status, "AWAITING_APPROVAL");
  assert.equal(f.writes, 0);
  await assert.rejects(gate.untrusted.commit(proposal.operationId), match("S5_NOT_APPROVED"));
  assert.equal(f.writes, 0);
});

test("S5 cannot spoof approval or reuse it for a different proposal", async () => {
  const f = fake();
  const gate = createS5Gate(f.port, f.planner);
  const a = await gate.untrusted.prepare(intent);
  const b = await gate.untrusted.prepare({ type: "note_create", content: "hi" });
  assert.throws(() => gate.trusted.approve(a.operationId, b.approvalDigest), match("S5_APPROVAL_REJECTED"));
  assert.throws(() => gate.trusted.approve(b.operationId, a.approvalDigest), match("S5_APPROVAL_REJECTED"));
  gate.trusted.approve(a.operationId, a.approvalDigest);
  assert.throws(() => gate.trusted.approve(a.operationId, a.approvalDigest), match("S5_APPROVAL_REJECTED"));
  assert.equal(gate.untrusted.status(b.operationId), "AWAITING_APPROVAL");
});

test("S5 expires and rejects preparations without writing", async () => {
  const f = fake(); let now = 10000;
  const gate = createS5Gate(f.port, f.planner, { clock: () => now, ttlMs: 1000 });
  const p = await gate.untrusted.prepare(intent);
  now = p.expiresAt;
  assert.throws(() => gate.trusted.approve(p.operationId, p.approvalDigest), match("S5_APPROVAL_REJECTED"));
  await assert.rejects(gate.untrusted.commit(p.operationId), match("S5_NOT_APPROVED"));
  assert.equal(gate.untrusted.status(p.operationId), "EXPIRED");
  assert.equal(f.writes, 0);
});

test("S5 rejects missing atomic CAS contract and empty versions", async () => {
  const f = fake(false); const g = createS5Gate(f.port, f.planner);
  const p = await g.untrusted.prepare(intent); g.trusted.approve(p.operationId, p.approvalDigest);
  await assert.rejects(g.untrusted.commit(p.operationId), match("S5_ATOMIC_WRITE_UNAVAILABLE"));
  assert.equal(f.writes, 0);
  const other = fake(); other.setRevision(""); const h = createS5Gate(other.port, other.planner);
  const q = await h.untrusted.prepare(intent); h.trusted.approve(q.operationId, q.approvalDigest);
  await assert.rejects(h.untrusted.commit(q.operationId), match("S5_ATOMIC_WRITE_UNAVAILABLE"));
  assert.equal(other.writes, 0);
});

test("S5 confirmed atomic write requires readback and deduplicates commit", async () => {
  const f = fake(); const g = createS5Gate(f.port, f.planner);
  const p = await g.untrusted.prepare(intent); g.trusted.approve(p.operationId, p.approvalDigest);
  const receipt = await g.untrusted.commit(p.operationId);
  assert.deepEqual(receipt, { operationId: p.operationId, status: "VERIFIED" });
  assert.deepEqual(await g.untrusted.commit(p.operationId), receipt);
  assert.equal(f.writes, 1);
});

test("S5 pre-commit external edit causes conflict and no write", async () => {
  const f = fake(); const g = createS5Gate(f.port, f.planner);
  const p = await g.untrusted.prepare(intent); g.trusted.approve(p.operationId, p.approvalDigest);
  f.setContent("user edited from iWiki UI");
  await assert.rejects(g.untrusted.commit(p.operationId), match("S5_CONFLICT"));
  assert.equal(g.untrusted.status(p.operationId), "CONFLICT");
  assert.equal(f.writes, 0);
});

test("S5 ambiguous remote outcome is UNCERTAIN and must not retry", async () => {
  const f = fake(); f.failAfter(); const g = createS5Gate(f.port, f.planner);
  const p = await g.untrusted.prepare(intent); g.trusted.approve(p.operationId, p.approvalDigest);
  await assert.rejects(g.untrusted.commit(p.operationId), match("S5_WRITE_UNCERTAIN"));
  await assert.rejects(g.untrusted.commit(p.operationId), match("S5_NOT_APPROVED"));
  assert.equal(g.untrusted.status(p.operationId), "UNCERTAIN");
  assert.equal(f.writes, 1);
});

test("S5 readback mismatch never claims saved", async () => {
  const f = fake(); f.failReadback(); const g = createS5Gate(f.port, f.planner);
  const p = await g.untrusted.prepare(intent); g.trusted.approve(p.operationId, p.approvalDigest);
  await assert.rejects(g.untrusted.commit(p.operationId), match("S5_READBACK_UNCERTAIN"));
  assert.equal(g.untrusted.status(p.operationId), "UNCERTAIN");
});

test("S5 explicit reject is terminal, does not write", async () => {
  const f = fake(); const g = createS5Gate(f.port, f.planner);
  const p = await g.untrusted.prepare(intent); g.trusted.reject(p.operationId);
  await assert.rejects(g.untrusted.commit(p.operationId), match("S5_NOT_APPROVED"));
  assert.equal(f.writes, 0);
});

test("S5 caps pending proposals", async () => {
  const f = fake(); const g = createS5Gate(f.port, f.planner, { maxPending: 1 });
  await g.untrusted.prepare(intent);
  await assert.rejects(g.untrusted.prepare(intent), match("S5_TOO_MANY_PENDING"));
  assert.equal(f.writes, 0);
});

test("S5 error codes do not leak remote error strings", async () => {
  const f = fake(); f.failAfter(); const g = createS5Gate(f.port, f.planner);
  const p = await g.untrusted.prepare(intent); g.trusted.approve(p.operationId, p.approvalDigest);
  let output = "";
  try { await g.untrusted.commit(p.operationId); } catch (e) { output = String(e); }
  assert.equal(output.includes("SECRET_TOKEN"), false);
  assert.match(output, /S5_WRITE_UNCERTAIN/);
});

test("S5 simultaneous double commit only schedules one atomic write", async () => {
  const f = fake();
  let release: (() => void) | undefined;
  const delayed = { ...f.port, compareAndWrite: async (...a: Parameters<S5AtomicPort["compareAndWrite"]>) => {
    await new Promise<void>((resolve) => { release = resolve; });
    await f.port.compareAndWrite(...a);
  }} as S5AtomicPort;
  const g = createS5Gate(delayed, f.planner);
  const p = await g.untrusted.prepare(intent); g.trusted.approve(p.operationId, p.approvalDigest);
  const first = g.untrusted.commit(p.operationId);
  for (let i = 0; i < 10 && !release; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(release);
  await assert.rejects(g.untrusted.commit(p.operationId), match("S5_NOT_APPROVED"));
  release();
  await first;
  assert.equal(f.writes, 1);
});

test("S5 verified receipt survives creation of a subsequent proposal", async () => {
  const f = fake(); const g = createS5Gate(f.port, f.planner);
  const one = await g.untrusted.prepare(intent);
  g.trusted.approve(one.operationId, one.approvalDigest);
  const receipt = await g.untrusted.commit(one.operationId);
  await g.untrusted.prepare({ type: "note_create", content: "another" });
  assert.deepEqual(await g.untrusted.commit(one.operationId), receipt);
  assert.equal(g.untrusted.status(one.operationId), "VERIFIED");
  assert.equal(f.writes, 1);
});

test("S5 reserves pending capacity while asynchronous prepares are in flight", async () => {
  let release: (() => void) | undefined;
  const f = fake();
  const port = {
    ...f.port,
    read: async (...args: Parameters<S5AtomicPort["read"]>) => {
      await new Promise<void>((resolve) => { release = resolve; });
      return f.port.read(...args);
    },
  } as S5AtomicPort;
  const gate = createS5Gate(port, f.planner, { maxPending: 1 });
  const first = gate.untrusted.prepare(intent);
  for (let i = 0; i < 10 && !release; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(release);
  await assert.rejects(gate.untrusted.prepare(intent), match("S5_TOO_MANY_PENDING"));
  release();
  const p = await first;
  assert.equal(p.status, "AWAITING_APPROVAL");
  assert.equal(f.writes, 0);
});

test("S5 rejects previews that omit required full approval detail by exceeding the bounded display", async () => {
  const f = fake();
  const planner: S5Planner = () => ({ content: "modified", preview: "x".repeat(2_001) });
  const g = createS5Gate(f.port, planner);
  await assert.rejects(g.untrusted.prepare(intent), match("S5_INVALID_PLAN"));
  assert.equal(f.writes, 0);
});