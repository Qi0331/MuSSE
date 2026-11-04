import test from "node:test";
import assert from "node:assert/strict";
import { buildS6IdMigrationPlan, selectS6RenameTool } from "../tools/s6-migrate-goal-ids-once.mjs";
import { TASK_HEADER } from "../src/markdown/tasks.ts";
import { parseGoal } from "../src/markdown/goals.ts";

const scope = { mode: "space", spaceId: "space-TEST_ONLY" };
const goal = (id, title = id) =>
  "# 目标：" + title + "\n- 目标ID: " + id +
  "\n- 说明: 隔离验收\n\n## 阶段\n\n### 阶段 P1：测试\n- 阶段ID: P1\n- 任务:\n- 手动进度:\n\n## 进度历史\n\n| 日期 | 进度 | 说明 |\n|---|---|---|\n";
const tasks = [
  "# 任务总表", "| " + TASK_HEADER.join(" | ") + " |",
  "| " + TASK_HEADER.map(() => "---").join(" | ") + " |",
  "| T-001 | 项目任务 | 说明 | 学习 | P2 | todo | 2026-11-09 |  | G-998 | P1 | 2026-11-05 10:00 |  |",
  "| T-002 | 其他任务 | 说明 | 学习 | P2 | todo | 2026-11-09 |  |  |  | 2026-11-05 10:00 |  |",
].join("\n");
function fixture({ manual = false, wrongContent = false, collision = false } = {}) {
  const entries = [["G-998", "page-A"], ["G-999", "page-B"]].map(([title, docId]) =>
    ({ title: manual ? title.replace("-", "") : title, docId, kind: "markdown",
       parentId: null, spaceId: scope.spaceId }));
  if (collision) entries.push({ title: "G998", docId: "page-C",
    kind: "markdown", parentId: null, spaceId: scope.spaceId });
  const docs = {
    "page-A": goal(wrongContent ? "G-997" : "G-998"),
    "page-B": goal("G-999"),
    "page-C": goal("G998"),
  };
  return {
    async listDirectChildren() { return { complete: true, entries }; },
    async readDoc(id) { return docs[id]; },
    async readTaskTable() { return tasks; },
  };
}
test("S6 one-shot migration rewrites only goal ID lines, preserves progress and task rows", async () => {
  const plan = await buildS6IdMigrationPlan(fixture(), scope);
  assert.equal(plan.docs.length, 2);
  assert.equal(plan.changedTasks, 1);
  assert.equal(parseGoal(plan.docs[0].after).id, "G998");
  assert.equal(parseGoal(plan.docs[1].after).id, "G999");
  assert.equal(plan.docs[0].before.replace("目标ID: G-998", "目标ID: G998"), plan.docs[0].after);
  assert.match(plan.taskAfter, /\| G998 \| P1 \|/);
  assert.match(plan.taskAfter, /T-002/);
  assert.equal(plan.taskAfter.includes("G-998"), false);
});
test("S6 manual title mode requires BOTH titles already renamed; contents still old", async () => {
  const plan = await buildS6IdMigrationPlan(fixture({ manual: true }), scope, { manualTitles: true });
  assert.equal(plan.docs.length, 2);
  await assert.rejects(() => buildS6IdMigrationPlan(fixture(), scope, { manualTitles: true }),
    /S6_MIGRATION_TARGET_NOT_FOUND/);
});
test("S6 migration stops on mismatched bodies, title collisions and unrelated pages", async () => {
  await assert.rejects(() => buildS6IdMigrationPlan(fixture({ wrongContent: true }), scope),
    /S6_MIGRATION_BODY_ID_MISMATCH/);
  await assert.rejects(() => buildS6IdMigrationPlan(fixture({ collision: true }), scope),
    /S6_MIGRATION_TARGET_COLLISION/);
});
test("S6 rename tool is accepted only with concrete doc_id and new_title schema", () => {
  assert.equal(selectS6RenameTool([{ name: "rename_doc", inputSchema: {
    properties: { doc_id: { type: "string" }, new_title: { type: "string" } },
    required: ["doc_id", "new_title"],
  } }])?.titleKey, "new_title");
  assert.equal(selectS6RenameTool([{ name: "rename_doc", inputSchema: {
    properties: { doc_id: { type: "string" } },
    required: ["doc_id"],
  } }]), null);
  assert.equal(selectS6RenameTool([{ name: "rename_doc", inputSchema: {
    properties: { doc_id: { type: "string" }, title: { type: "string" }, force: { type: "boolean" } },
    required: ["doc_id", "title", "force"],
  } }]), null);
});
