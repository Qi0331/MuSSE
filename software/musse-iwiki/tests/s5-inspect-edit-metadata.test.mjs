import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { summarizeS5EditMetadata } from "../tools/s5-inspect-edit-metadata.mjs";

test("S5-F edit metadata includes only known tool descriptions and selected field schema", () => {
  const tools = [{
    name: "edit_doc",
    description: "Edit Markdown documents; https://example.test/private/path Bearer SECRET_NO_PRINT",
    inputSchema: { required: ["content"], properties: {
      doc_id: { type: "string", description: "page-SECRET_DOC_ID" },
      content: { type: "string", description: "Full Markdown body" },
      hidden_bad_key: { default: "PRIVATE_DEFAULT", type: "object" },
    } },
  }, { name: "other_tool", description: "PRIVATE_DESCRIPTION" }];
  const report = summarizeS5EditMetadata(tools);
  assert.deepEqual(report.tools.map((t) => t.name), [
    "edit_doc", "append_to_doc", "list_docs", "search_kb", "list_doc_tree",
  ]);
  assert.equal(report.tools[0].fields[1].required, true);
  assert.equal(report.tools[0].fields[0].type, "string");
  assert.equal(report.tools[1].present, false);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("PRIVATE_DESCRIPTION"), false);
  assert.equal(serialized.includes("PRIVATE_DEFAULT"), false);
  assert.equal(serialized.includes("SECRET_NO_PRINT"), false);
  assert.equal(serialized.includes("SECRET_DOC_ID"), false);
  assert.equal(serialized.includes("https://example.test"), false);
});

test("S5-F edit metadata default CLI is inert", () => {
  const path = fileURLToPath(new URL("../tools/s5-inspect-edit-metadata.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [path], { encoding: "utf8" });
  assert.match(output, /no tools\/call/);
});
