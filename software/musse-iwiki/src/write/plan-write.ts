import type { Task } from "../types.ts";
import { formatShanghai } from "../date.ts";
import { parseTaskTable, serializeTaskTable, updateTaskRow, validateTask } from "../markdown/tasks.ts";
import { appendNote, requireNoteHeading } from "../markdown/notes.ts";
import type { S5Action, S5Mutation } from "./guarded-write.ts";
import { S5GateError } from "./guarded-write.ts";

/** Escaped, full values for a meaningful human approval preview. Long plans fail closed at the gate's 2,000-character preview limit. */
function shown(value: string): string { return JSON.stringify(value); }

/** Pure S5 business composer. It never invokes iWiki MCP, filesystem writes or a task database. */
export function planS5Mutation(action: S5Action, current: string, operationId: string, now: Date): S5Mutation {
  if (action.type === "note_create") {
    requireNoteHeading(current);
    if (!/^#\s+快捷笔记\s*$/m.test(current)) throw new S5GateError("S5_NOTES_FORMAT_INVALID");
    const { markdown, heading } = appendNote(current, formatShanghai(now), action.content);
    return { content: markdown, preview: `追加快捷笔记（${heading}），完整内容：${shown(action.content)}` };
  }

  const tasks = parseTaskTable(current);
  if (action.type === "task_create") {
    const id = `T-${formatShanghai(now).slice(0, 10).replace(/-/g, "")}-${operationId.slice(0, 8).toUpperCase()}`;
    if (tasks.some((row) => row.id === id)) throw new S5GateError("S5_DUPLICATE_TASK");
    const task: Task = {
      id, title: action.title, description: action.description ?? "", category: action.category ?? "",
      priority: action.priority ?? "P2", status: "todo", dueDate: action.dueDate, dueTime: action.dueTime ?? "",
      goalId: "", phaseId: "", createdAt: formatShanghai(now), completedAt: "",
    };
    validateTask(task);
    const content = serializeTaskTable(current, [...tasks, task]);
    if (parseTaskTable(content).length !== tasks.length + 1) throw new S5GateError("S5_INVALID_PLAN");
    return { content, preview: `创建任务 ${task.id}：名称 ${shown(task.title)}；说明 ${shown(task.description)}；分类 ${shown(task.category)}；截止 ${task.dueDate}${task.dueTime ? " " + task.dueTime : ""}；优先级 ${task.priority}` };
  }

  const task = tasks.find((row) => row.id === action.taskId);
  if (!task) throw new S5GateError("S5_TASK_NOT_FOUND");
  if (action.type === "task_update") {
    const next: Task = { ...task, ...action.changes };
    validateTask(next);
    if (Object.keys(action.changes).every((field) => task[field as keyof Task] === next[field as keyof Task])) {
      throw new S5GateError("S5_NO_CHANGE");
    }
    const content = updateTaskRow(current, task.id, action.changes as Partial<Task>);
    const details = Object.keys(action.changes).map((key) => {
      const prior = String(task[key as keyof Task]);
      const after = String(next[key as keyof Task]);
      return `${key}：${shown(prior)} → ${shown(after)}`;
    });
    return { content, preview: `修改任务 ${task.id}「${task.title}」：${details.join("；")}` };
  }
  if (action.type === "task_complete") {
    if (task.status === "archived") throw new S5GateError("S5_RESTORE_FIRST");
    if (task.status === "done") throw new S5GateError("S5_NO_CHANGE");
    return { content: updateTaskRow(current, task.id, { status: "done", completedAt: formatShanghai(now) }), preview: `完成任务「${task.title}」` };
  }
  if (action.type === "task_archive") {
    if (task.status === "archived") throw new S5GateError("S5_NO_CHANGE");
    return { content: updateTaskRow(current, task.id, { status: "archived", completedAt: "" }), preview: `归档任务「${task.title}」` };
  }
  if (task.status === "todo") throw new S5GateError("S5_NO_CHANGE");
  return { content: updateTaskRow(current, task.id, { status: "todo", completedAt: "" }), preview: `恢复任务「${task.title}」为待办` };
}