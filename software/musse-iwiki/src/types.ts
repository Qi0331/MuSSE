export type TaskStatus = "todo" | "done" | "archived";
export type Priority = "P0" | "P1" | "P2" | "P3";

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD, Asia/Shanghai
  dueTime: string; // HH:mm or ""
  goalId: string;
  phaseId: string;
  createdAt: string; // ISO-like Beijing time
  completedAt: string;
}

export interface Phase {
  id: string;
  name: string;
  taskIds: string[];
  manualProgress: string;
}

export interface ProgressRecord {
  date: string;
  percent: number;
  note: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  phases: Phase[];
  history: ProgressRecord[];
}

export interface GoalProgress {
  goalId: string;
  totalTasks: number;
  completedTasks: number;
  percent: number;
  archivedTasks: number;
  missingTaskIds: string[];
  mismatchedTaskIds: string[];
  duplicateTaskIds: string[];
  /** Goal tasks present in the task table but absent from the goal document. */
  unlistedTaskIds: string[];
  /** Goal tasks whose phaseId is empty or not declared in the goal document. */
  unassignedTaskIds: string[];
  phases: Array<{
    phaseId: string;
    name: string;
    totalTasks: number;
    completedTasks: number;
    percent: number;
  }>;
}

export interface Note {
  id: string;
  createdAt: string;
  content: string;
}

export class MusseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "MusseError";
  }
}

export class ParseError extends MusseError {
  constructor(message: string) {
    super("PARSE_ERROR", message);
    this.name = "ParseError";
  }
}

export class NotFoundError extends MusseError {
  constructor(message: string) {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends MusseError {
  constructor(message: string) {
    super("CONFLICT", message);
    this.name = "ConflictError";
  }
}

export class UnavailableError extends MusseError {
  constructor(message: string) {
    super("UNAVAILABLE", message);
    this.name = "UnavailableError";
  }
}

export class ValidationError extends MusseError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
    this.name = "ValidationError";
  }
}
