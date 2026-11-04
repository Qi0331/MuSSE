import assert from "node:assert/strict";
import test from "node:test";
import { handleS5VoiceRpc } from "../src/mcp/s5-voice-protocol.ts";
import { createOfficialIwikiBestEffortPort } from "../src/write/official-iwiki-best-effort.ts";
import { createS5VoiceFlow } from "../src/write/voice-flow.ts";
import { planS5Mutation } from "../src/write/plan-write.ts";
import { parseTaskTable, TASK_HEADER } from "../src/markdown/tasks.ts";
import { DOC_PATHS } from "../src/store/wiki-store.ts";

const original = [
  "# 任务总表",
  `| ${TASK_HEADER.join(" | ")} |`,
  `| ${TASK_HEADER.map(() => "---").join(" | ")} |`,
  "| T-001 | 做作业 | 说明 | 学习 | P2 | todo | 2026-11-09 |  |  |  | 2026-11-04 10:00 |  |",
].join("\n");
const mapping = { [DOC_PATHS.tasks]: "page-TEST_TASK", [DOC_PATHS.notes]: "page-TEST_NOTES" };
const contract = { toolName: "edit_doc", documentIdArgument: "doc_id", contentArgument: "content" };
type Ack = "ok" | "false" | "opaque" | "contradictory" | "wrong-id";
const rpc = (name: string, args: Record<string, unknown>) =>
  ({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } });
const payload = (response: Awaited<ReturnType<typeof handleS5VoiceRpc>>) =>
  (response?.result as { structuredContent: Record<string, unknown> }).structuredContent;
const call = async (flow: ReturnType<typeof createS5VoiceFlow>, name: string, args: Record<string, unknown>) =>
  payload(await handleS5VoiceRpc(flow, rpc(name, args)));
const intent = { type: "task_complete", taskId: "T-001" };

function harness() {
  const documents: Record<string, string> = {
    "page-TEST_TASK": original,
    "page-TEST_NOTES": "# 快捷笔记\n",
  };
  const calls: string[] = [];
  let writes = 0;
  let reads = 0;
  let ack: Ack = "ok";
  let persist = true;
  let failReadAt = -1;
  const client = {
    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      calls.push(name);
      const id = String(args.doc_id);
      if (name === "read_doc") {
        reads++;
        if (reads === failReadAt) throw new Error("PRIVATE_REMOTE_RESPONSE");
        return { content: [{ type: "text", text: JSON.stringify({
          ok: true, data: { doc_id: id, content: documents[id] },
        }) }] };
      }
      if (name !== "edit_doc") throw new Error("Unexpected tool");
      assert.deepEqual(Object.keys(args).sort(), ["content", "doc_id"]);
      writes++;
      if (persist) documents[id] = String(args.content);
      if (ack === "opaque") return { isError: false, content: [{ type: "text", text: "unknown" }] };
      if (ack === "contradictory") return {
        structuredContent: { ok: true, data: { doc_id: id } },
        content: [{ type: "text", text: JSON.stringify({ ok: false }) }],
      };
      return { content: [{ type: "text", text: JSON.stringify({
        ok: ack !== "false",
        data: { doc_id: ack === "wrong-id" ? "page-OTHER" : id, new_rev_no: 2,
          old_chars: original.length, new_chars: String(args.content).length },
      }) }] };
    },
  };
  const port = createOfficialIwikiBestEffortPort(client, mapping, contract);
  const flow = createS5VoiceFlow(port, planS5Mutation, {
    concurrencyMode: "check-before-write",
    clock: () => Date.parse("2026-11-04T09:00:00Z"),
  });
  return {
    flow, documents, calls,
    get writes() { return writes; },
    setAck(next: Ack) { ack = next; },
    setPersist(next: boolean) { persist = next; },
    failNextRead() { failReadAt = reads + 1; },
  };
}

test("S5-G full MCP route: list → prepare preview → refused phrase → confirm → readback; one edit_doc only", async () => {
  const f = harness();
  const listing = await handleS5VoiceRpc(f.flow, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.deepEqual((listing?.result as { tools: { name: string }[] }).tools.map((x) => x.name),
    ["musse_write_prepare", "musse_write_confirm", "musse_write_cancel"]);
  const p = await call(f.flow, "musse_write_prepare", { intent });
  assert.match(String(p.preview), /完成任务/);
  assert.match(String(p.question), /确认写入/);
  assert.equal(f.writes, 0);
  assert.deepEqual(f.calls, ["read_doc"]);

  const refused = await call(f.flow, "musse_write_confirm", {
    operationId: String(p.operationId), spokenText: "好的",
  });
  assert.deepEqual(refused, { ok: false, code: "S5_EXPLICIT_CONFIRMATION_REQUIRED" });
  assert.equal(f.writes, 0);
  const saved = await call(f.flow, "musse_write_confirm", {
    operationId: String(p.operationId), spokenText: "确认写入",
  });
  assert.equal(saved.status, "VERIFIED");
  assert.deepEqual(f.calls, ["read_doc", "read_doc", "edit_doc", "read_doc"]);
  assert.equal(parseTaskTable(f.documents["page-TEST_TASK"])[0].status, "done");
  assert.equal(f.writes, 1);
  const duplicate = await call(f.flow, "musse_write_confirm", {
    operationId: String(p.operationId), spokenText: "确认写入",
  });
  assert.deepEqual(duplicate, { ok: false, code: "S5_UNKNOWN_PROPOSAL" });
  assert.equal(f.writes, 1);
});

test("S5-G MCP cancellation makes the proposal unusable, with zero writes", async () => {
  const f = harness();
  const p = await call(f.flow, "musse_write_prepare", { intent });
  const canceled = await call(f.flow, "musse_write_cancel", { operationId: String(p.operationId) });
  assert.deepEqual(canceled, { canceled: true });
  const later = await call(f.flow, "musse_write_confirm", {
    operationId: String(p.operationId), spokenText: "确认保存",
  });
  assert.deepEqual(later, { ok: false, code: "S5_UNKNOWN_PROPOSAL" });
  assert.equal(f.writes, 0);
  assert.equal(f.documents["page-TEST_TASK"], original);
});

test("S5-G browser modification between spoken turns becomes a conflict, never overwrites", async () => {
  const f = harness();
  const p = await call(f.flow, "musse_write_prepare", { intent });
  f.documents["page-TEST_TASK"] += "\n\n网页端新增内容";
  const outcome = await call(f.flow, "musse_write_confirm", {
    operationId: String(p.operationId), spokenText: "确认保存",
  });
  assert.deepEqual(outcome, { ok: false, code: "S5_CONFLICT" });
  assert.equal(f.writes, 0);
  assert.match(f.documents["page-TEST_TASK"], /网页端新增内容/);
});

for (const ack of ["false", "opaque", "contradictory", "wrong-id"] as const) {
  test(`S5-G ${ack} acknowledgement never verifies or blindly repeats edit_doc`, async () => {
    const f = harness();
    f.setAck(ack);
    const p = await call(f.flow, "musse_write_prepare", { intent });
    const result = await call(f.flow, "musse_write_confirm", {
      operationId: String(p.operationId), spokenText: "确认写入",
    });
    assert.deepEqual(result, { ok: false, code: "S5_WRITE_UNCERTAIN" });
    assert.equal(f.writes, 1);
    const blocked = await call(f.flow, "musse_write_prepare", { intent });
    assert.deepEqual(blocked, { ok: false, code: "S5_DOCUMENT_BLOCKED" });
    assert.equal(f.writes, 1);
  });
}

test("S5-G acknowledged edit without matching readback is uncertain and not retried", async () => {
  const f = harness();
  f.setPersist(false);
  const p = await call(f.flow, "musse_write_prepare", { intent });
  const result = await call(f.flow, "musse_write_confirm", {
    operationId: String(p.operationId), spokenText: "确认保存",
  });
  assert.deepEqual(result, { ok: false, code: "S5_READBACK_UNCERTAIN" });
  assert.equal(f.writes, 1);
  assert.equal(f.documents["page-TEST_TASK"], original);
});

test("S5-G failed pre-write read does not write or permanently block later proposals", async () => {
  const f = harness();
  const p = await call(f.flow, "musse_write_prepare", { intent });
  f.failNextRead();
  const result = await call(f.flow, "musse_write_confirm", {
    operationId: String(p.operationId), spokenText: "确认写入",
  });
  assert.deepEqual(result, { ok: false, code: "S5_READ_BEFORE_WRITE_FAILED" });
  assert.equal(f.writes, 0);
  const fresh = await call(f.flow, "musse_write_prepare", { intent });
  assert.equal(fresh.status, undefined); // prepare returns preview and operationId, not commit success
  assert.match(String(fresh.preview), /完成任务/);
});

test("S5-G note creation uses mapped notes page and the same confirm/readback sequence", async () => {
  const f = harness();
  const p = await call(f.flow, "musse_write_prepare", {
    intent: { type: "note_create", content: "离线语音确认笔记" },
  });
  assert.equal(f.writes, 0);
  const saved = await call(f.flow, "musse_write_confirm", {
    operationId: String(p.operationId), spokenText: "确认写入",
  });
  assert.equal(saved.status, "VERIFIED");
  assert.match(f.documents["page-TEST_NOTES"], /离线语音确认笔记/);
  assert.equal(f.writes, 1);
});
