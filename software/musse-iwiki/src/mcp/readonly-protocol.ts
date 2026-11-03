import { MusseError } from "../types.ts";
import type { TaskService } from "../service/task-service.ts";
import { READONLY_TOOLS, callReadonlyTool } from "./tools-readonly.ts";

/** One request at a time, compatible with the existing minimal line-delimited stdio MCP server. */
export async function handleReadonlyRpc(
  service: TaskService,
  message: unknown,
): Promise<Record<string, unknown> | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const request = message as Record<string, unknown>;
  if (request.id === undefined) return null; // notification
  const id = request.id;
  const result = (value: unknown) => ({ jsonrpc: "2.0", id, result: value });

  switch (request.method) {
    case "initialize":
      return result({
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "musse-iwiki-readonly", version: "0.1.0" },
      });
    case "ping":
      return result({});
    case "tools/list":
      return result({ tools: READONLY_TOOLS });
    case "tools/call": {
      try {
        const params = request.params;
        if (!params || typeof params !== "object" || Array.isArray(params)) {
          throw new MusseError("VALIDATION_ERROR", "invalid tool parameters");
        }
        const tool = params as Record<string, unknown>;
        if (typeof tool.name !== "string") {
          throw new MusseError("VALIDATION_ERROR", "tool name is required");
        }
        const args = tool.arguments === undefined ? {} : tool.arguments;
        const value = await callReadonlyTool(
          service,
          tool.name,
          args as Record<string, unknown>,
        );
        return result({
          content: [{ type: "text", text: JSON.stringify(value) }],
          structuredContent: value,
        });
      } catch (error) {
        // Never relay raw upstream errors, paths or private task data into logs.
        const code = error instanceof MusseError ? error.code : "INTERNAL_ERROR";
        const safe = { ok: false, code, message: "Read-only query failed or was rejected" };
        return result({
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
