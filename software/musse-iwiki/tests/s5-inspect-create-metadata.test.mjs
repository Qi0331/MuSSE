import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { summarizeCreateMetadata } from "../tools/s5-inspect-create-metadata.mjs";

test("S5-F reports only selected create metadata, not arbitrary schema values", () => {
  const r = summarizeCreateMetadata([{
    name: "create_markdown_doc",
    description: "Create in writable space. https://example.test/private/Bearer-SECRET",
    inputSchema: { properties: {
      title: { type: "string", description: "The title" },
      content: { type: "string", description: "Bearer SECRET_DO_NOT_PRINT" },
      space_id: { type: "string", description: "Space id for destination" },
      secret_key: { type: "string", default: "PRIVATE" },
    }, required: ["title", "content"] },
  }]);
  assert.equal(r.present, true);
  assert.deepEqual(r.fields.map(x => x.name), ["title", "content", "space_id", "space_name", "parent_id"]);
  assert.equal(r.fields[2].required, false);
  assert.equal(r.fields[2].advertised, true);
  assert.equal(r.fields[3].advertised, false);
  assert.equal(JSON.stringify(r).includes("SECRET_DO_NOT_PRINT"), false);
  assert.equal(JSON.stringify(r).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(r).includes("https://example.test"), false);
});

test("S5-F metadata requires no document access or write calls", () => {
  assert.deepEqual(summarizeCreateMetadata([]), { present: false });
  const path = fileURLToPath(new URL("../tools/s5-inspect-create-metadata.mjs", import.meta.url));
  const help = execFileSync(process.execPath, [path], { encoding: "utf8" });
  assert.match(help, /No tools\/call/);
});
