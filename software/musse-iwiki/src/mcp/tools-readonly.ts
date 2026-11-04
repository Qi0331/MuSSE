import { TOOL_DEFINITIONS, callTool } from "./tools.ts";
import type { TaskService } from "../service/task-service.ts";
import { MusseError, ValidationError } from "../types.ts";

/** S4-B/C: six read-only queries; S5 mutations are never exposed. */
const ALLOWED_NAMES = new Set([
  "task_query",
  "schedule_today",
  "schedule_upcoming",
  "schedule_overdue",
  "goal_query",
  "note_query",
]);

// Reuse the existing argument schemas; do not publish any mutation tool.
export const READONLY_TOOLS = TOOL_DEFINITIONS.filter((tool) => ALLOWED_NAMES.has(tool.name));

export async function callReadonlyTool(
  service: TaskService,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // Enforce the allowlist at call time as well as at tools/list.
  if (!ALLOWED_NAMES.has(name)) {
    throw new MusseError("TOOL_NOT_FOUND", "tool is not available in read-only mode");
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new ValidationError("arguments must be an object");
  }
  // The existing generic handler trusts MCP-schema validation for these fields.
  // Validate here too so invalid filters never silently produce an empty result.
  if (name === "task_query") {
    if (args.status !== undefined && !["todo", "done", "archived"].includes(args.status as string)) {
      throw new ValidationError("invalid task status");
    }
    if (args.priority !== undefined && !["P0", "P1", "P2", "P3"].includes(args.priority as string)) {
      throw new ValidationError("invalid task priority");
    }
  }
  if (name === "goal_query" &&
      (typeof args.goalId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(args.goalId))) {
    throw new ValidationError("invalid goal ID");
  }
  // Existing callTool validates note limit (1..100) and upcoming days (0..60).
  return callTool(service, name, args);
}
