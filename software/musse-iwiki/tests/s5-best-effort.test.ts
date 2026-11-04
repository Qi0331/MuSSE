import assert from "node:assert/strict";
import test from "node:test";
import { createS5Gate, S5GateError } from "../src/write/guarded-write.ts";
import { createOfficialIwikiBestEffortPort } from "../src/write/official-iwiki-best-effort.ts";
import { planS5Mutation } from "../src/write/plan-write.ts";
import { parseTaskTable, TASK_HEADER } from "../src/markdown/tasks.ts";
import { DOC_PATHS } from "../src/store/wiki-store.ts";

const original = [
  "# 任务总表", `| ${TASK_HEADER.join(" | ")} |`,
  `| ${TASK_HEADER.map(() => "---").join(" | ")} |`,
  "| T-001 | 做作业 | 说明 | 学习 | P2 | todo | 2026-11-09 |  |  |  | 2026-11-04 10:00 |  |",
].join("\n");
const mapping = { [DOC_PATHS.tasks]: "page-TEST_TASK", [DOC_PATHS.notes]: "page-TEST_NOTES" };
const contract = { toolName: "edit_doc", documentIdArgument: "doc_id", contentArgument: "content" };
const now = new Date("2026-11-04T09:00:00.000Z");
const fail = (code: string) => (error: unknown) => error instanceof S5GateError && error.code === code;

function sample(options: { acknowledgement?: "ok" | "none" | "error"; persist?: boolean } = {}) {
  const documents: Record<string, string> = { "page-TEST_TASK": original, "page-TEST_NOTES": "# 快捷笔记\n" };
  let writes = 0;
  const calls: string[] = [];
  const client = {
    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      calls.push(name);
      const docId = String(args.doc_id);
      if (name === "read_doc") {
        return { content: [{ type: "text", text: JSON.stringify({
          ok: true, data: { doc_id: docId, content: documents[docId] },
        }) }] };
      }
      if (name === "edit_doc") {
        writes++;
        if (options.persist !== false) documents[docId] = String(args.content);
        if (options.acknowledgement === "error") return { isError: true, structuredContent: { ok: false } };
        if (options.acknowledgement === "none") return { content: [{ type: "text", text: "unclear" }] };
        return { structuredContent: { ok: true } };
      }
      throw new Error("Unexpected tool");
    },
  };
  const port = createOfficialIwikiBestEffortPort(client, mapping, contract);
  return { port, documents, calls, get writes() { return writes; } };
}

test("S5-E best-effort task completion: explicit confirmation, read-before check and readback", async () => {
  const f = sample();
  const gate = createS5Gate(f.port, planS5Mutation, {
    concurrencyMode: "check-before-write", clock: () => now.getTime(),
  });
  const p = await gate.untrusted.prepare({ type: "task_complete", taskId: "T-001" });
  assert.equal(f.writes, 0);
  await assert.rejects(gate.untrusted.commit(p.operationId), fail("S5_NOT_APPROVED"));
  gate.trusted.approve(p.operationId, p.approvalDigest);
  const result = await gate.untrusted.commit(p.operationId);
  assert.equal(result.status, "VERIFIED");
  assert.equal(parseTaskTable(f.documents["page-TEST_TASK"])[0].status, "done");
  assert.deepEqual(f.calls, ["read_doc", "read_doc", "edit_doc", "read_doc"]);
  assert.deepEqual(await gate.untrusted.commit(p.operationId), result);
  assert.equal(f.writes, 1);
});

test("S5-E web edit before commit is a conflict; no write performed", async () => {
  const f = sample();
  const gate = createS5Gate(f.port, planS5Mutation, { concurrencyMode: "check-before-write" });
  const p = await gate.untrusted.prepare({ type: "task_update", taskId: "T-001", changes: { title: "新标题" } });
  gate.trusted.approve(p.operationId, p.approvalDigest);
  f.documents["page-TEST_TASK"] += "\n\n## 浏览器端刚刚更新\n保留";
  await assert.rejects(gate.untrusted.commit(p.operationId), fail("S5_CONFLICT"));
  assert.equal(f.writes, 0);
  assert.match(f.documents["page-TEST_TASK"], /保留/);
});

test("S5-E strict mode remains default when no atomic CAS version is available", async () => {
  const f = sample();
  const gate = createS5Gate(f.port, planS5Mutation);
  const p = await gate.untrusted.prepare({ type: "task_complete", taskId: "T-001" });
  gate.trusted.approve(p.operationId, p.approvalDigest);
  await assert.rejects(gate.untrusted.commit(p.operationId), fail("S5_ATOMIC_WRITE_UNAVAILABLE"));
  assert.equal(f.writes, 0);
});

test("S5-E best-effort note append is possible only with an explicit mapped note document", async () => {
  const f = sample();
  const gate = createS5Gate(f.port, planS5Mutation, { concurrencyMode: "check-before-write", clock: () => now.getTime() });
  const p = await gate.untrusted.prepare({ type: "note_create", content: "今天想到一个方案" });
  gate.trusted.approve(p.operationId, p.approvalDigest);
  await gate.untrusted.commit(p.operationId);
  assert.match(f.documents["page-TEST_NOTES"], /今天想到一个方案/);
  const client = { callTool: async () => { throw new Error("must not call"); } };
  const onlyTasks = createOfficialIwikiBestEffortPort(client, { [DOC_PATHS.tasks]: "page-TEST_TASK" }, contract);
  await assert.rejects(onlyTasks.read("notes"), fail("S5_WRITE_MAPPING_MISSING"));
});

test("S5-E unclear result never reports success, even if it may have written", async () => {
  const f = sample({ acknowledgement: "none" });
  const gate = createS5Gate(f.port, planS5Mutation, { concurrencyMode: "check-before-write" });
  const p = await gate.untrusted.prepare({ type: "task_complete", taskId: "T-001" });
  gate.trusted.approve(p.operationId, p.approvalDigest);
  await assert.rejects(gate.untrusted.commit(p.operationId), fail("S5_WRITE_UNCERTAIN"));
  assert.equal(gate.untrusted.status(p.operationId), "UNCERTAIN");
  assert.equal(f.writes, 1);
});

test("S5-F adapter accepts the now-verified real textJson edit_doc acknowledgement", async () => {
  const documents: Record<string, string> = {
    "page-TEST_TASK": original,
    "page-TEST_NOTES": "# 快捷笔记\n",
  };
  const calls: string[] = [];
  const client = {
    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      calls.push(name);
      const id = String(args.doc_id);
      if (name === "read_doc") return {
        content: [{ type: "text", text: JSON.stringify({
          ok: true, data: { doc_id: id, content: documents[id] },
        }) }],
      };
      if (name === "edit_doc") {
        assert.deepEqual(Object.keys(args).sort(), ["content", "doc_id"]);
        documents[id] = String(args.content);
        return { content: [{ type: "text", text: JSON.stringify({
          ok: true, summary: "updated", data: {
            doc_id: id, title: "SYNTHETIC", new_rev_no: 2, old_chars: original.length,
            new_chars: documents[id].length,
          },
        }) }] };
      }
      throw new Error("unexpected tool");
    },
  };
  const port = createOfficialIwikiBestEffortPort(client, mapping, contract);
  const gate = createS5Gate(port, planS5Mutation, {
    concurrencyMode: "check-before-write", clock: () => now.getTime(),
  });
  const prepared = await gate.untrusted.prepare({ type: "task_complete", taskId: "T-001" });
  gate.trusted.approve(prepared.operationId, prepared.approvalDigest);
  const result = await gate.untrusted.commit(prepared.operationId);
  assert.equal(result.status, "VERIFIED");
  assert.equal(parseTaskTable(documents["page-TEST_TASK"])[0].status, "done");
  assert.deepEqual(calls, ["read_doc", "read_doc", "edit_doc", "read_doc"]);
});

test("S5-F adapter rejects real textJson business ok:false rather than treating MCP success as write success", async () => {
  const client = {
    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      if (name === "read_doc") return {
        content: [{ type: "text", text: JSON.stringify({
          ok: true, data: { doc_id: String(args.doc_id), content: original },
        }) }],
      };
      if (name === "edit_doc") return {
        content: [{ type: "text", text: JSON.stringify({
          ok: false, summary: "rejected", data: { error: "SYNTHETIC_ERROR" },
        }) }],
      };
      throw new Error("unexpected");
    },
  };
  const port = createOfficialIwikiBestEffortPort(client, mapping, contract);
  const gate = createS5Gate(port, planS5Mutation, {
    concurrencyMode: "check-before-write", clock: () => now.getTime(),
  });
  const prepared = await gate.untrusted.prepare({ type: "task_complete", taskId: "T-001" });
  gate.trusted.approve(prepared.operationId, prepared.approvalDigest);
  await assert.rejects(gate.untrusted.commit(prepared.operationId), fail("S5_WRITE_UNCERTAIN"));
  assert.equal(gate.untrusted.status(prepared.operationId), "UNCERTAIN");
});

test("S5-E write contract must be explicitly specified; no guessed names or IDs", () => {
  const unused = { callTool: async () => ({}) };
  assert.throws(() => createOfficialIwikiBestEffortPort(unused, mapping, {
    ...contract, toolName: "read_doc",
  }), fail("S5_WRITE_CONTRACT_MISSING"));
  assert.throws(() => createOfficialIwikiBestEffortPort(unused, {
    [DOC_PATHS.tasks]: "../invalid",
  }, contract), fail("S5_WRITE_MAPPING_INVALID"));
});
