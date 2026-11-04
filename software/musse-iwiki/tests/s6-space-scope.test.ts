import test from "node:test";
import assert from "node:assert/strict";
import { scanGoals, validateScope, S6Error } from "../src/goals/s6-goal-discovery.ts";
import type { GoalScope, GoalPort } from "../src/goals/s6-goal-discovery.ts";
import { createOfficialS6GoalPort } from "../src/goals/s6-official-port.ts";
import { createS6GoalFlow } from "../src/goals/s6-goal-flow.ts";
import { planS6SpacePin } from "../tools/s6-pin-local-scope.mjs";
import { summarizePinnedTaskDoc } from "../tools/s6-verify-readonly.mjs";
import { TASK_HEADER } from "../src/markdown/tasks.ts";

const scope: GoalScope = { mode: "space", spaceId: "space-EXACT_GOALS" };
const ack = (data: Record<string, unknown>) =>
  ({ content: [{ type: "text", text: JSON.stringify({ ok: true, data }) }] });

test("S6 dedicated knowledge base validates without a fabricated folder", () => {
  assert.doesNotThrow(() => validateScope(scope));
  assert.throws(() => validateScope({ spaceId: "space-X" } as GoalScope),
    (e: unknown) => e instanceof S6Error && e.code === "S6_SCOPE_NOT_CONFIGURED");
  assert.throws(() => validateScope({ mode: "space", spaceId: "space-X", folderId: "page-FALSE" } as GoalScope),
    (e: unknown) => e instanceof S6Error && e.code === "S6_SCOPE_NOT_CONFIGURED");
});

test("S6 space-scoped goal read includes exact space and rejects cross-space documents", async () => {
  const goalText = "# 目标：备考\n- 目标ID: G001\n- 说明: 计划\n\n## 阶段\n\n## 进度历史\n";
  const entry = { docId: "page-GOAL", title: "G001", parentId: null,
    spaceId: scope.spaceId, kind: "markdown" as const };
  const port = {
    async listDirectChildren() { return { complete: true, entries: [entry] }; },
    async readDoc() { return goalText; },
    async createDoc() { throw Error("unneeded"); },
    async editDoc() { throw Error("unneeded"); },
    async readTaskTable() { throw Error("unneeded"); },
  } satisfies GoalPort;
  assert.equal((await scanGoals(port, scope)).get("G001")?.goal.id, "G001");
  const legacyTitle = { ...port, async listDirectChildren() {
    return { complete: true, entries: [{ ...entry, title: "G-001" }] };
  } };
  await assert.rejects(() => scanGoals(legacyTitle, scope),
    (e: unknown) => e instanceof S6Error && e.code === "S6_SCOPE_OR_METADATA_MISMATCH");
  const wrong = { ...port, async listDirectChildren() {
    return { complete: true, entries: [{ ...entry, spaceId: "space-UNRELATED" }] };
  } };
  await assert.rejects(() => scanGoals(wrong, scope),
    (e: unknown) => e instanceof S6Error && e.code === "S6_SCOPE_OR_METADATA_MISMATCH");
});

test("S6 official adapter lists dedicated space and does not send parent_id on root creation", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async listTools() {
      return [
        { name: "list_docs", inputSchema: { required: ["space_id"] } },
        { name: "create_markdown_doc", inputSchema: { required: ["title", "content"] } },
        { name: "edit_doc", inputSchema: { required: ["doc_id", "content"] } },
      ];
    },
    async callTool(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === "list_docs") return ack({ docs: [], total: 0 });
      if (name === "create_markdown_doc") return ack({
        doc_id: "page-NEW", title: args.title, space_id: args.space_id,
      });
      throw Error("unexpected call");
    },
  };
  const port = createOfficialS6GoalPort(client, "page-TASKS");
  assert.deepEqual(await port.listDirectChildren(scope), { complete: true, entries: [] });
  assert.equal(await port.createDoc(scope, "G001", "temporary Markdown"), "page-NEW");
  assert.deepEqual(calls, [
    { name: "list_docs", args: { space_id: scope.spaceId } },
    { name: "create_markdown_doc", args: {
      title: "G001", content: "temporary Markdown", space_id: scope.spaceId,
    } },
  ]);
});

test("S6 local scope pin requires one exact knowledge-base match and provably empty docs", () => {
  const spaces = ack({ spaces: [
    { name: "小七个人管理", space_id: "space-PARENT" },
    { name: "长期目标", space_id: scope.spaceId },
  ] });
  const empty = ack({ docs: [], total: 0 });
  assert.deepEqual(planS6SpacePin(spaces, empty), scope);
  assert.throws(() => planS6SpacePin(spaces, ack({ docs: [], total: 0, next_cursor: "opaque" })));
  assert.throws(() => planS6SpacePin(spaces, ack({ docs: [], total: 1 })));
  assert.throws(() => planS6SpacePin(spaces, ack({ docs: [{ doc_id: "page-EXISTING" }], total: 1 })));
  assert.throws(() => planS6SpacePin(ack({ spaces: [
    { name: "长期目标", space_id: scope.spaceId },
    { name: "长期目标", space_id: "space-AMBIGUOUS" },
  ] }), empty));
});


test("S6 reads pinned current task page with title, exact ID and twelve-column table", () => {
  const markdown = [
    "# 任务总表",
    "| " + TASK_HEADER.join(" | ") + " |",
    "| " + TASK_HEADER.map(() => "---").join(" | ") + " |",
    "| T-001 | 任务一 | 描述 | 学习 | P2 | todo | 2026-11-10 |  |  |  | 2026-11-04 10:00 |  |",
  ].join("\n");
  const docId = "page-TASKS";
  assert.deepEqual(summarizePinnedTaskDoc(ack({
    doc_id: docId, title: "任务总表", content: markdown,
  }), docId), { titleMatches: true, columnCount: 12, taskCount: 1 });
  assert.equal(summarizePinnedTaskDoc(ack({
    doc_id: docId, title: "测试", content: markdown,
  }), docId).titleMatches, false);
  assert.throws(() => summarizePinnedTaskDoc(ack({
    doc_id: "page-UNEXPECTED", title: "任务总表", content: markdown,
  }), docId));
  assert.throws(() => summarizePinnedTaskDoc(ack({
    doc_id: docId, title: "任务总表", content: "not a task table",
  }), docId));
});


test("S6 live-shaped nonempty space list validates G999 by read_doc, allows preview and cancel only", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const goal = "# 目标：小七 S6 验收\n- 目标ID: G999\n- 说明: 用于验证长期目标动态发现。\n\n## 阶段\n\n### 阶段 P1：功能验证\n- 阶段ID: P1\n- 任务:\n- 手动进度:\n\n## 进度历史\n\n| 日期 | 进度 | 说明 |\n|---|---|---|\n";
  const client = {
    async listTools() {
      return [{ name: "list_docs", inputSchema: { required: ["space_id"] } }];
    },
    async callTool(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === "list_docs") return ack({
        docs: [{ doc_id: "page-G999", title: "G999", space_id: scope.spaceId }],
        total: 1,
      });
      if (name === "read_doc") return ack({
        doc_id: args.doc_id, title: "G999", content: goal,
      });
      throw Error("unexpected remote operation");
    },
  };
  const port = createOfficialS6GoalPort(client, "page-TASKS");
  const list = await port.listDirectChildren(scope);
  assert.equal(list.complete, true);
  assert.deepEqual(list.entries, [{
    docId: "page-G999", title: "G999", parentId: null,
    spaceId: scope.spaceId, kind: "unverified",
  }]);
  assert.equal((await scanGoals(port, scope)).get("G999")?.goal.title, "小七 S6 验收");
  const flow = createS6GoalFlow(port, scope);
  assert.equal((await flow.find("G999")).goal.id, "G999");
  const prepared = await flow.prepare({
    type: "goal_update", goalId: "G999",
    changes: { description: "读取已通过，写入尚未授权" },
  });
  assert.equal(prepared.status, "AWAITING_APPROVAL");
  assert.deepEqual(flow.cancel(prepared.operationId), { canceled: true });
  assert.ok(calls.every((c) => c.name === "list_docs" || c.name === "read_doc"));
});

test("S6 nonempty knowledge-base listing fails closed on incomplete counts or ambiguous pagination", async () => {
  const doc = { doc_id: "page-G999", title: "G999", space_id: scope.spaceId };
  let payload: Record<string, unknown> = { docs: [doc], total: 1 };
  const client = {
    async listTools() { return [{ name: "list_docs", inputSchema: { required: ["space_id"] } }]; },
    async callTool() { return ack(payload); },
  };
  const port = createOfficialS6GoalPort(client, "page-TASKS");
  for (const patch of [
    { total: 2 },
    { has_more: true },
    { next_cursor: "opaque" },
    { next_page: "opaque" },
    { hasMore: true },
  ]) {
    payload = { docs: [doc], total: 1, ...patch };
    await assert.rejects(() => port.listDirectChildren(scope),
      (e: unknown) => e instanceof S6Error && e.code === "S6_LIST_INCOMPLETE");
  }
  for (const item of [
    { ...doc, space_id: "space-FOREIGN" },
    { ...doc, page_type: "pdf" },
    { ...doc, parent_id: 123 },
  ]) {
    payload = { docs: [item], total: 1 };
    await assert.rejects(() => port.listDirectChildren(scope),
      (e: unknown) => e instanceof S6Error && e.code === "S6_SCOPE_OR_METADATA_MISMATCH");
  }
  payload = { docs: Array.from({ length: 100 }, (_, i) => ({
    doc_id: "page-G" + i, title: "G" + String(i).padStart(3, "0"), space_id: scope.spaceId,
  })), total: 100 };
  await assert.rejects(() => port.listDirectChildren(scope),
    (e: unknown) => e instanceof S6Error && e.code === "S6_LIST_INCOMPLETE");
});

test("S6 unknown metadata kind cannot bypass read_doc content identity validation", async () => {
  let content = "# 目标：错误\n- 目标ID: G100\n";
  const client = {
    async listTools() { return [{ name: "list_docs", inputSchema: { required: ["space_id"] } }]; },
    async callTool(name: string, args: Record<string, unknown>) {
      if (name === "list_docs") return ack({
        docs: [{ doc_id: "page-G999", title: "G999", space_id: scope.spaceId }],
        total: 1,
      });
      return ack({ doc_id: args.doc_id, content });
    },
  };
  const port = createOfficialS6GoalPort(client, "page-TASKS");
  await assert.rejects(() => scanGoals(port, scope),
    (e: unknown) => e instanceof S6Error && e.code === "S6_GOAL_ID_MISMATCH");
  content = "# unrelated page\n";
  await assert.rejects(() => scanGoals(port, scope),
    (e: unknown) => e instanceof S6Error && e.code === "S6_GOAL_FORMAT_INVALID");
});
