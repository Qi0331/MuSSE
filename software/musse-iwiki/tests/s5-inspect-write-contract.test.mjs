import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { inspectS5FromFile, summarizeS5WriteToolCandidates } from "../tools/s5-inspect-write-contract.mjs";

const config = {
  mcpServers: { iwiki: { type: "http", url: "https://ssemarket.cn/iwiki-api/mcp",
    headers: { Authorization: "Bearer FAKE_SECRET_NEVER_PRINT" } } },
};

test("S5-C tool listing summarizes only candidate names and parameter keys", () => {
  const report = summarizeS5WriteToolCandidates([
    { name: "read_doc", description: "PRIVATE_TITLE" },
    { name: "write_doc", description: "SECRET_BODY", inputSchema: { properties: {
      doc_id: { default: "PRIVATE_PAGE" }, content: { example: "SECRET_CONTENT" }, expected_revision: {} }, required: ["doc_id"] } },
    { name: "write_doc", description: "DUPLICATE" },
    { name: "write_private/doc", description: "INVALID" },
  ]);
  assert.equal(report.advertisedToolCount, 4);
  assert.deepEqual(report.mutationCandidates, [{ name: "write_doc", fields: ["doc_id", "content", "expected_revision"], required: ["doc_id"], hasVersionNamedField: true }]);
  assert.equal(report.atomicConditionalWriteVerified, false);
  const output = JSON.stringify(report);
  for (const s of ["PRIVATE_TITLE", "SECRET_BODY", "PRIVATE_PAGE", "SECRET_CONTENT", "write_private/doc", "FAKE_SECRET_NEVER_PRINT"]) {
    assert.equal(output.includes(s), false);
  }
});

test("S5-C simulated live discovery never invokes tools/call", async () => {
  const dir = await mkdtemp(join(tmpdir(), "musse-s5-contract-"));
  try {
    const path = join(dir, "private.json");
    await writeFile(path, JSON.stringify(config));
    let list = 0, called = 0;
    const report = await inspectS5FromFile(path, ({ token }) => {
      assert.equal(token, "FAKE_SECRET_NEVER_PRINT");
      return { listTools: async () => { list++; return [{ name: "update_doc", inputSchema: { properties: { version: {} } } }]; },
        callTool: async () => {called++; throw Error("should never be called");} };
    });
    assert.equal(list, 1);
    assert.equal(called, 0);
    assert.equal(report.mutationCandidates[0].name, "update_doc");
    assert.equal(JSON.stringify(report).includes("FAKE_SECRET_NEVER_PRINT"), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("S5-C default CLI is inert and only shows help", () => {
  const output = execFileSync(process.execPath, [new URL("../tools/s5-inspect-write-contract.mjs", import.meta.url).pathname], { encoding: "utf8" });
  assert.match(output, /no config read\/network/);
});
