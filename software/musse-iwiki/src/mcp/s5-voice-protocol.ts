import { S5GateError } from "../write/guarded-write.ts";
import type { createS5VoiceFlow } from "../write/voice-flow.ts";

type VoiceFlow = Pick<ReturnType<typeof createS5VoiceFlow>, "prepare" | "confirm" | "cancel">;

/**
 * Optional S5-only MCP protocol. Never exposed by the existing read-only server.
 * The conversational model MUST wait for an explicit new user utterance before
 * calling write_confirm. This is a UX rule, not independent speaker authentication.
 */
export const S5_VOICE_TOOLS = [
  {
    name: "musse_write_prepare",
    description: "Plan a change to MuSSE tasks or notes. This tool only reads iWiki and returns a complete preview. Read the preview to the user, then ask whether to save. Do NOT call musse_write_confirm until the USER explicitly confirms in a new utterance.",
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "object",
          description: "Change details. Supported type values: task_create, task_update, task_complete, task_archive, task_restore, note_create.",
          properties: {
            type: { type: "string", enum: ["task_create", "task_update", "task_complete", "task_archive", "task_restore", "note_create"] },
            taskId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
            dueDate: { type: "string", description: "YYYY-MM-DD" },
            dueTime: { type: "string", description: "HH:mm" },
            changes: { type: "object", description: "Editable task fields to change" },
            content: { type: "string" },
          },
          required: ["type"],
        },
      },
      required: ["intent"],
    },
  },
  {
    name: "musse_write_confirm",
    description: "Commit ONLY a previous prepared change, and ONLY when the user has just explicitly said 确认写入 or 确认保存. The assistant must never invent that user utterance. If the preview is stale, tell the user and prepare again.",
    inputSchema: {
      type: "object",
      properties: {
        operationId: { type: "string", description: "The operationId from musse_write_prepare" },
        spokenText: { type: "string", description: "The actual user confirmation phrase from the next utterance" },
      },
      required: ["operationId", "spokenText"],
    },
  },
  {
    name: "musse_write_cancel",
    description: "Cancel a previously prepared MuSSE change without writing anything.",
    inputSchema: {
      type: "object",
      properties: { operationId: { type: "string" } },
      required: ["operationId"],
    },
  },
] as const;

const obj = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new S5GateError("S5_INVALID_ARGUMENTS");
  return input as Record<string, unknown>;
};
const requiredString = (args: Record<string, unknown>, name: string): string => {
  const value = args[name];
  if (typeof value !== "string" || value.trim() === "") throw new S5GateError("S5_INVALID_ARGUMENTS");
  return value;
};

export async function handleS5VoiceRpc(
  flow: VoiceFlow, message: unknown, options: { previewOnly?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const request = message as Record<string, unknown>;
  if (request.id === undefined) return null;
  const id = request.id;
  const reply = (value: unknown) => ({ jsonrpc: "2.0", id, result: value });
  switch (request.method) {
    case "initialize":
      return reply({
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "musse-iwiki-voice-write", version: "0.1.0" },
      });
    case "ping": return reply({});
    case "tools/list": return reply({ tools: options.previewOnly
      ? S5_VOICE_TOOLS.filter((tool) => tool.name !== "musse_write_confirm")
      : S5_VOICE_TOOLS });
    case "tools/call": {
      try {
        const params = obj(request.params);
        const name = requiredString(params, "name");
        const args = obj(params.arguments ?? {});
        let value: unknown;
        switch (name) {
          case "musse_write_prepare":
            if (!Object.hasOwn(args, "intent")) throw new S5GateError("S5_INVALID_ARGUMENTS");
            value = await flow.prepare(args.intent);
            break;
          case "musse_write_confirm":
            if (options.previewOnly) throw new S5GateError("S5_PREVIEW_ONLY");
            value = await flow.confirm(requiredString(args, "operationId"), requiredString(args, "spokenText"));
            break;
          case "musse_write_cancel":
            flow.cancel(requiredString(args, "operationId"));
            value = { canceled: true };
            break;
          default:
            throw new S5GateError("S5_UNKNOWN_TOOL");
        }
        return reply({
          content: [{ type: "text", text: JSON.stringify(value) }],
          structuredContent: value,
        });
      } catch (error) {
        const code = error instanceof S5GateError ? error.code : "S5_OPERATION_FAILED";
        const safe = { ok: false, code };
        return reply({
          content: [{ type: "text", text: JSON.stringify(safe) }],
          structuredContent: safe,
          isError: true,
        });
      }
    }
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: "method not found" } };
  }
}
