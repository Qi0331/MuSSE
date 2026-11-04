import assert from "node:assert/strict";
import test from "node:test";
import { S5_VOICE_TOOLS, handleS5VoiceRpc } from "../src/mcp/s5-voice-protocol.ts";
import { buildS5VoiceFlow } from "../src/mcp/server-s5.ts";
import { S5GateError } from "../src/write/guarded-write.ts";
import type { createS5VoiceFlow } from "../src/write/voice-flow.ts";

type VoiceFlow = Pick<ReturnType<typeof createS5VoiceFlow>, "prepare" | "confirm" | "cancel">;
const rpc = (name: string, args: Record<string, unknown>) =>
  ({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } });

test("S5-E optional MCP publishes only the three two-turn voice tools", async () => {
  const fake = {} as VoiceFlow;
  const result = await handleS5VoiceRpc(fake, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.deepEqual(S5_VOICE_TOOLS.map((x) => x.name),
    ["musse_write_prepare", "musse_write_confirm", "musse_write_cancel"]);
  assert.equal((result?.result as { tools: unknown[] }).tools.length, 3);
  assert.equal(JSON.stringify(result).includes("task_archive\""), false);
});

test("S5-E voice MCP delegates prepare and confirm to the gate, never secretly combines them", async () => {
  const calls: string[] = [];
  const flow = {
    async prepare() {
      calls.push("prepare");
      return { operationId: "mock-1", preview: "任务新标题", question: "请确认", expiresAt: 999999 };
    },
    async confirm(_id: string, phrase: string) {
      calls.push("confirm:" + phrase);
      return { operationId: "mock-1", status: "VERIFIED" as const };
    },
    cancel() { calls.push("cancel"); },
  } as VoiceFlow;
  const prepare = await handleS5VoiceRpc(flow, rpc("musse_write_prepare", { intent: { type: "task_complete", taskId: "T-001" } }));
  assert.equal(calls.length, 1);
  assert.equal((prepare?.result as { isError?: boolean }).isError, undefined);
  const saved = await handleS5VoiceRpc(flow, rpc("musse_write_confirm", { operationId: "mock-1", spokenText: "确认写入" }));
  assert.equal((saved?.result as { isError?: boolean }).isError, undefined);
  assert.deepEqual(calls, ["prepare", "confirm:确认写入"]);
});

test("S5-E MCP rejects malformed requests without leaking private upstream errors", async () => {
  const flow = {
    async prepare() { throw new Error("PRIVATE_TOKEN_SECRET_DOC"); },
    async confirm() { throw new S5GateError("S5_EXPLICIT_CONFIRMATION_REQUIRED"); },
    cancel() {},
  } as VoiceFlow;
  for (const request of [
    rpc("musse_write_prepare", {}),
    rpc("musse_write_prepare", { intent: { type: "task_complete", taskId: "T-001" } }),
    rpc("musse_write_confirm", { operationId: "mock-1", spokenText: "可以吧" }),
    rpc("musse_unknown_write", {}),
  ]) {
    const response = await handleS5VoiceRpc(flow, request);
    assert.equal((response?.result as { isError?: boolean }).isError, true);
    assert.equal(JSON.stringify(response).includes("PRIVATE_TOKEN_SECRET_DOC"), false);
  }
});

test("S5-E production stdio server is disabled before private config can be read", async () => {
  await assert.rejects(buildS5VoiceFlow({}), /S5_NOT_ENABLED/);
});
