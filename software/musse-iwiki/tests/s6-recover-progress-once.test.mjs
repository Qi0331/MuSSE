import test from "node:test";
import assert from "node:assert/strict";
import { recoverS6ProgressOnce, createS6SingleEditGuard } from "../tools/s6-recover-progress-once.mjs";
import { TASK_HEADER } from "../src/markdown/tasks.ts";

const scope = { mode: "space", spaceId: "space-PRIVATE_GOALS" };
const NOTE = "小七 S6 受控进度写入验收（隔离测试）";
const goal999 = [
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
const goal998 = [
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
const tasks = [
  "# 任务总表",
  "| " + TASK_HEADER.join(" | ") + " |",
  "| " + TASK_HEADER.map(() => "---").join(" | ") + " |",
  "| T-001 | 任务 | 说明 | 学习 | P2 | todo | 2026-12-31 |  |  |  | 2026-11-04 11:00 |  |",
].join("\n");

function fixture({ editBehavior = "success", existingNote = false } = {}) {
  const control = { armed: false, attempted: 0, targetDocId: null,
    ack: null, remoteErrorCode: null };
  const pages = new Map([
    ["page-G999", { title: "G-999", content: goal999 }],
    ["page-G998", { title: "G-998", content: existingNote ?
      goal998 + "\n| 2026-11-04 | 0% | " + NOTE + " |\n" : goal998 }],
  ]);
  const calls = [];
  const port = {
    async listDirectChildren() {
      calls.push("list");
      return { complete: true,
        entries: [...pages].map(([docId, page]) => ({
          docId, title: page.title, spaceId: scope.spaceId,
          parentId: null, kind: "unverified",
        })) };
    },
    async readDoc(docId) {
      calls.push("read");
      if (!pages.has(docId)) throw Error("missing");
      return pages.get(docId).content;
    },
    async readTaskTable() { calls.push("task"); return tasks; },
    async createDoc() { calls.push("CREATE_FORBIDDEN"); throw Error("forbidden"); },
    async editDoc(docId, content) {
      calls.push("edit");
      if (!control.armed || control.attempted !== 0 ||
          control.targetDocId !== docId || docId !== "page-G998")
        throw Error("write guard");
      control.attempted++;
      control.armed = false;
      if (editBehavior !== "before") pages.get(docId).content = content;
      if (editBehavior !== "success") {
        control.remoteErrorCode = "IWIKI_RPC_ERROR";
        throw Error("remote issue");
      }
      control.ack = { mcpError: false,
        envelopes: [{ source: "textJson", fields: ["ok", "data"],
          dataFields: ["doc_id"], ok: true, success: null }] };
    },
  };
  return { port, control, pages, calls };
}
const options = (answers, saved) => ({
  ask: async () => answers.shift() ?? "0",
  backup: async (content) => saved.push(content),
  clock: () => Date.parse("2026-11-04T09:00:00Z"),
});
test("S6 targeted recovery verifies one and only one edit, preserves G-999", async () => {
  const f = fixture();
  const saved = [];
  const result = await recoverS6ProgressOnce(
    f.port, scope, f.control, options(["确认单次补写 G-998"], saved));
  assert.equal(result.status, "VERIFIED");
  assert.equal(result.writeAttempts, 1);
  assert.equal(result.progressRecordsObserved, 1);
  assert.equal(result.writeRetryPermitted, false);
  assert.equal(f.pages.get("page-G999").content, goal999);
  assert.equal(saved.length, 1);
  assert.equal(saved[0], goal998);
  assert.deepEqual(f.calls.filter((v) => v === "edit" || v === "CREATE_FORBIDDEN"), ["edit"]);
});
test("S6 targeted recovery requires new exact approval and never writes on cancellation", async () => {
  const f = fixture();
  const saved = [];
  const result = await recoverS6ProgressOnce(f.port, scope, f.control, options(["0"], saved));
  assert.equal(result.status, "CANCELED_NO_WRITES");
  assert.equal(f.control.attempted, 0);
  assert.equal(saved.length, 0);
  assert.equal(f.pages.get("page-G998").content, goal998);
});
test("S6 targeted recovery reconciles remote error after persisted edit without retrying", async () => {
  const f = fixture({editBehavior:"after"});
  const result = await recoverS6ProgressOnce(f.port, scope, f.control,
    options(["确认单次补写 G-998"], []));
  assert.equal(result.status, "PERSISTED_ACK_UNCONFIRMED");
  assert.equal(result.flowResult, "WRITE_UNCERTAIN");
  assert.equal(result.remoteErrorCode, "IWIKI_RPC_ERROR");
  assert.equal(f.control.attempted, 1);
  assert.deepEqual(f.calls.filter((name) => name === "edit"), ["edit"]);
});
test("S6 targeted recovery classifies unchanged remote document and forbids repeat", async () => {
  const f = fixture({editBehavior:"before"});
  const result = await recoverS6ProgressOnce(f.port, scope, f.control,
    options(["确认单次补写 G-998"], []));
  assert.equal(result.status, "UNCHANGED_NO_RETRY");
  assert.equal(f.control.attempted, 1);
  assert.equal(f.pages.get("page-G998").content, goal998);
});
test("S6 targeted recovery fails if prior progress was already recorded", async () => {
  const f = fixture({existingNote:true});
  let prompts = 0;
  await assert.rejects(() => recoverS6ProgressOnce(f.port, scope, f.control, {
    ...options([],[]), ask:async () => { prompts++; return "确认单次补写 G-998"; },
  }), /S6_PROGRESS_ALREADY_EXISTS/);
  assert.equal(prompts, 0);
  assert.equal(f.control.attempted, 0);
});
test("S6 scoped edit guard only permits one armed write to exact discovered page ID", async () => {
  const control = { armed: true, attempted: 0, targetDocId: "page-G998",
    ack: null, remoteErrorCode: null };
  const called = [];
  const guarded = createS6SingleEditGuard({
    async listTools() { return [
      {name:"list_docs"}, {name:"read_doc"}, {name:"edit_doc"}, {name:"create_markdown_doc"},
    ]; },
    async callTool(name) {
      called.push(name);
      return {content:[{type:"text",text:JSON.stringify({ok:true,data:{doc_id:"page-G998"}})}]};
    },
  }, control);
  assert.deepEqual((await guarded.listTools()).map((t) => t.name),
    ["list_docs", "read_doc", "edit_doc"]);
  await assert.rejects(() => guarded.callTool("create_markdown_doc",{}), /WRITE_FORBIDDEN/);
  await assert.rejects(() => guarded.callTool("edit_doc",{doc_id:"page-G999",content:"bad"}), /WRITE_FORBIDDEN/);
  await guarded.callTool("edit_doc",{doc_id:"page-G998",content:"ok"});
  await assert.rejects(() => guarded.callTool("edit_doc",{doc_id:"page-G998",content:"again"}), /WRITE_FORBIDDEN/);
  assert.equal(control.attempted,1);
  assert.deepEqual(called, ["edit_doc"]);
});
