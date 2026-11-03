import { TOOL_DEFINITIONS, callTool } from "./tools.ts";
import type { TaskService } from "../service/task-service.ts";
import { MusseError, ValidationError } from "../types.ts";

/** S4-B: task/schedule queries only; S4-C goal/notes and S5 writes are out of scope. */
const ALLOWED_NAMES = new Set([
  "task_query",
  "schedule_today",
  "schedule_upcoming",
  "schedule_overdue",
]);

// Reuse the existing argument schemas; do not publish any mutation tool.
export const READONLY_TASK_TOOLS = TOOL_DEFINITIONS.filter((tool) => ALLOWED_NAMES.has(tool.name));

export async function callReadonlyTaskTool(
  service: TaskService,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // Enforce the allowlist at call time as well as at tools/list.
  if (!ALLOWED_NAMES.has(name)) {
    throw new MusseError("TOOL_NOT_FOUND", "tool is not available in S4-B read-only mode");
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
  return callTool(service, name, args);
}
