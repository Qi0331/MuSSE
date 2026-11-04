import { OfficialIwikiReadStore } from "../store/official-iwiki-read.ts";
import { DOC_PATHS } from "../store/wiki-store.ts";
import { S6Error, validateScope } from "./s6-goal-discovery.ts";
import type { GoalPort, GoalScope, GoalEntry } from "./s6-goal-discovery.ts";
import type { IwikiMcpClient } from "../store/iwiki-mcp-client.ts";

const PAGE = /^page-[A-Za-z0-9_-]{1,100}$/;
type Client = Pick<IwikiMcpClient, "callTool" | "listTools">;
const object = (o: unknown): o is Record<string, unknown> =>
  Boolean(o) && typeof o === "object" && !Array.isArray(o);

/** Accept only mutually consistent explicit business-success envelopes. */
function success(response: unknown): Record<string, unknown> {
  if (!object(response) || response.isError === true) throw new S6Error("S6_REMOTE_UNCONFIRMED");
  const candidates: unknown[] = [];
  if (response.structuredContent !== undefined) candidates.push(response.structuredContent);
  if (Array.isArray(response.content)) for (const block of response.content) {
    if (object(block) && typeof block.text === "string") {
      try { candidates.push(JSON.parse(block.text)); }
      catch { /* untrusted human-readable text is not a success */ }
    }
  }
  if (!candidates.length) throw new S6Error("S6_REMOTE_UNCONFIRMED");
  const valid: Record<string, unknown>[] = [];
  for (const candidate of candidates) {
    if (!object(candidate) || candidate.ok !== true || !object(candidate.data))
      throw new S6Error("S6_REMOTE_UNCONFIRMED");
    valid.push(candidate.data);
  }
  if (!valid.every((v) => JSON.stringify(v) === JSON.stringify(valid[0])))
    throw new S6Error("S6_REMOTE_UNCONFIRMED");
  return valid[0];
}

/**
 * This adapter deliberately requires independently verifiable list completeness
 * and parent+space fields. If the live list_docs response omits these, S6 fails
 * closed until its REAL response shape is inspected and the parser is reviewed.
 */
function directChildren(payload: Record<string, unknown>, scope: GoalScope) {
  if (!Array.isArray(payload.docs) || !Number.isSafeInteger(payload.total) ||
      payload.total !== payload.docs.length || payload.total > 1000 ||
      payload.has_more !== false || payload.next_cursor) {
    throw new S6Error("S6_LIST_INCOMPLETE");
  }
  const entries: GoalEntry[] = [];
  for (const value of payload.docs) {
    if (!object(value)) throw new S6Error("S6_SCOPE_OR_METADATA_MISMATCH");
    const parent = value.parent_id;
    const space = value.space_id;
    if (typeof parent !== "string" || typeof space !== "string") {
      throw new S6Error("S6_SCOPE_OR_METADATA_MISMATCH");
    }
    if (space !== scope.spaceId) throw new S6Error("S6_SCOPE_OR_METADATA_MISMATCH");
    if (parent !== scope.folderId) continue; // other documents in this verified space
    const id = value.doc_id;
    const title = value.title;
    const kind = value.page_type ?? value.kind;
    if (typeof id !== "string" || !PAGE.test(id) ||
        typeof title !== "string" || kind !== "markdown") {
      throw new S6Error("S6_SCOPE_OR_METADATA_MISMATCH");
    }
    entries.push({ docId: id, title, parentId: parent, spaceId: space, kind: "markdown" });
  }
  return { complete: true as const, entries };
}

export function createOfficialS6GoalPort(
  client: Client, taskDocId: string,
): GoalPort {
  if (!PAGE.test(taskDocId)) throw new S6Error("S6_TASK_MAPPING_INVALID");
  const tasks = new OfficialIwikiReadStore(client, { [DOC_PATHS.tasks]: taskDocId });
  const read = async (id: string) => {
    if (!PAGE.test(id)) throw new S6Error("S6_INVALID_DOCUMENT_ID");
    const document = new OfficialIwikiReadStore(client, { s6_current: id });
    return (await document.read("s6_current")).content;
  };
  const call = async (tool: string, args: Record<string, unknown>) => {
    try { return await client.callTool(tool, args); }
    catch { throw new S6Error("S6_REMOTE_UNAVAILABLE"); }
  };
  const requireTool = async (name: string, allowedRequired: string[]) => {
    let tools;
    try { tools = await client.listTools(); }
    catch { throw new S6Error("S6_TOOLS_UNAVAILABLE"); }
    const tool = tools.find((t) => t.name === name);
    if (!tool || !object(tool.inputSchema) || !Array.isArray(tool.inputSchema.required) ||
        tool.inputSchema.required.some((key) => !allowedRequired.includes(key))) {
      throw new S6Error("S6_TOOL_CONTRACT_UNVERIFIED");
    }
  };
  return {
    async listDirectChildren(scope) {
      validateScope(scope);
      await requireTool("list_docs", ["space_id"]);
      const data = success(await call("list_docs", { space_id: scope.spaceId }));
      return directChildren(data, scope);
    },
    readDoc: read,
    async readTaskTable() { return (await tasks.read(DOC_PATHS.tasks)).content; },
    async createDoc(scope, title, content) {
      validateScope(scope);
      if (!/^G-[0-9]{3,6}$/.test(title)) throw new S6Error("S6_INVALID_GOAL_ID");
      await requireTool("create_markdown_doc", ["title", "content", "space_id", "parent_id"]);
      const data = success(await call("create_markdown_doc", {
        title, content, space_id: scope.spaceId, parent_id: scope.folderId,
      }));
      if (typeof data.doc_id !== "string" || !PAGE.test(data.doc_id) ||
          (data.title !== undefined && data.title !== title) ||
          (data.space_id !== undefined && data.space_id !== scope.spaceId) ||
          (data.parent_id !== undefined && data.parent_id !== scope.folderId))
        throw new S6Error("S6_CREATE_UNCONFIRMED");
      return data.doc_id;
    },
    async editDoc(docId, content) {
      if (!PAGE.test(docId)) throw new S6Error("S6_INVALID_DOCUMENT_ID");
      await requireTool("edit_doc", ["content", "doc_id"]);
      const data = success(await call("edit_doc", { doc_id: docId, content }));
      if (data.doc_id !== docId) throw new S6Error("S6_EDIT_UNCONFIRMED");
    },
  };
}
