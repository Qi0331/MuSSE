import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectS5LocalFiles, summarizeS5LocalStatus } from "../tools/s5-local-preflight.mjs";

const privateToken = "PRIVATE_TOKEN_DO_NOT_PRINT";
const privatePage = "page-PRIVATE_DO_NOT_PRINT";
const config = {
  mcpServers: {
    iwiki: {
      type: "http", url: "https://ssemarket.cn/iwiki-api/mcp",
      headers: { Authorization: "Bearer " + privateToken },
    },
    musse_iwiki_readonly: { command: "node", args: ["private-s4-path"] },
  },
};
const mapping = { taskDocId: privatePage };
const contract = {
  toolName: "edit_doc", documentIdArgument: "doc_id", contentArgument: "content",
};

test("S5-G local inventory is sanitized and detects the still-absent S5 bridge service", () => {
  const report = summarizeS5LocalStatus(config, mapping, contract);
  assert.equal(report.officialIwiki, "CONFIGURED");
  assert.equal(report.s4Readonly, "REGISTERED");
  assert.equal(report.s5BridgeEntry, "ABSENT");
  assert.equal(report.taskMapping, "TASK_VALID");
  assert.equal(report.writeContract, "VERIFIED_FIELDS");
  assert.equal(report.liveVoiceValidated, false);
  assert.equal(report.productionWriteAuthorized, false);
  assert.equal(JSON.stringify(report).includes(privateToken), false);
  assert.equal(JSON.stringify(report).includes(privatePage), false);
});

test("S5-G local inventory reports changed/invalid contract and S5 registration without changing any input", () => {
  const setup = structuredClone(config);
  setup.mcpServers.musse_iwiki_voice_write = { command: "node" };
  const before = JSON.stringify(setup);
  const result = summarizeS5LocalStatus(setup, mapping, {
    ...contract, toolName: "append_to_doc",
  }, { MUSSE_S5_WRITE_ENABLED: "1" });
  assert.equal(result.s5BridgeEntry, "PRESENT");
  assert.equal(result.writeContract, "NOT_CONFIRMED");
  assert.equal(result.writeFlagInThisShell, "SET");
  assert.equal(JSON.stringify(setup), before);
});

test("S5-G local inventory reads synthetic private files without modifying or printing values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "musse-s5g-preflight-"));
  const files = [
    join(dir, "xiaozhi.config.json"),
    join(dir, "musse-iwiki-readonly.json"),
    join(dir, "musse-iwiki-write.json"),
  ];
  try {
    await writeFile(files[0], JSON.stringify(config));
    await writeFile(files[1], JSON.stringify(mapping));
    const before = await Promise.all(files.slice(0, 2).map((f) => readFile(f, "utf8")));
    const reportMissing = await inspectS5LocalFiles(...files);
    assert.equal(reportMissing.contractFile, "MISSING");
    assert.equal(reportMissing.writeContract, "NOT_CONFIRMED");
    assert.equal(reportMissing.s5BridgeEntry, "ABSENT");
    await writeFile(files[2], JSON.stringify(contract));
    const report = await inspectS5LocalFiles(...files);
    assert.equal(report.contractFile, "PRESENT");
    assert.equal(report.writeContract, "VERIFIED_FIELDS");
    assert.equal(JSON.stringify(report).includes(privateToken), false);
    assert.equal(JSON.stringify(report).includes(privatePage), false);
    assert.deepEqual(await Promise.all(files.slice(0, 2).map((f) => readFile(f, "utf8"))), before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
