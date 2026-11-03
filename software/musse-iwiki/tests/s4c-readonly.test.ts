import test from "node:test";
import assert from "node:assert/strict";
import { readonlyDocumentIds } from "../src/mcp/document-ids.ts";
import { READONLY_TOOLS } from "../src/mcp/tools-readonly.ts";
import { handleReadonlyRpc } from "../src/mcp/readonly-protocol.ts";
import { latestNotes, parseNotes } from "../src/markdown/notes.ts";
import { DOC_PATHS, goalPath } from "../src/store/wiki-store.ts";
import type { TaskService } from "../src/service/task-service.ts";

const rpc = (name: string, args: unknown = {}) => ({
  jsonrpc: "2.0", id: 4, method: "tools/call", params: { name, arguments: args },
});
function fakeService() {
  const calls: string[] = [];
  const service = {
    listTasks: async () => { calls.push("tasks"); return []; },
    scheduleToday: async () => { calls.push("today"); return []; },
    scheduleUpcoming: async () => { calls.push("upcoming"); return []; },
    scheduleOverdue: async () => { calls.push("overdue"); return []; },
    queryGoal: async (id: string) => { calls.push("goal:" + id); return { goal: { id }, progress: { percent: 50 } }; },
    queryNotes: async (limit: number) => { calls.push("note:" + limit); return []; },
    createNote: async () => { calls.push("WRITE"); },
  } as unknown as TaskService;
  return { calls, service };
}

test("S4-C exposes six read-only queries and rejects mutations", async () => {
  const { service, calls } = fakeService();
  assert.deepEqual(READONLY_TOOLS.map((tool) => tool.name), [
    "task_query", "schedule_today", "schedule_upcoming", "schedule_overdue", "goal_query", "note_query",
  ]);
  for (const name of ["task_create", "task_complete", "goal_record_progress", "note_create"]) {
    const reply = await handleReadonlyRpc(service, rpc(name));
    assert.equal((reply?.result as { isError: boolean }).isError, true);
  }
  assert.deepEqual(calls, []);
});

test("goal and note queries dispatch and reject invalid IDs/limits", async () => {
  const { service, calls } = fakeService();
  const goal = await handleReadonlyRpc(service, rpc("goal_query", { goalId: "G-001" }));
  const notes = await handleReadonlyRpc(service, rpc("note_query", { limit: 5 }));
  assert.equal((goal?.result as { isError?: boolean }).isError, undefined);
  assert.equal((notes?.result as { isError?: boolean }).isError, undefined);
  assert.deepEqual(calls, ["goal:G-001", "note:5"]);
  for (const [name, args] of [
    ["goal_query", { goalId: "../secret" }],
    ["note_query", { limit: 1000 }],
    ["note_query", { limit: "5" }],
  ] as const) {
    const reply = await handleReadonlyRpc(service, rpc(name, args));
    assert.equal((reply?.result as { isError: boolean }).isError, true);
  }
  assert.equal(calls.length, 2);
});

test("logical document IDs are explicit and unsafe goal IDs fail closed", () => {
  const ids = readonlyDocumentIds({
    MUSSE_IWIKI_TASK_DOC_ID: "page-TASK",
    MUSSE_IWIKI_NOTES_DOC_ID: "page-NOTES",
    MUSSE_IWIKI_GOAL_DOC_IDS: JSON.stringify({ "G-001": "page-GOAL1", "G-002": "page-GOAL2" }),
  });
  assert.deepEqual(ids, {
    [DOC_PATHS.tasks]: "page-TASK", [DOC_PATHS.notes]: "page-NOTES",
    [goalPath("G-001")]: "page-GOAL1", [goalPath("G-002")]: "page-GOAL2",
  });
  assert.deepEqual(readonlyDocumentIds({ MUSSE_IWIKI_TASK_DOC_ID: "page-TASK" }),
    { [DOC_PATHS.tasks]: "page-TASK" });
  for (const bad of [
    { MUSSE_IWIKI_TASK_DOC_ID: "not-a-page" },
    { MUSSE_IWIKI_TASK_DOC_ID: "page-TASK", MUSSE_IWIKI_NOTES_DOC_ID: "../../X" },
    { MUSSE_IWIKI_TASK_DOC_ID: "page-TASK", MUSSE_IWIKI_GOAL_DOC_IDS: "not-json" },
    { MUSSE_IWIKI_TASK_DOC_ID: "page-TASK", MUSSE_IWIKI_GOAL_DOC_IDS: '{"../escape":"page-ID"}' },
    { MUSSE_IWIKI_TASK_DOC_ID: "page-TASK", MUSSE_IWIKI_GOAL_DOC_IDS: '{"G-1":"unverified"}' },
  ]) assert.throws(() => readonlyDocumentIds(bad), /S4_READONLY_MAPPING_INVALID/);
});

test("recent notes sort by timestamp and same-minute ordinal despite Markdown reordering", () => {
  const md = [
    "# 快捷笔记", "## 2026-11-04 13:00", "later",
    "## 2026-11-03 18:00", "older",
    "## 2026-11-04 13:00 #2", "latest",
    "## other", "unknown",
  ].join("\n\n");
  assert.deepEqual(latestNotes(parseNotes(md), 3).map((note) => note.content),
    ["latest", "later", "older"]);
  assert.equal(latestNotes(parseNotes(md), 10).at(-1)?.content, "unknown");
});
