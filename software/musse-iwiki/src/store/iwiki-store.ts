import type { DocMeta, DocSnapshot, WikiStore } from "./wiki-store.ts";
import { IwikiMcpClient } from "./iwiki-mcp-client.ts";
import { ConflictError, MusseError, NotFoundError, UnavailableError } from "../types.ts";

export interface IwikiToolMapping {
  readDocument: string;
  writeDocument: string;
  listDocuments?: string;
  args?: {
    path?: string;
    content?: string;
    version?: string;
  };
  /** Remote writes stay disabled until an authorized live verification. */
  writeEnabled?: boolean;
}

/**
 * Adapter from the business WikiStore to iWiki MCP tools.
 *
 * Status: the Streamable-HTTP transport is implemented from the public MCP
 * specification, but the concrete iWiki tool names/arguments are NOT publicly
 * confirmed. This adapter therefore requires explicit tool names and is
 * marked "unverified" until an authorized live test is performed.
 *
 * Remote writes are disabled by default, independently of the unverified
 * acknowledgement flag.
 */
export class IwikiMcpStore implements WikiStore {
  private readonly client: IwikiMcpClient;
  private readonly mapping: Required<Pick<IwikiToolMapping, "readDocument" | "writeDocument">> & {
    listDocuments?: string;
    writeEnabled: boolean;
    args: { path: string; content: string; version: string };
  };

  constructor(client: IwikiMcpClient, mapping: IwikiToolMapping) {
    this.client = client;
    this.mapping = {
      ...mapping,
      writeEnabled: mapping.writeEnabled === true,
      args: { path: "path", content: "content", version: "version", ...mapping.args },
    };
  }

  private assertToolSuccess(result: unknown, action: string): void {
    if (result && typeof result === "object" && (result as { isError?: unknown }).isError === true) {
      let detail = "";
      const content = (result as { content?: Array<{ text?: string }> }).content;
      if (Array.isArray(content) && typeof content[0]?.text === "string") {
        detail = content[0].text.slice(0, 300);
      }
      throw new MusseError(
        "IWIKI_TOOL_ERROR",
        `${action} failed: MCP tools/call returned isError=true${detail ? `: ${detail}` : ""}`,
      );
    }
  }

  private extract(result: unknown): { content: string; version: string } {
    const candidates: unknown[] = [];
    if (result && typeof result === "object") {
      const obj = result as Record<string, unknown>;
      if (obj.structuredContent) candidates.push(obj.structuredContent);
      if (Array.isArray(obj.content)) {
        for (const item of obj.content as Array<Record<string, unknown>>) {
          if (typeof item.text === "string") candidates.push(item.text);
        }
      }
      candidates.push(obj);
    }
    for (const candidate of candidates) {
      try {
        const parsed =
          typeof candidate === "string"
            ? (JSON.parse(candidate) as Record<string, unknown>)
            : (candidate as Record<string, unknown>);
        if (parsed && typeof parsed.content === "string") {
          return {
            content: parsed.content,
            version:
              typeof parsed.version === "string"
                ? parsed.version
                : typeof parsed.updatedAt === "string"
                  ? parsed.updatedAt
                  : "",
          };
        }
      } catch {
        // try next candidate
      }
    }
    throw new MusseError(
      "IWIKI_RESPONSE_UNVERIFIED",
      "iWiki tool response does not match the expected {content, version} shape",
    );
  }

  private requiresWriteConfirmation(result: unknown): void {
    const candidates: unknown[] = [];
    if (result && typeof result === "object") {
      const obj = result as Record<string, unknown>;
      if (obj.structuredContent) candidates.push(obj.structuredContent);
      if (Array.isArray(obj.content)) {
        for (const item of obj.content as Array<Record<string, unknown>>) {
          if (typeof item.text === "string") candidates.push(item.text);
        }
      }
      candidates.push(obj);
    }
    for (const candidate of candidates) {
      let parsed: unknown = candidate;
      if (typeof candidate === "string") {
        try {
          parsed = JSON.parse(candidate);
        } catch {
          continue;
        }
      }
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (obj.confirmed === true || obj.ok === true || obj.success === true) {
          return;
        }
      }
    }
    throw new MusseError(
      "IWIKI_WRITE_UNCONFIRMED",
      "write tool did not return an explicit success confirmation; refusing to report success",
    );
  }

  async read(path: string): Promise<DocSnapshot> {
    const result = await this.client.callTool(this.mapping.readDocument, {
      [this.mapping.args.path]: path,
    });
    this.assertToolSuccess(result, "read document");
    const parsed = this.extract(result);
    if (parsed.content === "") {
      throw new NotFoundError(`document not found or empty: ${path}`);
    }
    return { path, content: parsed.content, version: parsed.version };
  }

  async write(
    path: string,
    content: string,
    expectedVersion?: string,
  ): Promise<DocSnapshot> {
    if (!this.mapping.writeEnabled) {
      throw new UnavailableError(
        "remote iWiki writes are disabled until an authorized live verification",
      );
    }
    let result: unknown;
    if (expectedVersion !== undefined && expectedVersion !== "") {
      result = await this.client.callTool(this.mapping.writeDocument, {
        [this.mapping.args.path]: path,
        [this.mapping.args.content]: content,
        [this.mapping.args.version]: expectedVersion,
      });
    } else {
      result = await this.client.callTool(this.mapping.writeDocument, {
        [this.mapping.args.path]: path,
        [this.mapping.args.content]: content,
      });
    }

    this.assertToolSuccess(result, "write document");
    this.requiresWriteConfirmation(result);

    // Mandatory read-back verification (content must equal the new content).
    const after = await this.read(path);
    if (after.content !== content) {
      throw new ConflictError(
        `write verification failed for ${path}: remote content differs after write`,
      );
    }
    return after;
  }

  async list(prefix = ""): Promise<DocMeta[]> {
    if (!this.mapping.listDocuments) {
      throw new UnavailableError(
        "iWiki list tool is not configured; cannot enumerate documents",
      );
    }
    const result = await this.client.callTool(this.mapping.listDocuments, { prefix });
    const obj = result as { structuredContent?: { documents?: DocMeta[] } };
    return obj.structuredContent?.documents ?? [];
  }
}

/**
 * Builds an adapter ONLY when the user explicitly acknowledges that the tool
 * bindings are unverified and supplies them. Never auto-connects.
 *
 * Remote writes require a SEPARATE explicit flag and remain disabled by
 * default; the unverified acknowledgement alone does not enable writes.
 */
export function createIwikiStoreFromEnv(
  env: NodeJS.ProcessEnv,
): WikiStore {
  if (env.MUSSE_ALLOW_UNVERIFIED_IWIKI !== "1") {
    throw new UnavailableError(
      "iWiki MCP binding is unverified. Set MUSSE_ALLOW_UNVERIFIED_IWIKI=1 only after authorization.",
    );
  }
  const endpoint = env.IWIKI_MCP_URL;
  const token = env.IWIKI_MCP_TOKEN;
  const readTool = env.IWIKI_TOOL_READ;
  const writeTool = env.IWIKI_TOOL_WRITE;
  if (!endpoint || !token || !readTool || !writeTool) {
    throw new UnavailableError(
      "iWiki MCP requires IWIKI_MCP_URL, IWIKI_MCP_TOKEN, IWIKI_TOOL_READ, IWIKI_TOOL_WRITE",
    );
  }
  const client = new IwikiMcpClient({ endpoint, token });
  return new IwikiMcpStore(client, {
    readDocument: readTool,
    writeDocument: writeTool,
    listDocuments: env.IWIKI_TOOL_LIST,
    writeEnabled: env.MUSSE_ENABLE_REMOTE_IWIKI_WRITE === "1",
    args: {
      path: env.IWIKI_ARG_PATH ?? "path",
      content: env.IWIKI_ARG_CONTENT ?? "content",
      version: env.IWIKI_ARG_VERSION ?? "version",
    },
  });
}
