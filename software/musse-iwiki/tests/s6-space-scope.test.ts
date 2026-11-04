import test from "node:test";
import assert from "node:assert/strict";
import { scanGoals, validateScope, S6Error } from "../src/goals/s6-goal-discovery.ts";
import type { GoalScope, GoalPort } from "../src/goals/s6-goal-discovery.ts";
import { createOfficialS6GoalPort } from "../src/goals/s6-official-port.ts";
import { planS6SpacePin } from "../tools/s6-pin-local-scope.mjs";

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
  const goalText = "# 目标：备考\n- 目标ID: G-001\n- 说明: 计划\n\n## 阶段\n\n## 进度历史\n";
  const entry = { docId: "page-GOAL", title: "G-001", parentId: null,
    spaceId: scope.spaceId, kind: "markdown" as const };
  const port = {
    async listDirectChildren() { return { complete: true, entries: [entry] }; },
    async readDoc() { return goalText; },
    async createDoc() { throw Error("unneeded"); },
    async editDoc() { throw Error("unneeded"); },
    async readTaskTable() { throw Error("unneeded"); },
  } satisfies GoalPort;
  assert.equal((await scanGoals(port, scope)).get("G-001")?.goal.id, "G-001");
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
  assert.equal(await port.createDoc(scope, "G-001", "temporary Markdown"), "page-NEW");
  assert.deepEqual(calls, [
    { name: "list_docs", args: { space_id: scope.spaceId } },
    { name: "create_markdown_doc", args: {
      title: "G-001", content: "temporary Markdown", space_id: scope.spaceId,
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
