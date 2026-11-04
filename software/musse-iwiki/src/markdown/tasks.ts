import type { Priority, Task, TaskStatus } from "../types.ts";
import { ParseError, ValidationError } from "../types.ts";
import { isValidDate, isValidTime } from "../date.ts";

export const TASK_HEADER = [
  "ID",
  "名称",
  "说明",
  "分类",
  "优先级",
  "状态",
  "截止日期",
  "截止时间",
  "目标ID",
  "阶段ID",
  "创建时间",
  "完成时间",
] as const;

const STATUSES: TaskStatus[] = ["todo", "done", "archived"];
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

function escapeCell(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function unescapeCell(value: string): string {
  return value.trim();
}

/**
 * Splits a Markdown table row.
 *
 * Only `\|` and `\\` are escapes. Any other backslash is DATA (for example a
 * Windows path `C:\Users`), so it must survive the round-trip unchanged.
 */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    throw new ParseError(`not a table row: ${line}`);
  }
  const cells: string[] = [];
  let current = "";
  for (let i = 1; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "\\") {
      const next = trimmed[i + 1];
      if (next === "|") {
        current += "|";
        i++;
      } else if (next === "\\") {
        current += "\\";
        i++;
      } else {
        current += "\\";
      }
      continue;
    }
    if (ch === "|") {
      cells.push(unescapeCell(current));
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "") {
    // Tolerate a missing closing pipe.
    cells.push(unescapeCell(current));
  }
  return cells;
}

/**
 * Parses the task table. Structural problems throw instead of returning a
 * partially understood table, so callers never write back a guess.
 */
export function parseTaskTable(markdown: string): Task[] {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) => line.trim().startsWith("|") && line.includes("ID") && line.includes("名称"),
  );
  if (headerIndex < 0) {
    throw new ParseError("task table header not found");
  }
  const header = splitRow(lines[headerIndex]);
  if (header.length !== TASK_HEADER.length) {
    throw new ParseError(
      `task table has ${header.length} columns, expected ${TASK_HEADER.length}`,
    );
  }
  for (let i = 0; i < TASK_HEADER.length; i++) {
    if (header[i] !== TASK_HEADER[i]) {
      throw new ParseError(
        `task table column ${i + 1} is "${header[i]}", expected "${TASK_HEADER[i]}"`,
      );
    }
  }

  const tasks: Task[] = [];
  const seen = new Set<string>();
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") break;
    if (!line.trim().startsWith("|")) break;
    if (/^\|[\s:|-]+\|$/.test(line.trim())) continue; // separator row
    const cells = splitRow(line);
    if (cells.length !== TASK_HEADER.length) {
      throw new ParseError(`task row ${i + 1} has ${cells.length} columns`);
    }
    const task: Task = {
      id: cells[0],
      title: cells[1],
      description: cells[2],
      category: cells[3],
      priority: cells[4] as Priority,
      status: cells[5] as TaskStatus,
      dueDate: cells[6],
      dueTime: cells[7],
      goalId: cells[8],
      phaseId: cells[9],
      createdAt: cells[10],
      completedAt: cells[11],
    };
    validateTask(task);
    if (seen.has(task.id)) {
      throw new ParseError(`duplicate task ID: ${task.id}`);
    }
    seen.add(task.id);
    tasks.push(task);
  }
  return tasks;
}

export function validateTask(task: Task): void {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(task.id)) {
    throw new ValidationError(`invalid task ID: ${task.id}`);
  }
  if (task.title.trim() === "") {
    throw new ValidationError(`task ${task.id}: empty title`);
  }
  if (!PRIORITIES.includes(task.priority)) {
    throw new ValidationError(`task ${task.id}: invalid priority ${task.priority}`);
  }
  if (!STATUSES.includes(task.status)) {
    throw new ValidationError(`task ${task.id}: invalid status ${task.status}`);
  }
  if (!isValidDate(task.dueDate)) {
    throw new ValidationError(`task ${task.id}: invalid due date ${task.dueDate}`);
  }
  if (!isValidTime(task.dueTime)) {
    throw new ValidationError(`task ${task.id}: invalid due time ${task.dueTime}`);
  }
  if (task.status === "done" && task.completedAt === "") {
    throw new ValidationError(`task ${task.id}: done task needs completedAt`);
  }
  if (task.status !== "done" && task.completedAt !== "") {
    throw new ValidationError(`task ${task.id}: completedAt set on non-done task`);
  }
}

function taskRow(task: Task): string {
  const cells = [
    task.id,
    task.title,
    task.description,
    task.category,
    task.priority,
    task.status,
    task.dueDate,
    task.dueTime,
    task.goalId,
    task.phaseId,
    task.createdAt,
    task.completedAt,
  ].map(escapeCell);
  return `| ${cells.join(" | ")} |`;
}

/** Rebuilds only the table, preserving the rest of the document. */
export function serializeTaskTable(markdown: string, tasks: Task[]): string {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) => line.trim().startsWith("|") && line.includes("ID") && line.includes("名称"),
  );
  if (headerIndex < 0) throw new ParseError("task table header not found");

  let end = headerIndex + 1;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;

  const headerLine = `| ${TASK_HEADER.join(" | ")} |`;
  const separatorLine = `| ${TASK_HEADER.map(() => "---").join(" | ")} |`;
  const rows = tasks.map(taskRow);
  const replacement = [headerLine, separatorLine, ...rows];
  return [...lines.slice(0, headerIndex), ...replacement, ...lines.slice(end)].join("\n");
}

/** Updates one task by stable ID; other rows are preserved byte-for-byte. */
export function updateTaskRow(markdown: string, id: string, patch: Partial<Task>): string {
  const parts = markdown.split(/(\r?\n)/);
  const lines = parts.filter((_part, index) => index % 2 === 0);
  const headerIndex = lines.findIndex(
    (line) => line.trim().startsWith("|") && line.includes("ID") && line.includes("名称"),
  );
  if (headerIndex < 0) throw new ParseError("task table header not found");

  let found = false;
  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) break;
    const cells = splitRow(line);
    if (cells.length !== TASK_HEADER.length) continue;
    if (cells[0] !== id) continue;
    if (found) throw new ParseError(`duplicate task ID: ${id}`);
    found = true;
    const current = taskFromCells(cells);
    const next: Task = { ...current, ...patch, id: current.id };
    validateTask(next);
    lines[i] = taskRow(next);
  }
  if (!found) throw new ParseError(`task ID not found: ${id}`);
  for (let i = 0; i < lines.length; i++) parts[2 * i] = lines[i];
  return parts.join("");
}

function taskFromCells(cells: string[]): Task {
  return {
    id: cells[0],
    title: cells[1],
    description: cells[2],
    category: cells[3],
    priority: cells[4] as Priority,
    status: cells[5] as TaskStatus,
    dueDate: cells[6],
    dueTime: cells[7],
    goalId: cells[8],
    phaseId: cells[9],
    createdAt: cells[10],
    completedAt: cells[11],
  };
}
