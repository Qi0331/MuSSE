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
 * and explicit space membership for non-empty rows. If live list_docs omits these, S6 fails
 * closed until its REAL response shape is inspected and the parser is reviewed.
 */
function directChildren(payload: Record<string, unknown>, scope: GoalScope) {
  // Live iWiki returns {docs:[...],total:N} with no has_more, including N=1.
  // Accept an omitted flag ONLY in a dedicated knowledge base with a small,
  // count-consistent result and no continuation markers. This relies on
  // total being the server's full count, not a page-local count. Fail closed
  // at 100 rows (a likely page-size boundary) or any ambiguous marker.
  const docs = payload.docs;
  const countConsistent = Array.isArray(docs) &&
    Number.isSafeInteger(payload.total) && payload.total === docs.length &&
    payload.total >= 0 && payload.total <= 100;
  const noCursor = payload.next_cursor == null || payload.next_cursor === "";
  const noOtherContinuation = !payload.next_page && !payload.nextCursor &&
    !payload.hasMore && !payload.cursor;
  const hasKnownEnd = payload.has_more === false;
  const observedUnpaginated = scope.mode === "space" && countConsistent &&
    docs.length < 100 && payload.has_more === undefined && noCursor && noOtherContinuation;
  const provenEmpty = countConsistent && docs.length === 0 &&
    payload.has_more === undefined && noCursor && noOtherContinuation;
  if (!countConsistent || !noCursor || !noOtherContinuation ||
      (!hasKnownEnd && !observedUnpaginated && !provenEmpty)) {
    throw new S6Error("S6_LIST_INCOMPLETE");
  }
  const entries: GoalEntry[] = [];
  for (const value of payload.docs) {
    if (!object(value)) throw new S6Error("S6_SCOPE_OR_METADATA_MISMATCH");
    const parent = value.parent_id;
    const space = value.space_id;
    if (typeof space !== "string" || space !== scope.spaceId ||
        (parent != null && typeof parent !== "string")) {
      throw new S6Error("S6_SCOPE_OR_METADATA_MISMATCH");
    }
    if (scope.mode !== "space") {
      if (typeof parent !== "string") throw new S6Error("S6_SCOPE_OR_METADATA_MISMATCH");
      if (parent !== scope.folderId) continue; // unrelated folders in the same space
    }
    // Dedicated knowledge base mode intentionally includes every page in that
    // space. Its scope is the space, not an invented folder ID.
    const id = value.doc_id;
    const title = value.title;
    const kind = value.page_type ?? value.kind;
    // Dedicated knowledge bases omit type and parent fields in actual
    // list_docs rows. Never invent a confirmed markdown kind; scanGoals
    // validates each page through read_doc + parseGoal before it is trusted.
    const kindVerified = kind === "markdown";
    if (typeof id !== "string" || !PAGE.test(id) ||
        typeof title !== "string" ||
        (!kindVerified && !(scope.mode === "space" && kind == null))) {
      throw new S6Error("S6_SCOPE_OR_METADATA_MISMATCH");
    }
    entries.push({ docId: id, title, parentId: typeof parent === "string" ? parent : null,
      spaceId: space, kind: kindVerified ? "markdown" : "unverified" });
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
      if (!/^G[0-9]{3,6}$/.test(title)) throw new S6Error("S6_INVALID_GOAL_ID");
      await requireTool("create_markdown_doc", ["title", "content", "space_id", "parent_id"]);
      const args: Record<string, unknown> = {
        title, content, space_id: scope.spaceId,
      };
      if (scope.mode !== "space") args.parent_id = scope.folderId;
      const data = success(await call("create_markdown_doc", args));
      if (typeof data.doc_id !== "string" || !PAGE.test(data.doc_id) ||
          (data.title !== undefined && data.title !== title) ||
          (data.space_id !== undefined && data.space_id !== scope.spaceId) ||
          (scope.mode !== "space" && data.parent_id !== undefined && data.parent_id !== scope.folderId))
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
