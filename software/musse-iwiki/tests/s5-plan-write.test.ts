import assert from "node:assert/strict";
import test from "node:test";
import { planS5Mutation } from "../src/write/plan-write.ts";
import { parseTaskTable, TASK_HEADER } from "../src/markdown/tasks.ts";
import { parseNotes } from "../src/markdown/notes.ts";
import { S5GateError } from "../src/write/guarded-write.ts";

const task = "| T-001 | 测试任务 | 描述 | 学习 | P2 | todo | 2026-11-09 |  |  |  | 2026-11-04 10:00 |  |";
const task2 = "| T-002 | 保持不变 | 备注 | 学习 | P1 | todo | 2026-11-10 |  |  |  | 2026-11-04 10:00 |  |";
const table = ["# 任务总表", `| ${TASK_HEADER.join(" | ")} |`, `| ${TASK_HEADER.map(() => "---").join(" | ")} |`, task, task2, "", "## 其他说明", "保持这段文字"].join("\n");
const now = new Date("2026-11-04T04:30:00.000Z");
const id = "12345678-0000-4000-8000-000000000001";

test("S5 planner creates a stable ID and preserves unrelated tasks", () => {
  const p = planS5Mutation({ type: "task_create", title: "新增任务", dueDate: "2026-11-12" }, table, id, now);
  const rows = parseTaskTable(p.content);
  assert.equal(rows.length, 3);
  assert.equal(rows[2].id, "T-20261104-12345678");
  assert.deepEqual(rows.slice(0, 2), parseTaskTable(table));
  assert.ok(p.content.includes("保持这段文字"));
});

test("S5 planner only updates the targeted task", () => {
  const p = planS5Mutation({ type: "task_update", taskId: "T-001", changes: { title: "更新标题", priority: "P0", dueTime: "13:45" } }, table, id, now);
  const [a, b] = parseTaskTable(p.content);
  assert.equal(a.title, "更新标题");
  assert.equal(a.priority, "P0");
  assert.equal(a.dueTime, "13:45");
  assert.deepEqual(b, parseTaskTable(table)[1]);
  assert.ok(p.content.includes(task2));
});

test("S5 planner handles complete, archive and restore without deleting rows", () => {
  const done = planS5Mutation({ type: "task_complete", taskId: "T-001" }, table, id, now).content;
  assert.equal(parseTaskTable(done)[0].status, "done");
  const archived = planS5Mutation({ type: "task_archive", taskId: "T-001" }, done, id, now).content;
  assert.equal(parseTaskTable(archived)[0].status, "archived");
  const restored = planS5Mutation({ type: "task_restore", taskId: "T-001" }, archived, id, now).content;
  assert.equal(parseTaskTable(restored)[0].status, "todo");
  assert.equal(parseTaskTable(restored).length, 2);
});

test("S5 note creation preserves the document and escapes headings", () => {
  const p = planS5Mutation({ type: "note_create", content: "内容\n## 不应成为另一条笔记" }, "# 快捷笔记\n", id, now);
  const notes = parseNotes(p.content);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].createdAt, "2026-11-04 12:30");
  assert.ok(notes[0].content.includes("## 不应成为另一条笔记"));
});

test("S5 planner fails closed on nonexistent task, no-op, unsupported document", () => {
  assert.throws(() => planS5Mutation({ type: "task_complete", taskId: "T-999" }, table, id, now), S5GateError);
  assert.throws(() => planS5Mutation({ type: "task_restore", taskId: "T-001" }, table, id, now), S5GateError);
  assert.throws(() => planS5Mutation({ type: "note_create", content: "X" }, "not a notes document", id, now));
});

test("S5 approval preview shows complete old/new task values and note body", () => {
  const p = planS5Mutation({type:"task_update",taskId:"T-001",changes:{title:"已改的标题",dueTime:"14:20"}}, table,id,now);
  assert.match(p.preview, /"测试任务".*"已改的标题"/);
  assert.match(p.preview, /"".*"14:20"/);
  assert.match(p.preview, /T-001/);
  const note = planS5Mutation({type:"note_create",content:"标题和完整笔记内容"}, "# 快捷笔记\n", id,now);
  assert.match(note.preview, /完整内容/);
  assert.match(note.preview, /标题和完整笔记内容/);
  const create = planS5Mutation({type:"task_create",title:"学习任务", description:"复习题库",category:"学习",dueDate:"2026-11-10"},table,id,now);
  assert.match(create.preview,/复习题库/);
  assert.match(create.preview,/学习/);
});


test("S5 notes never append into a mismapped arbitrary document", () => {
  assert.throws(() => planS5Mutation({ type: "note_create", content: "test" }, "# 私人日记\n", id, now),
    (error: unknown) => error instanceof S5GateError && error.code === "S5_NOTES_FORMAT_INVALID");
});