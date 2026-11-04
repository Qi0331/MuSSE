import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { TEST_ORIGINAL, TEST_UPDATED } from "../tools/s5-probe-edit-doc.mjs";
import { extractConfirmedCreatedPageId, probeS5CreateAndEdit } from "../tools/s5-probe-auto-create.mjs";

const id = "page-S5F_NEW_ONLY";
const label = "MuSSE S5-F 自动隔离测试 deadbeef";
const spaceName = "MuSSE 测试空间";
function fixture(options = {}) {
  let body = TEST_ORIGINAL;
  const calls = [];
  const client = {
    async callTool(name, args) {
      calls.push(name);
      if (name === "create_markdown_doc") {
        assert.deepEqual(args, { title: label, content: TEST_ORIGINAL, space_name: spaceName });
        if (options.createThrows) throw new Error("upstream-private");
        return options.createResult ?? { content: [{ type: "text", text: JSON.stringify({
          ok: true, data: { doc_id: id, title: "private-title" },
        }) }] };
      }
      assert.equal(args.doc_id, id);
      if (name === "read_doc") {
        return { content: [{ type: "text", text: JSON.stringify({
          ok: true, data: { doc_id: id, content: options.badInitial ? "private text" : body },
        }) }] };
      }
      assert.equal(name, "edit_doc");
      assert.deepEqual(args, { doc_id: id, content: TEST_UPDATED });
      if (!options.noPersist) body = TEST_UPDATED;
      if (options.editThrows) throw new Error("upstream-private");
      return options.editResult ?? { structuredContent: { ok: true, data: { doc_id: id } } };
    },
  };
  return { client, calls, get body() { return body; } };
}

test("auto-create: one new document, original read, edit once, verified readback", async () => {
  const f = fixture();
  const r = await probeS5CreateAndEdit(f.client, spaceName, label);
  assert.equal(r.outcome, "CREATE_AND_EDIT_VERIFIED");
  assert.equal(r.readback, "UPDATED");
  assert.deepEqual(f.calls, ["create_markdown_doc", "read_doc", "edit_doc", "read_doc"]);
  assert.equal(f.body, TEST_UPDATED);
  assert.equal(JSON.stringify(r).includes(id), false);
  assert.equal(JSON.stringify(r).includes("private-title"), false);
});

test("auto-create: no confirmed ID means no edit and never a second create", async () => {
  const f = fixture({ createResult: { structuredContent: { ok: true, data: { title: "unknown" } } } });
  const r = await probeS5CreateAndEdit(f.client, spaceName, label);
  assert.equal(r.outcome, "CREATE_UNCONFIRMED");
  assert.equal(r.editAttempted, false);
  assert.deepEqual(f.calls, ["create_markdown_doc"]);
});

test("auto-create: create exception is uncertain; no automatic retry or edit", async () => {
  const f = fixture({ createThrows: true });
  const r = await probeS5CreateAndEdit(f.client, spaceName, label);
  assert.equal(r.createCallFailed, true);
  assert.equal(r.outcome, "CREATE_UNCONFIRMED");
  assert.deepEqual(f.calls, ["create_markdown_doc"]);
});

test("auto-create: malformed readback after create blocks edit", async () => {
  const f = fixture({ badInitial: true });
  const r = await probeS5CreateAndEdit(f.client, spaceName, label);
  assert.equal(r.outcome, "CREATED_BUT_PRECHECK_FAILED");
  assert.deepEqual(f.calls, ["create_markdown_doc", "read_doc"]);
});

test("auto-create: uncertain edit still reads once but never retries", async () => {
  const f = fixture({ editThrows: true });
  const r = await probeS5CreateAndEdit(f.client, spaceName, label);
  assert.equal(r.outcome, "EDIT_UNCONFIRMED");
  assert.equal(r.readback, "UPDATED");
  assert.equal(r.editCallFailed, true);
  assert.deepEqual(f.calls, ["create_markdown_doc", "read_doc", "edit_doc", "read_doc"]);
});

test("auto-create: no persistence cannot report verified even with positive ack", async () => {
  const f = fixture({ noPersist: true });
  const r = await probeS5CreateAndEdit(f.client, spaceName, label);
  assert.equal(r.outcome, "EDIT_UNCONFIRMED");
  assert.equal(r.readback, "UNCHANGED");
});

test("auto-create: ignore ambiguous and conflicting IDs", () => {
  assert.equal(extractConfirmedCreatedPageId({ structuredContent: { ok: true, data: { id: "page-A", doc_id: "page-B" } } }), null);
  assert.equal(extractConfirmedCreatedPageId({ structuredContent: { ok: false, data: { doc_id: id } } }), null);
  assert.equal(extractConfirmedCreatedPageId({ isError: true, structuredContent: { ok: true, data: { doc_id: id } } }), null);
  assert.equal(extractConfirmedCreatedPageId({ structuredContent: { success: true, data: { page_id: id } } }), id);
});


test("auto-create: missing destination space fails before remote call", async () => {
  const f = fixture();
  await assert.rejects(probeS5CreateAndEdit(f.client, "", label), /S5F_SPACE_NAME_REQUIRED/);
  await assert.rejects(probeS5CreateAndEdit(f.client, "space\\ninvalid", label), /S5F_SPACE_NAME_REQUIRED/);
  assert.deepEqual(f.calls, []);
});

test("auto-create: default CLI is inert", () => {
  const path = fileURLToPath(new URL("../tools/s5-probe-auto-create.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [path], { encoding: "utf8" });
  assert.match(output, /--create-and-write-test/);
});
