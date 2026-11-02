import { MusseError, UnavailableError } from "../types.ts";

export interface IwikiMcpConfig {
  endpoint: string;
  token?: string;
  /** Optional explicit tool names; never guessed silently. */
  toolNames?: {
    readDocument?: string;
    writeDocument?: string;
    listDocuments?: string;
  };
  requestTimeoutMs?: number;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/**
 * Minimal MCP client for the Streamable HTTP transport (MCP 2025-06-18).
 *
 * IMPORTANT: this class only performs protocol-level JSON-RPC. It does not
 * claim any iWiki tool name or argument schema: those must be resolved from
 * the live server (tools/list) or supplied explicitly after official
 * documentation/authorized testing.
 */
export class IwikiMcpClient {
  private readonly config: Required<Pick<IwikiMcpConfig, "endpoint" | "requestTimeoutMs">> &
    IwikiMcpConfig;
  private nextId = 1;
  private sessionId: string | null = null;
  private initialized = false;
  private tools: ToolInfo[] | null = null;

  constructor(config: IwikiMcpConfig) {
    if (!config.endpoint) {
      throw new UnavailableError("iWiki MCP endpoint is not configured");
    }
    this.config = { requestTimeoutMs: 15000, ...config };
  }

  get configured(): boolean {
    return Boolean(this.config.token);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (this.config.token) {
      headers.authorization = `Bearer ${this.config.token}`;
    }
    if (this.sessionId) {
      headers["mcp-session-id"] = this.sessionId;
    }
    return headers;
  }

  private async post(payload: unknown, expectResponse: boolean): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const session = response.headers.get("mcp-session-id");
      if (session) this.sessionId = session;

      const text = await response.text();
      if (!response.ok) {
        throw new MusseError(
          "IWIKI_HTTP_ERROR",
          `iWiki MCP HTTP ${response.status}: ${text.slice(0, 300)}`,
        );
      }
      if (!expectResponse) return undefined;

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        const events = text
          .split(/\r?\n\r?\n/)
          .map((block) => block.split(/\r?\n/).filter((l) => l.startsWith("data:")))
          .map((lines) => lines.map((l) => l.slice(5).trim()).join("\n"))
          .filter(Boolean);
        for (const event of events) {
          const parsed = JSON.parse(event) as JsonRpcResponse;
          if (parsed.id !== undefined) return parsed;
        }
        throw new MusseError("IWIKI_PROTOCOL_ERROR", "no JSON-RPC response in SSE stream");
      }
      return JSON.parse(text) as JsonRpcResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  private async request(method: string, params?: unknown): Promise<unknown> {
    const response = (await this.post(
      { jsonrpc: "2.0", id: this.nextId++, method, params },
      true,
    )) as JsonRpcResponse;
    if (response.error) {
      throw new MusseError(
        "IWIKI_RPC_ERROR",
        `${method}: ${response.error.message} (${response.error.code})`,
      );
    }
    return response.result;
  }

  async initialize(): Promise<unknown> {
    if (this.initialized) return undefined;
    const result = await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "musse-iwiki", version: "0.1.0" },
    });
    await this.post(
      { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
      false,
    );
    this.initialized = true;
    return result;
  }

  async listTools(force = false): Promise<ToolInfo[]> {
    if (this.tools && !force) return this.tools;
    await this.initialize();
    const result = (await this.request("tools/list", {})) as { tools?: ToolInfo[] };
    this.tools = result.tools ?? [];
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!name) throw new UnavailableError("iWiki tool name is not resolved");
    await this.initialize();
    return this.request("tools/call", { name, arguments: args });
  }
}
