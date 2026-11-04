import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  EXISTING_TITLE, exactSpaceFromList, exactTestDocFromList,
  findExistingTest, editExistingTestOnce, safeEditFailureKind,
} from "../tools/s5-probe-existing-edit.mjs";
import { TEST_ORIGINAL, TEST_UPDATED } from "../tools/s5-probe-edit-doc.mjs";

const spaceName = "ISOLATED_PERSONAL_SPACE";
const spaceId = "space-TEST123";
const docId = "page-TEST_EXISTING_001";

function reply(data) {
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, data }) }] };
}
function fixture(options = {}) {
  const calls = [];
  let body = options.initial ?? TEST_ORIGINAL;
  const client = {
    async listTools() {
      calls.push(["tools/list"]);
      return [
        { name: "list_spaces", inputSchema: { required: [] } },
        { name: "list_docs", inputSchema: { required: ["space_id"] } },
        { name: "edit_doc", inputSchema: { required: ["content"] } },
      ];
    },
    async callTool(name, args) {
      calls.push([name, args]);
      if (name === "list_spaces") {
        assert.deepEqual(args, {});
        return reply({ spaces: [{ name: spaceName, space_id: spaceId }] });
      }
      if (name === "list_docs") {
        assert.deepEqual(args, { space_id: spaceId });
        return reply({ docs: [{ title: EXISTING_TITLE, doc_id: docId }] });
      }
      if (name === "read_doc") {
        assert.deepEqual(args, { doc_id: docId });
        return reply({ doc_id: docId, content: body });
      }
      if (name === "edit_doc") {
        assert.deepEqual(args, { doc_id: docId, content: TEST_UPDATED });
        if (options.applyEdit !== false) body = TEST_UPDATED;
        if (options.throwAfterEdit) throw Error("private-error-data");
        return options.editReply ?? reply({ doc_id: docId });
      }
      throw Error("unsupported");
    },
  };
  return { client, calls, get body() { return body; } };
}

test("existing-page: uniquely locate exact synthetic page and verify marker without writing", async () => {
  const f = fixture();
  const found = await findExistingTest(f.client, spaceName);
  assert.equal(found.status, "READY");
  assert.deepEqual(f.calls.map(([name]) => name), ["tools/list", "list_spaces", "list_docs", "read_doc"]);
  assert.equal(f.calls.some(([name]) => name === "create_markdown_doc" || name === "edit_doc"), false);
  assert.equal(f.body, TEST_ORIGINAL);
});

test("existing-page: existing synthetic page alone gets exactly one edit and readback", async () => {
  const f = fixture();
  const found = await findExistingTest(f.client, spaceName);
  const result = await editExistingTestOnce(f.client, found);
  assert.deepEqual(f.calls.map(([name]) => name), [
    "tools/list", "list_spaces", "list_docs", "read_doc", "edit_doc", "read_doc",
  ]);
  assert.equal(result.outcome, "EXISTING_EDIT_VERIFIED");
  assert.equal(result.readback, "UPDATED");
  assert.equal(f.body, TEST_UPDATED);
  assert.equal(JSON.stringify(result).includes(docId), false);
  assert.equal(JSON.stringify(result).includes(spaceId), false);
});

test("existing-page: business rejected edit remains unconfirmed and classified", async () => {
  const f = fixture({
    applyEdit: false,
    editReply: { content: [{ type: "text", text: JSON.stringify({
      ok: false, data: { error: "permission denied for page-PRIVATE" },
    }) }] },
  });
  const found = await findExistingTest(f.client, spaceName);
  const result = await editExistingTestOnce(f.client, found);
  assert.equal(result.errorKind, "PERMISSION");
  assert.equal(result.outcome, "EXISTING_EDIT_UNCONFIRMED");
  assert.equal(result.readback, "UNCHANGED");
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
});

test("existing-page: post-write exception cannot be mistaken for confirmed edit", async () => {
  const f = fixture({ throwAfterEdit: true });
  const found = await findExistingTest(f.client, spaceName);
  const result = await editExistingTestOnce(f.client, found);
  assert.equal(result.editCallFailed, true);
  assert.equal(result.readback, "UPDATED");
  assert.equal(result.outcome, "EXISTING_EDIT_UNCONFIRMED");
  assert.equal(f.calls.filter(([name]) => name === "edit_doc").length, 1);
});

test("existing-page: wrong initial marker fails closed without edit", async () => {
  const f = fixture({ initial: "PRIVATE_OTHER_BODY" });
  const found = await findExistingTest(f.client, spaceName);
  assert.deepEqual(found, { status: "INITIAL_MARKER_MISMATCH" });
  await assert.rejects(editExistingTestOnce(f.client, found), /S5F_NOT_PREFLIGHTED/);
  assert.equal(f.calls.filter(([name]) => name === "edit_doc").length, 0);
});

test("existing-page: no confirmed matching page or ambiguous ids fail closed", () => {
  assert.equal(exactTestDocFromList(reply({ docs: [{ title: "UNRELATED", doc_id: docId }] })), null);
  assert.equal(exactTestDocFromList(reply({ docs: [
    { title: EXISTING_TITLE, doc_id: docId },
    { title: EXISTING_TITLE, doc_id: "page-DUPLICATE" },
  ] })), null);
  assert.equal(exactSpaceFromList(reply({ spaces: [
    { name: spaceName, space_id: spaceId },
    { name: spaceName, space_id: "space-DUPLICATE" },
  ] }), spaceName), null);
  assert.equal(exactSpaceFromList({ isError: true, ...reply({ spaces: [{ name: spaceName, id: spaceId }] }) }, spaceName), null);
});

test("existing-page: classify only known error categories and never emit raw strings", () => {
  const output = (error) => safeEditFailureKind({ content: [
    { type: "text", text: JSON.stringify({ ok: false, data: { error } }) },
  ] });
  assert.equal(output("merge conflict"), "CONFLICT");
  assert.equal(output("document not found"), "NOT_FOUND");
  assert.equal(output("unsupported editor mode"), "DOCUMENT_TYPE");
  assert.equal(output("invalid argument"), "ARGUMENT");
  assert.equal(output("some totally novel failure"), "OTHER_BUSINESS_ERROR");
});

test("existing-page: CLI with no args is completely inert", () => {
  const path = fileURLToPath(new URL("../tools/s5-probe-existing-edit.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [path], { encoding: "utf8" });
  assert.match(output, /--edit-once/);
});
