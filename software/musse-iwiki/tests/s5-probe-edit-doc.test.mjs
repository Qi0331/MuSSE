import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  TEST_ORIGINAL, TEST_UPDATED, probeS5EditDoc, summarizeEditResponse,
} from "../tools/s5-probe-edit-doc.mjs";

const id = "page-ISOLATED_TEST_ONLY";
function fixture(options = {}) {
  let body = options.initial ?? TEST_ORIGINAL;
  const calls = [];
  const client = {
    async callTool(name, args) {
      calls.push(name);
      assert.equal(args.doc_id, id);
      if (name === "read_doc") return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, data: { doc_id: id, content: body } }) }],
      };
      assert.equal(name, "edit_doc");
      assert.deepEqual(args, { doc_id: id, content: TEST_UPDATED });
      if (options.change !== false) body = TEST_UPDATED;
      if (options.throwAfterWrite) throw new Error("private upstream detail");
      return options.reply ?? { content: [{ type: "text", text: JSON.stringify({ ok: true, data: { doc_id: id } }) }] };
    },
  };
  return { client, calls, get body() { return body; } };
}

test("S5-F preflight marker and one edit_doc, two reads, safe result shape", async () => {
  const f = fixture();
  const result = await probeS5EditDoc(f.client, id);
  assert.deepEqual(f.calls, ["read_doc", "edit_doc", "read_doc"]);
  assert.equal(result.readback, "UPDATED");
  assert.equal(result.responseShape.envelopes[0].ok, true);
  assert.deepEqual(result.responseShape.envelopes[0].dataFields, ["doc_id"]);
  assert.equal(JSON.stringify(result).includes(id), false);
  assert.equal(f.body, TEST_UPDATED);
  await assert.rejects(probeS5EditDoc(f.client, id), /S5F_TEST_PAGE_NOT_INITIAL/);
  assert.equal(f.calls.filter((name) => name === "edit_doc").length, 1);
});

test("S5-F fails before any edit when document has unexpected content", async () => {
  const f = fixture({ initial: "PRIVATE DOCUMENT" });
  await assert.rejects(probeS5EditDoc(f.client, id), /S5F_TEST_PAGE_NOT_INITIAL/);
  assert.deepEqual(f.calls, ["read_doc"]);
});

test("S5-F ambiguous reply still reads back and never retries", async () => {
  const f = fixture({ reply: { content: [{ type: "text", text: "unknown response" }] } });
  const result = await probeS5EditDoc(f.client, id);
  assert.equal(result.readback, "UPDATED");
  assert.deepEqual(result.responseShape.envelopes, []);
  assert.equal(f.calls.filter((name) => name === "edit_doc").length, 1);
});

test("S5-F even an exception after a remote edit results in no retry", async () => {
  const f = fixture({ throwAfterWrite: true });
  const result = await probeS5EditDoc(f.client, id);
  assert.equal(result.editCallFailed, true);
  assert.equal(result.readback, "UPDATED");
  assert.equal(f.calls.filter((name) => name === "edit_doc").length, 1);
});

test("S5-F output strips private values from response", () => {
  const summary = summarizeEditResponse({
    content: [{ type: "text", text: JSON.stringify({
      ok: true, data: { doc_id: "page-SECRET", content: "PRIVATE-BODY", title: "PRIVATE-TITLE" },
    }) }],
  });
  assert.deepEqual(summary.envelopes[0].dataFields, ["doc_id", "content", "title"]);
  assert.equal(JSON.stringify(summary).includes("PRIVATE-"), false);
  assert.equal(JSON.stringify(summary).includes("page-SECRET"), false);
});

test("S5-F default CLI is inert and explains --write-test", () => {
  const path = fileURLToPath(new URL("../tools/s5-probe-edit-doc.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [path], { encoding: "utf8" });
  assert.match(output, /--write-test/);
});
