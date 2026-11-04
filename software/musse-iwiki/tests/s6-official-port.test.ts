import assert from "node:assert/strict";
import test from "node:test";
import { createOfficialS6GoalPort } from "../src/goals/s6-official-port.ts";
import { S6Error } from "../src/goals/s6-goal-discovery.ts";
import { summarizeS6ListShape } from "../tools/s6-inspect-directory.mjs";

const scope = { spaceId: "space-PRIVATE", folderId: "page-FOLDER" };
const ack = (data: Record<string, unknown>, ok = true) => ({
  content: [{ type: "text", text: JSON.stringify({ ok, data }) }],
});
function harness() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let docs: unknown[] = [
    { doc_id: "page-GOAL", title: "G-001", parent_id: scope.folderId, space_id: scope.spaceId, page_type: "markdown" },
    { doc_id: "page-OTHER", title: "G-999", parent_id: "page-OTHER_FOLDER", space_id: scope.spaceId, page_type: "markdown" },
  ];
  let total: number | undefined = docs.length;
  let hasMore: boolean | undefined = false;
  let editAck = true;
  const client = {
    async listTools() {
      return ["list_docs", "create_markdown_doc", "edit_doc"].map((name) =>
        ({ name, inputSchema: { required: name === "list_docs" ? ["space_id"] : name === "edit_doc"
          ? ["content"] : ["title", "content"] } }));
    },
    async callTool(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === "list_docs") return ack({ docs, total, has_more: hasMore, next_cursor: null });
      if (name === "read_doc") return ack({ doc_id: args.doc_id, content: "# 目标：示例\n- 目标ID: G-001\n" });
      if (name === "create_markdown_doc") return ack({
        doc_id: "page-CREATED", title: args.title, space_id: args.space_id, parent_id: args.parent_id,
      });
      if (name === "edit_doc") return ack({ doc_id: args.doc_id }, editAck);
      throw Error("Unexpected tool");
    },
  };
  return { port: createOfficialS6GoalPort(client, "page-TASKS"), calls,
    setIncomplete() { total = undefined; }, setUnknownPagination() { hasMore = undefined; },
    setWrongSpace() { docs = [{ doc_id: "page-GOAL", title: "G-001",
      parent_id: scope.folderId, space_id: "space-OTHER", page_type: "markdown" }]; total = 1; },
    failEditAck() { editAck = false; },
  };
}
const reject = async (fn: () => Promise<unknown>, expected: string) =>
  assert.rejects(fn, (e: unknown) => e instanceof S6Error && e.code === expected);

test("S6 official list_docs filters ONLY exact direct children of private folder", async () => {
  const f = harness();
  const list = await f.port.listDirectChildren(scope);
  assert.equal(list.complete, true);
  assert.equal(list.entries.length, 1);
  assert.equal(list.entries[0].title, "G-001");
  assert.deepEqual(f.calls[0], { name: "list_docs", args: { space_id: scope.spaceId } });
});

test("S6 official list refuses unknown completeness and cross-space metadata", async () => {
  const f = harness(); f.setIncomplete();
  await reject(() => f.port.listDirectChildren(scope), "S6_LIST_INCOMPLETE");
  const g = harness(); g.setUnknownPagination();
  await reject(() => g.port.listDirectChildren(scope), "S6_LIST_INCOMPLETE");
  const h = harness(); h.setWrongSpace();
  await reject(() => h.port.listDirectChildren(scope), "S6_SCOPE_OR_METADATA_MISMATCH");
});

test("S6 official create and edit use explicit parent ID and confirmed page ID only", async () => {
  const f = harness();
  assert.equal(await f.port.createDoc(scope, "G-002", "# 目标：新目标\n- 目标ID: G-002\n"),
    "page-CREATED");
  const create = f.calls.find((v) => v.name === "create_markdown_doc")!;
  assert.deepEqual(Object.keys(create.args).sort(), ["content", "parent_id", "space_id", "title"]);
  assert.equal(create.args.parent_id, scope.folderId);
  await f.port.editDoc("page-GOAL", "# 目标：修改");
  const edit = f.calls.find((v) => v.name === "edit_doc")!;
  assert.deepEqual(Object.keys(edit.args).sort(), ["content", "doc_id"]);
  assert.equal(edit.args.doc_id, "page-GOAL");
  const g = harness(); g.failEditAck();
  await reject(() => g.port.editDoc("page-GOAL", "new"), "S6_REMOTE_UNCONFIRMED");
});

test("S6 read_doc requires same document ID and does not open a general wiki path", async () => {
  const f = harness();
  assert.match(await f.port.readDoc("page-GOAL"), /目标ID: G-001/);
  await reject(() => f.port.readDoc("other-document"), "S6_INVALID_DOCUMENT_ID");
});

test("S6 diagnostic reports only structural booleans, no user document metadata", () => {
  const secret = "PRIVATE_STUFF_SHOULD_NOT_LEAK";
  const report = summarizeS6ListShape(ack({ docs: [
    { doc_id: "page-SECRET", title: secret, parent_id: "page-SECRET",
      space_id: "space-SECRET", page_type: "markdown" },
  ], total: 1, has_more: false, next_cursor: null }));
  assert.deepEqual(report.sampleFields, { docId: true, title: true,
    parentId: true, spaceId: true, kind: true });
  assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal(JSON.stringify(report).includes("page-SECRET"), false);
});
