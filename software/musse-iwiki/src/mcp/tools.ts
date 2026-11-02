import type { TaskService } from "../service/task-service.ts";
import { MusseError, ValidationError } from "../types.ts";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new ValidationError(`${key} must be a string`);
  }
  return value;
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`${key} must be a string`);
  }
  return value;
}

function requireInt(
  args: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${key} must be an integer in ${min}..${max}`);
  }
  return value;
}

const str = (description: string) => ({ type: "string", description });
const optionalStr = (description: string) => ({ type: "string", description });

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "task_create",
    description: "Create a task in the authoritative iWiki task table.",
    inputSchema: {
      type: "object",
      properties: {
        title: str("Task title"),
        description: optionalStr("Optional details"),
        category: optionalStr("Category"),
        priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
        dueDate: str("Due date YYYY-MM-DD (Asia/Shanghai)"),
        dueTime: optionalStr("Optional due time HH:mm; date-only means end of day"),
        goalId: optionalStr("Related goal ID"),
        phaseId: optionalStr("Related phase ID"),
        id: optionalStr("Optional stable task ID"),
      },
      required: ["title", "dueDate"],
    },
  },
  {
    name: "task_query",
    description: "Query tasks by stable ID or filters.",
    inputSchema: {
      type: "object",
      properties: {
        id: optionalStr("Stable task ID"),
        status: { type: "string", enum: ["todo", "done", "archived"] },
        category: optionalStr("Category"),
        goalId: optionalStr("Goal ID"),
        priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
      },
    },
  },
  {
    name: "task_update",
    description: "Update editable fields of a task; status changes use dedicated tools.",
    inputSchema: {
      type: "object",
      properties: {
        id: str("Stable task ID"),
        title: optionalStr("New title"),
        description: optionalStr("New description"),
        category: optionalStr("New category"),
        priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
        dueDate: optionalStr("New due date YYYY-MM-DD"),
        dueTime: optionalStr("New due time HH:mm or empty"),
        goalId: optionalStr("New goal ID"),
        phaseId: optionalStr("New phase ID"),
      },
      required: ["id"],
    },
  },
  {
    name: "task_complete",
    description: "Mark a task done.",
    inputSchema: { type: "object", properties: { id: str("Stable task ID") }, required: ["id"] },
  },
  {
    name: "task_archive",
    description: "Archive a task without deleting its document record.",
    inputSchema: { type: "object", properties: { id: str("Stable task ID") }, required: ["id"] },
  },
  {
    name: "task_restore",
    description: "Restore a done/archived task to todo.",
    inputSchema: { type: "object", properties: { id: str("Stable task ID") }, required: ["id"] },
  },
  {
    name: "schedule_today",
    description: "Tasks due today in Asia/Shanghai.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "schedule_upcoming",
    description: "Active tasks due in the next N days (default 7).",
    inputSchema: {
      type: "object",
      properties: { days: { type: "integer", minimum: 0, maximum: 60 } },
    },
  },
  {
    name: "schedule_overdue",
    description: "Active tasks whose deadline has passed; completed tasks are excluded.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "goal_query",
    description: "Read a long-term goal and compute progress from the task table.",
    inputSchema: { type: "object", properties: { goalId: str("Goal ID") }, required: ["goalId"] },
  },
  {
    name: "goal_record_progress",
    description: "Append a progress note; percent is computed from task status, never estimated.",
    inputSchema: {
      type: "object",
      properties: { goalId: str("Goal ID"), note: str("Progress note") },
      required: ["goalId", "note"],
    },
  },
  {
    name: "note_create",
    description: "Append a quick note to the iWiki notes document.",
    inputSchema: {
      type: "object",
      properties: { content: str("Note content") },
      required: ["content"],
    },
  },
  {
    name: "note_query",
    description: "Read recent quick notes (newest first).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 100 } },
    },
  },
];

export async function callTool(
  service: TaskService,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "task_create":
      return service.createTask({
        id: optionalString(args, "id"),
        title: requireString(args, "title"),
        description: optionalString(args, "description"),
        category: optionalString(args, "category"),
        priority: args.priority as never,
        dueDate: requireString(args, "dueDate"),
        dueTime: optionalString(args, "dueTime"),
        goalId: optionalString(args, "goalId"),
        phaseId: optionalString(args, "phaseId"),
      });
    case "task_query":
      return service.listTasks({
        id: optionalString(args, "id"),
        status: args.status as never,
        category: optionalString(args, "category"),
        goalId: optionalString(args, "goalId"),
        priority: args.priority as never,
      });
    case "task_update": {
      const id = requireString(args, "id");
      const patch = { ...args } as Record<string, unknown>;
      delete patch.id;
      return service.updateTask(id, patch as never);
    }
    case "task_complete":
      return service.completeTask(requireString(args, "id"));
    case "task_archive":
      return service.archiveTask(requireString(args, "id"));
    case "task_restore":
      return service.restoreTask(requireString(args, "id"));
    case "schedule_today":
      return service.scheduleToday();
    case "schedule_upcoming":
      return service.scheduleUpcoming(
        args.days === undefined ? 7 : requireInt(args, "days", 0, 60),
      );
    case "schedule_overdue":
      return service.scheduleOverdue();
    case "goal_query":
      return service.queryGoal(requireString(args, "goalId"));
    case "goal_record_progress":
      return service.recordGoalProgress(
        requireString(args, "goalId"),
        requireString(args, "note"),
      );
    case "note_create":
      return service.createNote(requireString(args, "content"));
    case "note_query":
      return service.queryNotes(
        args.limit === undefined ? 20 : requireInt(args, "limit", 1, 100),
      );
    default:
      throw new MusseError("TOOL_NOT_FOUND", `unknown tool: ${name}`);
  }
}
