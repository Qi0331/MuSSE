import assert from "node:assert/strict";
import test from "node:test";
import { scanGoals, findGoal, S6Error } from "../src/goals/s6-goal-discovery.ts";
import type { GoalPort, GoalScope, GoalEntry, ChildListing } from "../src/goals/s6-goal-discovery.ts";
import { createS6GoalFlow } from "../src/goals/s6-goal-flow.ts";
import { handleS6GoalRpc } from "../src/mcp/s6-goal-protocol.ts";
import { TASK_HEADER } from "../src/markdown/tasks.ts";

const scope: GoalScope = { spaceId: "space-PERSONAL", folderId: "page-GOALS_DIR" };
const original = "# 目标：学习编程\n- 目标ID: G-001\n- 说明: 第一阶段\n\n## 阶段\n\n### 阶段 P1：基础\n- 阶段ID: P1\n- 任务: T-001\n- 手动进度: \n\n## 进度历史\n\n| 日期 | 进度 | 说明 |\n|---|---|---|\n";
const tasks = ["# 任务总表", "| " + TASK_HEADER.join(" | ") + " |",
  "| " + TASK_HEADER.map(() => "---").join(" | ") + " |",
  "| T-001 | 任务 | 说明 | 学习 | P2 | done | 2026-11-09 |  | G-001 | P1 | 2026-11-04 10:00 | 2026-11-04 11:00 |",
].join("\n");
const page = (id: string, title: string, overrides: Partial<GoalEntry> = {}): GoalEntry =>
  ({ docId: id, title, parentId: scope.folderId, spaceId: scope.spaceId, kind: "markdown", ...overrides });

function fixture(initial = true) {
  const docs = new Map<string, string>();
  const entries: GoalEntry[] = [];
  if (initial) { docs.set("page-GOAL_1", original); entries.push(page("page-GOAL_1", "G-001")); }
  let listingComplete = true;
  let wrote = 0;
  let createAckFails = false;
  let corruptAfterWrite = false;
  let taskText = tasks;
  const port: GoalPort = {
    async listDirectChildren(_scope): Promise<ChildListing> {
      return { complete: listingComplete, entries: entries.map((x) => ({ ...x })) };
    },
    async readDoc(id) { const value = docs.get(id); if (value === undefined) throw Error("not found"); return value; },
    async createDoc(_scope, title, content) {
      wrote++;
      if (createAckFails) throw Error("timeout or unclear response");
      docs.set("page-CREATED", corruptAfterWrite ? content + " corrupt" : content);
      entries.push(page("page-CREATED", title));
      return "page-CREATED";
    },
    async editDoc(id, content) { wrote++; docs.set(id, corruptAfterWrite ? content + " corrupt" : content); },
    async readTaskTable() { return taskText; },
  };
  return { port, entries, docs,
    get writes() { return wrote; },
    setIncomplete() { listingComplete = false; },
    setCreateFailure() { createAckFails = true; },
    setCorruptReadback() { corruptAfterWrite = true; },
    setTaskTable(value: string) { taskText = value; },
  };
}
const code = async (fn: () => Promise<unknown>, expected: string) =>
  assert.rejects(fn, (error: unknown) => error instanceof S6Error && error.code === expected);
const now = () => Date.parse("2026-11-04T09:00:00Z");

test("S6 reads only an exact ID within the bounded verified folder", async () => {
  const f = fixture();
  const found = await findGoal(f.port, scope, "G-001");
  assert.equal(found.entry.title, "G-001");
  assert.equal(found.goal.id, "G-001");
  await code(() => findGoal(f.port, scope, "G-002"), "S6_GOAL_NOT_FOUND");
  await code(() => findGoal(f.port, scope, "bad"), "S6_INVALID_GOAL_ID");
});

test("S6 refuses incomplete, ambiguous, wrong-directory and mismatched documents", async () => {
  const f = fixture();
  f.setIncomplete();
  await code(() => scanGoals(f.port, scope), "S6_LIST_INCOMPLETE");
  const g = fixture();
  g.entries.push(page("page-ANOTHER", "G-001"));
  await code(() => scanGoals(g.port, scope), "S6_DUPLICATE_DOCUMENT");
  const h = fixture();
  h.entries[0].parentId = "page-WRONG_FOLDER";
  await code(() => scanGoals(h.port, scope), "S6_SCOPE_OR_METADATA_MISMATCH");
  const k = fixture();
  k.docs.set("page-GOAL_1", original.replace("G-001", "G-002"));
  await code(() => scanGoals(k.port, scope), "S6_GOAL_ID_MISMATCH");
});

test("S6 controlled create: preview, refusal, cancel, confirm, exact readback; no duplicate", async () => {
  const f = fixture(false);
  const flow = createS6GoalFlow(f.port, scope, { clock: now });
  const intent = { type: "goal_create", goalId: "G-002", title: "实习计划",
    description: "按阶段推进", phases: [{ id: "P1", name: "准备" }] };
  const canceled = await flow.prepare(intent);
  assert.equal(f.writes, 0);
  assert.deepEqual(flow.cancel(canceled.operationId), { canceled: true });
  await code(() => flow.confirm(canceled.operationId, "确认写入"), "S6_NOT_PENDING");
  const prepared = await flow.prepare(intent);
  assert.match(prepared.preview, /G-002/);
  await code(() => flow.confirm(prepared.operationId, "好啊"), "S6_EXPLICIT_CONFIRMATION_REQUIRED");
  assert.equal(f.writes, 0);
  assert.equal((await flow.confirm(prepared.operationId, "确认写入")).status, "VERIFIED");
  assert.equal(f.writes, 1);
  assert.match(f.docs.get("page-CREATED")!, /目标ID: G-002/);
  await code(() => flow.prepare(intent), "S6_DUPLICATE_GOAL");
});

test("S6 update adds a phase without replacing progress history", async () => {
  const f = fixture();
  const flow = createS6GoalFlow(f.port, scope, { clock: now });
  const p = await flow.prepare({ type: "goal_update", goalId: "G-001",
    changes: { description: "持续改进", addPhase: { id: "P2", name: "项目" } } });
  assert.equal(f.writes, 0);
  await flow.confirm(p.operationId, "确认保存");
  assert.match(f.docs.get("page-GOAL_1")!, /阶段ID: P2/);
  assert.match(f.docs.get("page-GOAL_1")!, /## 进度历史/);
});

test("S6 progress is calculated from task table, not provided by the model", async () => {
  const f = fixture();
  const flow = createS6GoalFlow(f.port, scope, { clock: now });
  const p = await flow.prepare({ type: "goal_record_progress", goalId: "G-001", note: "第一阶段完成" });
  assert.match(p.preview, /100%/);
  await flow.confirm(p.operationId, "确认保存");
  assert.match(f.docs.get("page-GOAL_1")!, /\| 2026-11-04 \| 100% \| 第一阶段完成 \|/);
});

test("S6 changed task table or changed goal before confirm rejects, zero writes", async () => {
  const f = fixture();
  const flow = createS6GoalFlow(f.port, scope, { clock: now });
  const p = await flow.prepare({ type: "goal_record_progress", goalId: "G-001", note: "说明" });
  f.setTaskTable(tasks + "\n");
  await code(() => flow.confirm(p.operationId, "确认写入"), "S6_CONFLICT");
  assert.equal(f.writes, 0);
  const q = await flow.prepare({ type: "goal_update", goalId: "G-001", changes: { title: "新目标" } });
  f.docs.set("page-GOAL_1", original + "\n网页改动");
  await code(() => flow.confirm(q.operationId, "确认保存"), "S6_CONFLICT");
  assert.equal(f.writes, 0);
});

test("S6 ambiguous create and mismatched readback are UNCERTAIN and never retried", async () => {
  const f = fixture(false);
  f.setCreateFailure();
  const flow = createS6GoalFlow(f.port, scope, { clock: now });
  const intent = { type: "goal_create", goalId: "G-005", title: "目标" };
  const p = await flow.prepare(intent);
  await code(() => flow.confirm(p.operationId, "确认写入"), "S6_WRITE_UNCERTAIN");
  await code(() => flow.prepare(intent), "S6_GOAL_BLOCKED");
  assert.equal(f.writes, 1);
  const g = fixture();
  g.setCorruptReadback();
  const writer = createS6GoalFlow(g.port, scope, { clock: now });
  const q = await writer.prepare({ type: "goal_update", goalId: "G-001", changes: { title: "新的标题" } });
  await code(() => writer.confirm(q.operationId, "确认写入"), "S6_READBACK_UNCERTAIN");
  assert.equal(g.writes, 1);
});

test("S6 independent MCP lists 4 tools and masks backend errors", async () => {
  const f = fixture();
  const flow = createS6GoalFlow(f.port, scope, { clock: now });
  const response = await handleS6GoalRpc(flow, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.deepEqual((response?.result as { tools: Array<{ name: string }> }).tools.map((x) => x.name),
    ["musse_goal_find", "musse_goal_prepare", "musse_goal_confirm", "musse_goal_cancel"]);
  const missing = await handleS6GoalRpc(flow, { jsonrpc: "2.0", id: 2,
    method: "tools/call", params: { name: "musse_goal_find", arguments: { goalId: "G-999" } } });
  assert.deepEqual((missing?.result as { structuredContent: unknown }).structuredContent,
    { ok: false, code: "S6_GOAL_NOT_FOUND" });
});

test("S6 official-port contract is a strict closed boundary (import smoke)", async () => {
  const { createOfficialS6GoalPort } = await import("../src/goals/s6-official-port.ts");
  const fake = { async listTools() { return []; }, async callTool() { throw Error("should not call"); } };
  const p = createOfficialS6GoalPort(fake, "page-TASKS");
  await code(() => p.listDirectChildren(scope), "S6_TOOL_CONTRACT_UNVERIFIED");
});
