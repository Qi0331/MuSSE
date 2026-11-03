import assert from "node:assert/strict";
import test from "node:test";
import { handleReadonlyRpc } from "../src/mcp/readonly-protocol.ts";
import { callReadonlyTaskTool, READONLY_TASK_TOOLS } from "../src/mcp/tools-readonly.ts";
import type { TaskService } from "../src/service/task-service.ts";

function fakeService() {
  const calls: string[] = [];
  const service = {
    listTasks: async (filter: unknown) => { calls.push("listTasks"); return [{ id: "T-001", status: "todo", filter }]; },
    scheduleToday: async () => { calls.push("today"); return [{ id: "T-001", status: "todo" }]; },
    scheduleUpcoming: async (days: number) => { calls.push(`upcoming:${days}`); return []; },
    scheduleOverdue: async () => { calls.push("overdue"); return []; },
    createTask: async () => { calls.push("WRITE"); return {}; },
    completeTask: async () => { calls.push("WRITE"); return {}; },
    createNote: async () => { calls.push("WRITE"); return {}; },
  } as unknown as TaskService;
  return { service, calls };
}

function rpc(id: number, name: string, args: unknown = {}) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

test("S4-B lists exactly four task/schedule read tools", async () => {
  const names = READONLY_TASK_TOOLS.map((tool) => tool.name);
  assert.deepEqual(names, ["task_query", "schedule_today", "schedule_upcoming", "schedule_overdue"]);
  const { service } = fakeService();
  const reply = await handleReadonlyRpc(service, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.deepEqual((reply?.result as { tools: unknown[] }).tools.length, 4);
  assert.equal(JSON.stringify(reply).includes("task_create"), false);
  assert.equal(JSON.stringify(reply).includes("note_create"), false);
});

test("query and schedule dispatch reuse the existing read business methods", async () => {
  const { service, calls } = fakeService();
  for (const [i, name, args] of [
    [1, "task_query", { status: "todo" }],
    [2, "schedule_today", {}],
    [3, "schedule_upcoming", { days: 7 }],
    [4, "schedule_overdue", {}],
  ] as const) {
    const reply = await handleReadonlyRpc(service, rpc(i, name, args));
    assert.equal((reply?.result as { isError?: boolean }).isError, undefined);
  }
  assert.deepEqual(calls, ["listTasks", "today", "upcoming:7", "overdue"]);
});

test("write attempts and malformed filters are rejected before business methods", async () => {
  const { service, calls } = fakeService();
  for (const [name, args] of [
    ["task_create", { title: "not allowed" }],
    ["task_complete", { id: "T-001" }],
    ["note_create", { content: "not allowed" }],
    ["task_query", { status: "invalid" }],
    ["schedule_upcoming", { days: 999 }],
  ] as const) {
    const reply = await handleReadonlyRpc(service, rpc(5, name, args));
    assert.equal((reply?.result as { isError?: boolean }).isError, true);
  }
  assert.deepEqual(calls, []);
});

test("MCP initialize, notifications and sanitized failures", async () => {
  const { service } = fakeService();
  const init = await handleReadonlyRpc(service, { jsonrpc: "2.0", id: 9, method: "initialize" });
  assert.equal((init?.result as { serverInfo: { name: string } }).serverInfo.name, "musse-iwiki-readonly");
  assert.equal(await handleReadonlyRpc(service, { jsonrpc: "2.0", method: "notifications/initialized" }), null);
  const failing = { listTasks: async () => { throw Error("PRIVATE_DOC_ID SECRET_BODY"); } } as unknown as TaskService;
  const reply = await handleReadonlyRpc(failing, rpc(10, "task_query"));
  assert.equal((reply?.result as { isError: boolean }).isError, true);
  assert.equal(JSON.stringify(reply).includes("SECRET_BODY"), false);
  assert.equal(JSON.stringify(reply).includes("PRIVATE_DOC_ID"), false);
});
