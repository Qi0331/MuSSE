import test from "node:test";
import assert from "node:assert/strict";
import { parseGoal } from "../src/markdown/goals.ts";
import {
  s6RecoveryReadOnlyClient,
  summarizeS6Recovery,
} from "../tools/s6-audit-post-uncertain.mjs";

const g999 = [
  "# 目标：小七 S6 验收",
  "- 目标ID: G-999",
  "- 说明: 用于验证长期目标动态发现。 [小七 S6 一次性验收]",
  "",
  "## 阶段",
  "",
  "## 进度历史",
  "",
  "| 日期 | 进度 | 说明 |",
  "|---|---|---|",
].join("\n");

const base = [
  "# 目标：小七 S6 自动创建验收",
  "- 目标ID: G-998",
  "- 说明: 隔离测试文档，完成验收后由用户自行决定保留或清理",
  "",
  "## 阶段",
  "",
  "### 阶段 P1：功能验证",
  "- 阶段ID: P1",
  "- 任务:",
  "- 手动进度:",
  "",
  "## 进度历史",
  "",
  "| 日期 | 进度 | 说明 |",
  "|---|---|---|",
].join("\n");

const row = "| 2026-11-04 | 0% | 小七 S6 受控进度写入验收（隔离测试） |";
function makeGoals(content) {
  return new Map([
    ["G-999", { entry: { title: "G-999" }, goal: parseGoal(g999) }],
    ["G-998", { entry: { title: "G-998" }, goal: parseGoal(content) }],
  ]);
}
test("S6 post-uncertain audit identifies exactly one already-persisted record", () => {
  const report = summarizeS6Recovery(makeGoals(base + "\n" + row), []);
  assert.equal(report.g999MarkerVerified, true);
  assert.equal(report.g998ExistsAndValid, true);
  assert.equal(report.matchingProgressRecords, 1);
  assert.equal(report.progressMatchesCurrentTaskState, true);
  assert.equal(report.thirdWriteStatus, "PERSISTED_VERIFIED");
  assert.equal(report.writesAttempted, 0);
  assert.equal(report.writeRetryPermitted, false);
  assert.equal(JSON.stringify(report).includes("受控进度"), false);
});
test("S6 post-uncertain audit never interprets missing progress as consent to retry", () => {
  const report = summarizeS6Recovery(makeGoals(base), []);
  assert.equal(report.thirdWriteStatus, "NOT_OBSERVED_DO_NOT_RETRY");
  assert.equal(report.writeRetryPermitted, false);
});
test("S6 post-uncertain audit detects duplicate or conflicting progress", () => {
  const duplicate = summarizeS6Recovery(makeGoals(base + "\n" + row + "\n" + row), []);
  assert.equal(duplicate.matchingProgressRecords, 2);
  assert.equal(duplicate.thirdWriteStatus, "DUPLICATE_DO_NOT_RETRY");
  const wrong = summarizeS6Recovery(makeGoals(base + "\n" + row.replace("0%", "90%")), []);
  assert.equal(wrong.thirdWriteStatus, "PERCENT_MISMATCH_DO_NOT_RETRY");
});
test("S6 post-uncertain client strictly limits calls to read tools", async () => {
  const called = [];
  const client = {
    async listTools() { return [{name:"read_doc"}, {name:"list_docs"}, {name:"edit_doc"}]; },
    async callTool(name) { called.push(name); return { ok: true }; },
  };
  const guard = s6RecoveryReadOnlyClient(client);
  assert.deepEqual((await guard.listTools()).map(x=>x.name), ["read_doc","list_docs"]);
  await assert.rejects(()=>guard.callTool("edit_doc",{}), /WRITE_FORBIDDEN/);
  await guard.callTool("list_docs",{});
  assert.deepEqual(called, ["list_docs"]);
});
