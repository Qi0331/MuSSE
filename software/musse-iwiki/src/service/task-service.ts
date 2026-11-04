import type { Goal, Priority, Task, TaskStatus } from "../types.ts";
import {
  ConflictError,
  NotFoundError,
  UnavailableError,
  ValidationError,
} from "../types.ts";
import {
  daysUntil,
  formatShanghai,
  isDueToday,
  isOverdue,
  shanghaiNow,
} from "../date.ts";
import {
  parseTaskTable,
  serializeTaskTable,
  updateTaskRow,
  validateTask,
} from "../markdown/tasks.ts";
import {
  appendProgressRecord,
  computeGoalProgress,
  normalizeProgressNote,
  parseGoal,
} from "../markdown/goals.ts";
import { appendNote, latestNotes, parseNotes } from "../markdown/notes.ts";
import type { WikiStore } from "../store/wiki-store.ts";
import { DOC_PATHS, goalPath } from "../store/wiki-store.ts";

export interface CreateTaskInput {
  id?: string;
  title: string;
  description?: string;
  category?: string;
  priority?: Priority;
  dueDate: string;
  dueTime?: string;
  goalId?: string;
  phaseId?: string;
}

export interface TaskFilter {
  id?: string;
  status?: TaskStatus;
  category?: string;
  goalId?: string;
  priority?: Priority;
}

export interface TaskView {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  category: string;
  dueDate: string;
  dueTime: string;
  goalId: string;
  phaseId: string;
  overdue: boolean;
}

function view(task: Task, now: Date): TaskView {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    category: task.category,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    goalId: task.goalId,
    phaseId: task.phaseId,
    overdue: isOverdue(task, now),
  };
}

function newId(now: Date): string {
  const { date } = shanghaiNow(now);
  const suffix = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, "0")
    .toUpperCase();
  return `T-${date.replace(/-/g, "")}-${suffix}`;
}

const EDITABLE_TASK_FIELDS = new Set([
  "title",
  "description",
  "category",
  "priority",
  "dueDate",
  "dueTime",
  "goalId",
  "phaseId",
]);

const GOAL_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function assertStringField(patch: Record<string, unknown>, key: string): void {
  if (key in patch && typeof patch[key] !== "string") {
    throw new ValidationError(`${key} must be a string`);
  }
}

/**
 * Business logic. The task table is the single authoritative location for a
 * task's status; goal documents only reference task IDs and are recomputed
 * from the table.
 */
export class TaskService {
  private readonly store: WikiStore;

  constructor(store: WikiStore) {
    this.store = store;
  }

  private async loadTasks(): Promise<{ content: string; version: string; tasks: Task[] }> {
    const doc = await this.store.read(DOC_PATHS.tasks);
    return {
      content: doc.content,
      version: doc.version,
      tasks: parseTaskTable(doc.content),
    };
  }

  private async writeTasks(
    content: string,
    version: string,
  ): Promise<{ content: string; version: string; tasks: Task[] }> {
    await this.store.write(DOC_PATHS.tasks, content, version);
    const after = await this.store.read(DOC_PATHS.tasks);
    if (after.content !== content) {
      throw new ConflictError(
        "task document changed during write; refusing to report success",
      );
    }
    return { content: after.content, version: after.version, tasks: parseTaskTable(after.content) };
  }

  /**
   * Validates that a non-empty goal/phase reference exists and that the phase
   * belongs to that goal. Rejects path-like IDs (/, \\, ..) to avoid writing
   * outside the goal directory.
   */
  private async validateGoalReference(goalId: string, phaseId: string): Promise<void> {
    const goal = goalId.trim();
    const phase = phaseId.trim();
    if (goal === "" && phase === "") return;
    if (goal === "") {
      throw new ValidationError("phaseId requires a non-empty goalId");
    }
    if (!GOAL_ID_PATTERN.test(goal)) {
      throw new ValidationError(`invalid goal ID: ${goal}`);
    }
    let goalDoc;
    try {
      goalDoc = await this.store.read(goalPath(goal));
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new ValidationError(`goal not found: ${goal}`);
      }
      throw error;
    }
    const parsed = parseGoal(goalDoc.content);
    if (parsed.id !== goal) {
      throw new ValidationError(
        `goal document ${goalPath(goal)} contains ID ${parsed.id}, expected ${goal}`,
      );
    }
    if (phase !== "" && !parsed.phases.some((item) => item.id === phase)) {
      throw new ValidationError(`phase not found in goal ${goal}: ${phase}`);
    }
  }

  private assertEditablePatch(patch: Record<string, unknown>): void {
    for (const key of Object.keys(patch)) {
      if (!EDITABLE_TASK_FIELDS.has(key)) {
        throw new ValidationError(`field is not editable: ${key}`);
      }
    }
    assertStringField(patch, "title");
    assertStringField(patch, "description");
    assertStringField(patch, "category");
    assertStringField(patch, "dueDate");
    assertStringField(patch, "dueTime");
    assertStringField(patch, "goalId");
    assertStringField(patch, "phaseId");
    if ("priority" in patch &&
        !["P0", "P1", "P2", "P3"].includes(String(patch.priority))) {
      throw new ValidationError(`invalid priority: ${String(patch.priority)}`);
    }
  }

  async listTasks(filter: TaskFilter = {}): Promise<TaskView[]> {
    const { tasks } = await this.loadTasks();
    const now = new Date();
    return tasks
      .filter((task) => {
        if (filter.id !== undefined && task.id !== filter.id) return false;
        if (filter.status !== undefined && task.status !== filter.status) return false;
        if (filter.category !== undefined && task.category !== filter.category) return false;
        if (filter.goalId !== undefined && task.goalId !== filter.goalId) return false;
        if (filter.priority !== undefined && task.priority !== filter.priority) return false;
        return true;
      })
      .map((task) => view(task, now));
  }

  async createTask(input: CreateTaskInput, now: Date = new Date()): Promise<TaskView> {
    if (typeof input.title !== "string" || input.title.trim() === "") {
      throw new ValidationError("title is required and must be a string");
    }
    if (typeof input.dueDate !== "string") {
      throw new ValidationError("dueDate must be a string");
    }
    for (const key of ["description", "category", "dueTime", "goalId", "phaseId"] as const) {
      if (input[key] !== undefined && typeof input[key] !== "string") {
        throw new ValidationError(`${key} must be a string`);
      }
    }
    if (input.priority !== undefined && !["P0", "P1", "P2", "P3"].includes(input.priority)) {
      throw new ValidationError(`invalid priority: ${String(input.priority)}`);
    }
    const { content, version, tasks } = await this.loadTasks();
    const id = input.id?.trim() || newId(now);
    if (tasks.some((task) => task.id === id)) {
      throw new ValidationError(`task ID already exists: ${id}`);
    }
    const task: Task = {
      id,
      title: input.title.trim(),
      description: (input.description ?? "").trim(),
      category: (input.category ?? "").trim(),
      priority: input.priority ?? "P2",
      status: "todo",
      dueDate: input.dueDate,
      dueTime: input.dueTime ?? "",
      goalId: (input.goalId ?? "").trim(),
      phaseId: (input.phaseId ?? "").trim(),
      createdAt: formatShanghai(now),
      completedAt: "",
    };
    validateTask(task);
    await this.validateGoalReference(task.goalId, task.phaseId);

    const next = serializeTaskTable(content, [...tasks, task]);
    const after = await this.writeTasks(next, version);
    const created = after.tasks.find((candidate) => candidate.id === id);
    if (!created) throw new ConflictError("created task not found after write");
    for (const original of tasks) {
      const still = after.tasks.find((candidate) => candidate.id === original.id);
      if (!still || JSON.stringify(still) !== JSON.stringify(original)) {
        throw new ConflictError(`unrelated task changed during create: ${original.id}`);
      }
    }
    return view(created, now);
  }

  async updateTask(
    id: string,
    patch: Partial<Omit<Task, "id" | "status" | "completedAt">>,
    now: Date = new Date(),
  ): Promise<TaskView> {
    const rawPatch = patch as Record<string, unknown>;
    this.assertEditablePatch(rawPatch);
    const { content, version, tasks } = await this.loadTasks();
    const current = tasks.find((task) => task.id === id);
    if (!current) throw new NotFoundError(`task not found: ${id}`);
    const next = { ...current, ...rawPatch, id: current.id };
    validateTask(next);
    await this.validateGoalReference(next.goalId, next.phaseId);
    const updated = updateTaskRow(content, id, rawPatch as Partial<Task>);
    const after = await this.writeTasks(updated, version);
    const updatedTask = after.tasks.find((task) => task.id === id);
    if (!updatedTask) throw new ConflictError("updated task not found after write");
    if (updatedTask.title !== next.title || updatedTask.dueDate !== next.dueDate) {
      throw new ConflictError("task content mismatch after write");
    }
    return view(updatedTask, now);
  }

  async completeTask(id: string, now: Date = new Date()): Promise<TaskView> {
    const { content, version, tasks } = await this.loadTasks();
    const current = tasks.find((task) => task.id === id);
    if (!current) throw new NotFoundError(`task not found: ${id}`);
    if (current.status === "archived") {
      throw new ValidationError("archived task must be restored before completing");
    }
    if (current.status === "done") return view(current, now);

    const updated = updateTaskRow(content, id, {
      status: "done",
      completedAt: formatShanghai(now),
    });
    const after = await this.writeTasks(updated, version);
    const task = after.tasks.find((candidate) => candidate.id === id);
    if (!task || task.status !== "done") {
      throw new ConflictError("completion was not persisted");
    }
    return view(task, now);
  }

  async archiveTask(id: string, now: Date = new Date()): Promise<TaskView> {
    const { content, version, tasks } = await this.loadTasks();
    const current = tasks.find((task) => task.id === id);
    if (!current) throw new NotFoundError(`task not found: ${id}`);
    if (current.status === "archived") return view(current, now);
    const updated = updateTaskRow(content, id, {
      status: "archived",
      completedAt: "",
    });
    const after = await this.writeTasks(updated, version);
    const task = after.tasks.find((candidate) => candidate.id === id);
    if (!task || task.status !== "archived") {
      throw new ConflictError("archive was not persisted");
    }
    return view(task, now);
  }

  async restoreTask(id: string, now: Date = new Date()): Promise<TaskView> {
    const { content, version, tasks } = await this.loadTasks();
    const current = tasks.find((task) => task.id === id);
    if (!current) throw new NotFoundError(`task not found: ${id}`);
    if (current.status === "todo") return view(current, now);
    const updated = updateTaskRow(content, id, {
      status: "todo",
      completedAt: "",
    });
    const after = await this.writeTasks(updated, version);
    const task = after.tasks.find((candidate) => candidate.id === id);
    if (!task || task.status !== "todo") {
      throw new ConflictError("restore was not persisted");
    }
    return view(task, now);
  }

  async scheduleToday(now: Date = new Date()): Promise<TaskView[]> {
    const { tasks } = await this.loadTasks();
    return tasks.filter((task) => isDueToday(task, now)).map((task) => view(task, now));
  }

  async scheduleUpcoming(days = 7, now: Date = new Date()): Promise<TaskView[]> {
    if (days < 0 || days > 60) throw new ValidationError("days must be 0..60");
    const { tasks } = await this.loadTasks();
    return tasks
      .filter((task) => task.status === "todo")
      .filter((task) => {
        const delta = daysUntil(task.dueDate, now);
        return delta > 0 && delta <= days;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((task) => view(task, now));
  }

  async scheduleOverdue(now: Date = new Date()): Promise<TaskView[]> {
    const { tasks } = await this.loadTasks();
    return tasks
      .filter((task) => isOverdue(task, now))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((task) => view(task, now));
  }

  async queryGoal(goalId: string): Promise<{ goal: Goal; progress: ReturnType<typeof computeGoalProgress> }> {
    if (!GOAL_ID_PATTERN.test(goalId)) {
      throw new ValidationError(`invalid goal ID: ${goalId}`);
    }
    const doc = await this.store.read(goalPath(goalId));
    const goal = parseGoal(doc.content);
    if (goal.id !== goalId) {
      throw new ValidationError(
        `goal document ${goalPath(goalId)} contains ID ${goal.id}`,
      );
    }
    const { tasks } = await this.loadTasks();
    return { goal, progress: computeGoalProgress(goal, tasks) };
  }

  async recordGoalProgress(
    goalId: string,
    note: string,
    now: Date = new Date(),
  ): Promise<{ goalId: string; percent: number; note: string; date: string }> {
    if (!GOAL_ID_PATTERN.test(goalId)) {
      throw new ValidationError(`invalid goal ID: ${goalId}`);
    }
    const normalized = normalizeProgressNote(note);
    if (normalized === "") throw new ValidationError("progress note is required");
    const doc = await this.store.read(goalPath(goalId));
    const goal = parseGoal(doc.content);
    if (goal.id !== goalId) {
      throw new ValidationError(
        `goal document ${goalPath(goalId)} contains ID ${goal.id}, expected ${goalId}`,
      );
    }
    const { tasks } = await this.loadTasks();
    const progress = computeGoalProgress(goal, tasks);
    const date = shanghaiNow(now).date;
    const next = appendProgressRecord(doc.content, {
      date,
      percent: progress.percent,
      note: normalized,
    });
    await this.store.write(goalPath(goalId), next, doc.version);
    const after = await this.store.read(goalPath(goalId));
    if (after.content !== next) {
      throw new ConflictError("goal progress write could not be verified");
    }
    return { goalId, percent: progress.percent, note: normalized, date };
  }

  async createNote(content: string, now: Date = new Date()): Promise<{ createdAt: string }> {
    let doc;
    try {
      doc = await this.store.read(DOC_PATHS.notes);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      doc = { path: DOC_PATHS.notes, content: "# 快捷笔记\n", version: "" };
    }
    const timestamp = formatShanghai(now);
    const appended = appendNote(doc.content, timestamp, content);
    const next = appended.markdown;
    if (doc.version === "") {
      await this.store.write(DOC_PATHS.notes, next);
    } else {
      await this.store.write(DOC_PATHS.notes, next, doc.version);
    }
    const after = await this.store.read(DOC_PATHS.notes);
    if (after.content !== next) {
      throw new ConflictError("note write could not be verified");
    }
    return { createdAt: appended.heading };
  }

  async queryNotes(limit = 20): Promise<Array<{ id: string; createdAt: string; content: string }>> {
    if (limit < 1 || limit > 100) throw new ValidationError("limit must be 1..100");
    let doc;
    try {
      doc = await this.store.read(DOC_PATHS.notes);
    } catch (error) {
      if (error instanceof NotFoundError) return [];
      throw error;
    }
    return latestNotes(parseNotes(doc.content), limit);
  }
}

/** Explicit failure when the iWiki store has not been configured. */
export function unavailableStore(): WikiStore {
  const fail = async (): Promise<never> => {
    throw new UnavailableError(
      "iWiki is not configured. No local fallback is used for persistence.",
    );
  };
  return { read: fail, write: fail, list: fail };
}
