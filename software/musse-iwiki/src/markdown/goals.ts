import type { Goal, GoalProgress, Phase, ProgressRecord, Task } from "../types.ts";
import { ParseError, ValidationError } from "../types.ts";
import { isValidDate } from "../date.ts";

export function parseGoal(markdown: string): Goal {
  const titleMatch = markdown.match(/^#[ \t]*目标[:：][ \t]*(.+)$/m);
  if (!titleMatch) throw new ParseError("goal title not found");
  const idMatch = markdown.match(/^-[ \t]*目标ID[:：][ \t]*(\S+)[ \t]*$/m);
  if (!idMatch) throw new ParseError("goal ID not found");
  const descMatch = markdown.match(/^-[ \t]*说明[:：][ \t]*(.*)$/m);

  const phases: Phase[] = [];
  const phaseChunks = markdown.split(/^###[ \t]*阶段[ \t]*/m).slice(1);
  for (const chunk of phaseChunks) {
    const phaseId = chunk.match(/^-[ \t]*阶段ID[:：][ \t]*(\S+)[ \t]*$/m)?.[1];
    const name = chunk.split(/\r?\n/)[0].replace(/^[：:][ \t]*/, "").trim();
    const taskLine = chunk.match(/^-[ \t]*任务[:：][ \t]*(.*)$/m)?.[1] ?? "";
    const taskIds = taskLine
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const manual = chunk.match(/^-[ \t]*手动进度[:：][ \t]*(.*)$/m)?.[1]?.trim() ?? "";
    if (!phaseId) throw new ParseError(`phase ID missing in "${name}"`);
    phases.push({ id: phaseId, name, taskIds, manualProgress: manual });
  }

  const history = parseProgressHistory(markdown);
  return {
    id: idMatch[1],
    title: titleMatch[1].trim(),
    description: (descMatch?.[1] ?? "").trim(),
    phases,
    history,
  };
}

function parseProgressHistory(markdown: string): ProgressRecord[] {
  const section = markdown.split(/^##\s*进度历史\s*$/m)[1];
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  const records: ProgressRecord[] = [];
  let inTable = false;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      if (inTable) break;
      continue;
    }
    const cells = splitProgressRow(line);
    if (cells[0] === "日期" || /^[-: ]+$/.test(cells[0])) {
      inTable = true;
      continue;
    }
    inTable = true;
    if (cells.length < 3) continue;
    const percent = Number(cells[1].replace("%", ""));
    if (!Number.isFinite(percent)) continue;
    records.push({ date: cells[0], percent, note: cells[2] });
  }
  return records;
}

/** Progress notes are single-line; `\` and `|` are escaped in the table. */
export function normalizeProgressNote(note: string): string {
  return note.replace(/\r?\n/g, " ").replace(/[ \t]+/g, " ").trim();
}

function escapeProgressCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function splitProgressRow(line: string): string[] {
  const trimmed = line.trim();
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
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "") cells.push(current.trim());
  return cells;
}

export function appendProgressRecord(
  markdown: string,
  record: ProgressRecord,
): string {
  if (!isValidDate(record.date)) {
    throw new ValidationError(`invalid progress date: ${record.date}`);
  }
  if (record.percent < 0 || record.percent > 100) {
    throw new ValidationError("progress must be 0..100");
  }
  const note = normalizeProgressNote(record.note);
  if (note === "") throw new ValidationError("progress note is empty");
  const row = `| ${record.date} | ${record.percent}% | ${escapeProgressCell(note)} |`;
  const lines = markdown.split(/\r?\n/);
  const sectionIndex = lines.findIndex((line) => /^##\s*进度历史\s*$/.test(line.trim()));
  if (sectionIndex < 0) {
    return `${markdown.trimEnd()}\n\n## 进度历史\n\n| 日期 | 进度 | 说明 |\n|---|---|---|\n${row}\n`;
  }

  let tableEnd = -1;
  let headerIndex = -1;
  for (let i = sectionIndex + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    if (lines[i].trim().startsWith("|")) {
      if (headerIndex < 0) headerIndex = i;
      tableEnd = i;
    }
  }
  if (headerIndex < 0) {
    lines.splice(sectionIndex + 1, 0, "", "| 日期 | 进度 | 说明 |", "|---|---|---|", row);
  } else {
    lines.splice(tableEnd + 1, 0, row);
  }
  return lines.join("\n");
}

/** Progress is computed from task-table ownership, not the document list. */
export function computeGoalProgress(goal: Goal, tasks: Task[]): GoalProgress {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const declaredPhaseIds = new Set(goal.phases.map((phase) => phase.id));
  const goalTasks = tasks.filter((task) => task.goalId === goal.id);

  // Diagnostics for the human-maintained reference list in the goal document.
  const missing: string[] = [];
  const mismatched: string[] = [];
  const duplicates: string[] = [];
  const listed = new Set<string>();
  for (const phase of goal.phases) {
    for (const taskId of phase.taskIds) {
      if (listed.has(taskId)) duplicates.push(taskId);
      listed.add(taskId);
      const task = byId.get(taskId);
      if (!task) {
        missing.push(taskId);
        continue;
      }
      if (task.goalId !== goal.id || task.phaseId !== phase.id) {
        mismatched.push(taskId);
      }
    }
  }

  let archived = 0;
  let total = 0;
  let completed = 0;
  const unassigned: string[] = [];
  const unlisted: string[] = [];
  for (const task of goalTasks) {
    if (!listed.has(task.id)) unlisted.push(task.id);
    if (task.phaseId === "" || !declaredPhaseIds.has(task.phaseId)) {
      unassigned.push(task.id);
    }
    if (task.status === "archived") {
      archived++;
      continue;
    }
    total++;
    if (task.status === "done") completed++;
  }

  const phases = goal.phases.map((phase) => {
    const phaseTasks = goalTasks.filter((task) => task.phaseId === phase.id);
    const active = phaseTasks.filter((task) => task.status !== "archived");
    const done = active.filter((task) => task.status === "done");
    return {
      phaseId: phase.id,
      name: phase.name,
      totalTasks: active.length,
      completedTasks: done.length,
      percent: active.length === 0 ? 0 : Math.round((done.length / active.length) * 100),
    };
  });

  return {
    goalId: goal.id,
    totalTasks: total,
    completedTasks: completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    archivedTasks: archived,
    missingTaskIds: [...new Set(missing)],
    mismatchedTaskIds: [...new Set(mismatched)],
    duplicateTaskIds: [...new Set(duplicates)],
    unlistedTaskIds: [...new Set(unlisted)],
    unassignedTaskIds: [...new Set(unassigned)],
    phases,
  };
}
