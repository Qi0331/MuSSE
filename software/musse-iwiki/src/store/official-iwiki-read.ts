import type { IwikiMcpClient } from "./iwiki-mcp-client.ts";
import type { DocMeta, DocSnapshot, WikiStore } from "./wiki-store.ts";
import { MusseError, UnavailableError } from "../types.ts";

/**
 * S2-A official iWiki read_doc adapter, isolated from the earlier unverified
 * read/write tool mapping. The user verified the following response SHAPE:
 * MCP content[0].text contains JSON {ok:boolean,data:{doc_id,title,content,...}}.
 *
 * No real task table or goal document has been accepted yet.
 * This adapter is read-only EVEN if a caller attempts WikiStore.write().
 * All logical paths must be explicitly mapped to actual document IDs supplied
 * by the caller; do not guess iWiki IDs, spaces or paths.
 */
export class OfficialIwikiReadStore implements WikiStore {
  private readonly client: Pick<IwikiMcpClient, "callTool">;
  private readonly ids: Readonly<Record<string, string>>;

  constructor(client: Pick<IwikiMcpClient, "callTool">, documentIds: Record<string, string>) {
    this.client = client;
    this.ids = { ...documentIds };
  }

  async read(path: string): Promise<DocSnapshot> {
    if (!Object.hasOwn(this.ids, path)) {
      throw new UnavailableError("iWiki document mapping missing for requested logical path");
    }
    const id = this.ids[path];
    if (typeof id !== "string" || !/^page-[A-Za-z0-9_-]{1,100}$/.test(id)) {
      throw new UnavailableError("iWiki document ID mapping is invalid");
    }

    let result: unknown;
    try {
      result = await this.client.callTool("read_doc", { doc_id: id });
    } catch {
      // The generic MCP client can include raw server response text in errors.
      // Do not let it propagate to the stdio business server or public logs.
      throw new MusseError("IWIKI_READ_FAILED", "iWiki read_doc request failed");
    }
    if (!result || typeof result !== "object" ||
        (result as Record<string, unknown>).isError === true) {
      throw new MusseError("IWIKI_TOOL_ERROR", "iWiki read_doc returned an error");
    }
    const value = result as Record<string, unknown>;
    const candidates: unknown[] = [];
    if (value.structuredContent !== undefined) candidates.push(value.structuredContent);
    if (Array.isArray(value.content)) {
      for (const block of value.content) {
        if (block && typeof block === "object" && typeof block.text === "string") {
          try { candidates.push(JSON.parse(block.text) as unknown); }
          catch { /* No raw data emitted; a later candidate may be well-formed. */ }
        }
      }
    }

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
      const envelope = candidate as Record<string, unknown>;
      // Never mistake an HTTP/MCP success for a successful business-level read.
      if (envelope.ok !== true) continue;
      const data = envelope.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      const doc = data as Record<string, unknown>;
      if (doc.doc_id !== id) {
        throw new MusseError("IWIKI_RESPONSE_UNVERIFIED", "iWiki returned a different document ID");
      }
      if (typeof doc.content !== "string") break;
      return {
        path,
        content: doc.content,
        // No remotely confirmed stable version/conditional-write contract.
        version: "",
      };
    }
    throw new MusseError(
      "IWIKI_RESPONSE_UNVERIFIED",
      "iWiki read_doc did not return a confirmed {ok:true,data:{doc_id,content}} envelope",
    );
  }

  async write(_path: string, _content: string, _expectedVersion?: string): Promise<DocSnapshot> {
    throw new UnavailableError("official iWiki read-only adapter never writes");
  }

  async list(_prefix?: string): Promise<DocMeta[]> {
    throw new UnavailableError("official iWiki list_docs result mapping is not verified");
  }
}
