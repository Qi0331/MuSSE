import test from "node:test";
import assert from "node:assert/strict";
import { recoverS6ProgressOnce, createS6SingleEditGuard, createS6DiagnosedReadPort, verifyS6ToolAccess, summarizeS6ToolAccessError } from "../tools/s6-recover-progress-once.mjs";
import { TASK_HEADER } from "../src/markdown/tasks.ts";

const scope = { mode: "space", spaceId: "space-PRIVATE_GOALS" };
const NOTE = "小七 S6 受控进度写入验收（隔离测试）";
const goal999 = [
  "# 目标：小七 S6 验收",
  "- 目标ID: G999",
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
  "- 目标ID: G998",
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
    ["page-G999", { title: "G999", content: goal999 }],
    ["page-G998", { title: "G998", content: existingNote ?
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
test("S6 targeted recovery verifies one and only one edit, preserves G999", async () => {
  const f = fixture();
  const saved = [];
  const result = await recoverS6ProgressOnce(
    f.port, scope, f.control, options(["确认单次补写 G998"], saved));
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
    options(["确认单次补写 G998"], []));
  assert.equal(result.status, "PERSISTED_ACK_UNCONFIRMED");
  assert.equal(result.flowResult, "WRITE_UNCERTAIN");
  assert.equal(result.remoteErrorCode, "IWIKI_RPC_ERROR");
  assert.equal(f.control.attempted, 1);
  assert.deepEqual(f.calls.filter((name) => name === "edit"), ["edit"]);
});
test("S6 targeted recovery classifies unchanged remote document and forbids repeat", async () => {
  const f = fixture({editBehavior:"before"});
  const result = await recoverS6ProgressOnce(f.port, scope, f.control,
    options(["确认单次补写 G998"], []));
  assert.equal(result.status, "UNCHANGED_NO_RETRY");
  assert.equal(f.control.attempted, 1);
  assert.equal(f.pages.get("page-G998").content, goal998);
});
test("S6 targeted recovery fails if prior progress was already recorded", async () => {
  const f = fixture({existingNote:true});
  let prompts = 0;
  await assert.rejects(() => recoverS6ProgressOnce(f.port, scope, f.control, {
    ...options([],[]), ask:async () => { prompts++; return "确认单次补写 G998"; },
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


test("S6 zero-write preflight reports only structural checks for changed target", async () => {
  const f = fixture();
  const originalRead = f.port.readDoc;
  f.port.readDoc = async (id) => {
    const text = await originalRead(id);
    return id === "page-G998"
      ? text.replace("小七 S6 自动创建验收", "用户后来修改的目标名称")
      : text;
  };
  const events = [];
  await assert.rejects(() => recoverS6ProgressOnce(f.port, scope, f.control, {
    ...options([], []),
    report: (event) => events.push(event),
  }), /S6_TEST_TARGET_CHANGED/);
  const report = events.find((event) => event.type === "preflight_check");
  assert.deepEqual(report.checks, {
    goalCountTwo: true,
    g999Present: true,
    g999MarkerValid: true,
    g998Present: true,
    g998TitleValid: false,
    g998IdValid: true,
    progressAlreadyPresent: false,
  });
  assert.equal(JSON.stringify(report).includes("用户后来修改"), false);
  assert.equal(f.control.attempted, 0);
});


test("S6 transient goal-list RPC failure is retried once with read-only calls", async () => {
  const f = fixture();
  const diagnostics = {};
  const ordinaryList = f.port.listDirectChildren;
  let attempts = 0;
  f.port.listDirectChildren = async (scope) => {
    attempts++;
    if (attempts === 1) {
      const error = Error("private server diagnostics must not leak");
      error.code = "S6_REMOTE_UNAVAILABLE";
      throw error;
    }
    return ordinaryList(scope);
  };
  const port = createS6DiagnosedReadPort(f.port, diagnostics);
  const outcome = await recoverS6ProgressOnce(
    port, scope, f.control, options(["0"], []));
  assert.equal(outcome.status, "CANCELED_NO_WRITES");
  assert.equal(f.control.attempted, 0);
  assert.equal(diagnostics.listRetries, 1);
  assert.ok(diagnostics.listAttempts >= 2);
  assert.equal(diagnostics.lastListError, null);
});

test("S6 structural list mismatch fails closed with no read retry, no write", async () => {
  const f = fixture();
  const diag = {};
  f.port.listDirectChildren = async () => {
    const error = Error("private data may be embedded here");
    error.code = "S6_LIST_INCOMPLETE";
    throw error;
  };
  const port = createS6DiagnosedReadPort(f.port, diag);
  await assert.rejects(() => recoverS6ProgressOnce(
    port, scope, f.control, options([], [])),
    (error) => error?.code === "S6_DISCOVERY_UNAVAILABLE");
  assert.equal(diag.listAttempts, 1);
  assert.equal(diag.listRetries, 0);
  assert.equal(diag.lastListError, "S6_LIST_INCOMPLETE");
  assert.equal(f.control.attempted, 0);
});

test("S6 repeated transient list failure halts after exactly two read calls", async () => {
  const f = fixture();
  const diag = {};
  let n = 0;
  f.port.listDirectChildren = async () => {
    n++;
    const error = Error("network exception private content");
    error.code = "S6_REMOTE_UNAVAILABLE";
    throw error;
  };
  const port = createS6DiagnosedReadPort(f.port, diag);
  await assert.rejects(() => recoverS6ProgressOnce(
    port, scope, f.control, options([], [])),
    (error) => error?.code === "S6_DISCOVERY_UNAVAILABLE");
  assert.equal(n, 2);
  assert.equal(diag.listRetries, 1);
  assert.equal(diag.lastListError, "S6_REMOTE_UNAVAILABLE");
  assert.equal(f.control.attempted, 0);
});


test("S6 tool access identifies initialization failure without remote tools/call or secrets", async () => {
  const diagnostic = {};
  let toolsListCalls = 0;
  const client = {
    async initialize() {
      const e = Error("PRIVATE_TOKEN_SHOULD_NOT_LEAK");
      e.code = "IWIKI_HTTP_ERROR";
      e.message = "iWiki MCP HTTP 403: PRIVATE_TOKEN_SHOULD_NOT_LEAK";
      throw e;
    },
    async listTools() { toolsListCalls++; return []; },
  };
  await assert.rejects(() => verifyS6ToolAccess(client, diagnostic),
    /S6_TOOL_ACCESS_FAILED/);
  assert.equal(diagnostic.stage, "initialize");
  assert.equal(diagnostic.error.category, "IWIKI_HTTP_ERROR");
  assert.equal(diagnostic.error.httpStatus, 403);
  assert.equal(toolsListCalls, 0);
  assert.equal(JSON.stringify(diagnostic).includes("PRIVATE_TOKEN"), false);
});

test("S6 tool access distinguishes tools/list RPC failure after successful initialize", async () => {
  const diagnostic = {};
  const calls = [];
  const client = {
    async initialize() { calls.push("initialize"); },
    async listTools() {
      calls.push("tools_list");
      const e = Error("tools/list: PRIVATE ( -32001 )");
      e.code = "IWIKI_RPC_ERROR";
      e.message = "tools/list: sensitive response (-32001)";
      throw e;
    },
  };
  await assert.rejects(() => verifyS6ToolAccess(client, diagnostic),
    /S6_TOOL_ACCESS_FAILED/);
  assert.deepEqual(calls, ["initialize", "tools_list"]);
  assert.equal(diagnostic.stage, "tools_list");
  assert.deepEqual(diagnostic.error, {
    category: "IWIKI_RPC_ERROR",
    httpStatus: null,
    rpcCode: -32001,
    networkCause: null,
  });
});

test("S6 tool access successful handshake and tools/list is zero-write and ready", async () => {
  const diagnostic = {};
  const calls = [];
  const client = {
    async initialize() { calls.push("initialize"); },
    async listTools() { calls.push("tools_list"); return [{name:"list_docs"}]; },
  };
  assert.deepEqual(await verifyS6ToolAccess(client, diagnostic), [{name:"list_docs"}]);
  assert.equal(diagnostic.stage, "ready");
  assert.equal(diagnostic.error, null);
  assert.deepEqual(calls, ["initialize","tools_list"]);
});

test("S6 tool access summarizes only allowlisted network errors without private content", () => {
  const err = Object.assign(new TypeError("PRIVATE_NETWORK_BODY"), {
    cause: { code: "ECONNRESET", private: "SECRET" },
  });
  assert.deepEqual(summarizeS6ToolAccessError(err), {
    category: "NETWORK_OR_RESPONSE",
    httpStatus: null,
    rpcCode: null,
    networkCause: "ECONNRESET",
  });
  assert.equal(JSON.stringify(summarizeS6ToolAccessError(err)).includes("SECRET"), false);
});
