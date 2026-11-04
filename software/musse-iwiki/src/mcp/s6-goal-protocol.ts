import { S6Error } from "../goals/s6-goal-discovery.ts";
import type { createS6GoalFlow } from "../goals/s6-goal-flow.ts";

type Flow = ReturnType<typeof createS6GoalFlow>;
export const S6_GOAL_TOOLS = [
  {
    name: "musse_goal_find",
    description: "Read one G-xxx goal through exact, bounded folder discovery; never search by approximate title.",
    inputSchema: { type: "object", properties: { goalId: { type: "string" } }, required: ["goalId"] },
  },
  {
    name: "musse_goal_prepare",
    description: "Read and PREVIEW a goal_create, goal_update or goal_record_progress. Do NOT confirm until the USER independently says 确认写入 or 确认保存 in the NEXT utterance.",
    inputSchema: {
      type: "object",
      properties: { intent: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["goal_create", "goal_update", "goal_record_progress"] },
          goalId: { type: "string", description: "G-001 etc, not a page ID" },
          title: { type: "string" }, description: { type: "string" },
          phases: { type: "array", items: { type: "object" } },
          changes: { type: "object", description: "title, description or addPhase {id,name}" },
          note: { type: "string" },
        },
        required: ["type", "goalId"],
      } },
      required: ["intent"],
    },
  },
  {
    name: "musse_goal_confirm",
    description: "Only commit a previously previewed proposal after a NEW, explicit user confirmation utterance. Never invent this phrase.",
    inputSchema: { type: "object", properties: {
      operationId: { type: "string" }, spokenText: { type: "string" },
    }, required: ["operationId", "spokenText"] },
  },
  {
    name: "musse_goal_cancel",
    description: "Cancel a prepared goal change, without remote writing.",
    inputSchema: { type: "object", properties: { operationId: { type: "string" } }, required: ["operationId"] },
  },
] as const;

const obj = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new S6Error("S6_INVALID_ARGUMENTS");
  return value as Record<string, unknown>;
};
const str = (args: Record<string, unknown>, name: string) => {
  if (typeof args[name] !== "string" || !args[name].trim()) throw new S6Error("S6_INVALID_ARGUMENTS");
  return args[name] as string;
};
export async function handleS6GoalRpc(flow: Flow, message: unknown): Promise<Record<string, unknown> | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const req = message as Record<string, unknown>;
  if (req.id === undefined) return null;
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: req.id, result });
  if (req.method === "initialize") return reply({
    protocolVersion: "2025-06-18", capabilities: { tools: {} },
    serverInfo: { name: "musse-iwiki-s6-goals", version: "0.1.0" },
  });
  if (req.method === "ping") return reply({});
  if (req.method === "tools/list") return reply({ tools: S6_GOAL_TOOLS });
  if (req.method !== "tools/call") return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "method not found" } };
  try {
    const params = obj(req.params);
    const args = obj(params.arguments ?? {});
    let value: unknown;
    switch (str(params, "name")) {
      case "musse_goal_find": value = await flow.find(str(args, "goalId")); break;
      case "musse_goal_prepare": value = await flow.prepare(args.intent); break;
      case "musse_goal_confirm":
        value = await flow.confirm(str(args, "operationId"), str(args, "spokenText")); break;
      case "musse_goal_cancel": value = flow.cancel(str(args, "operationId")); break;
      default: throw new S6Error("S6_UNKNOWN_TOOL");
    }
    return reply({ content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value });
  } catch (error) {
    const safe = { ok: false, code: error instanceof S6Error ? error.code : "S6_OPERATION_FAILED" };
    return reply({ content: [{ type: "text", text: JSON.stringify(safe) }], structuredContent: safe, isError: true });
  }
}
