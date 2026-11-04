import assert from "node:assert/strict";
import test from "node:test";
import { planS5Repoint } from "../tools/s5-repoint-write.mjs";

const oldPath = "C:\\Users\\TEST\\MuSSE-Lab\\MuSSE-S5F\\software\\musse-iwiki\\src\\mcp\\server-s5-write.ts";
const newPath = "C:\\Users\\TEST\\MuSSE-Lab\\MuSSE-S6\\software\\musse-iwiki\\src\\mcp\\server-s5-write.ts";
const nodePath = "D:\\NODE\\node.exe";
function fixture(old = oldPath) {
  return { mcpEndpoint: "secret-connection-url", mcpServers: {
    iwiki: { type: "http", headers: { Authorization: "Bearer private" } },
    musse_iwiki_readonly: { command: nodePath, args: ["readonly.ts"] },
    musse_iwiki_s5_write: { command: nodePath, args: [old] },
    musse_iwiki_s6_goals: { command: nodePath, args: ["goals.ts"], env: { S6: "1" } },
  }, mcpServerConfig: { musse_iwiki_s5_write: { tools: { musse_write_confirm: { enable: true } } } } };
}
test("S5 path repair changes ONLY S5 launcher path and preserves private config semantics", () => {
  const old = fixture();
  const snapshot = JSON.stringify(old);
  const plan = planS5Repoint(old, newPath, nodePath);
  assert.equal(plan.state, "READY");
  assert.equal(JSON.stringify(old), snapshot);
  const expected = fixture(newPath);
  assert.deepEqual(plan.updated, expected);
  assert.equal(plan.updated.mcpServers.iwiki.headers.Authorization, "Bearer private");
  assert.equal(plan.updated.mcpServerConfig.musse_iwiki_s5_write.tools.musse_write_confirm.enable, true);
  assert.equal(planS5Repoint(expected, newPath, nodePath).state, "ALREADY_CURRENT");
});
test("S5 repair rejects arbitrary paths, missing services, unexpected fields and another node", () => {
  const bad = [fixture("C:\\OTHER\\server-s5-write.ts"), fixture("C:\\TEST\\other.ts")];
  for (const config of bad)
    assert.throws(() => planS5Repoint(config, newPath, nodePath), /S5_REPOINT_OLD_PATH_UNEXPECTED/);
  const missing = fixture();
  delete missing.mcpServers.iwiki;
  assert.throws(() => planS5Repoint(missing, newPath, nodePath), /S5_REPOINT_SCOPE_UNVERIFIED/);
  const env = fixture();
  env.mcpServers.musse_iwiki_s5_write.env = { VALUE: "1" };
  assert.throws(() => planS5Repoint(env, newPath, nodePath), /S5_REPOINT_ENTRY_UNVERIFIED/);
  const differentNode = fixture();
  differentNode.mcpServers.musse_iwiki_s5_write.command = "C:\\OTHER\\node.exe";
  assert.throws(() => planS5Repoint(differentNode, newPath, nodePath), /S5_REPOINT_ENTRY_UNVERIFIED/);
  assert.throws(() => planS5Repoint(fixture(), oldPath, nodePath), /S5_REPOINT_TARGET_UNVERIFIED/);
});
