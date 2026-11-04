import test from "node:test";
import assert from "node:assert/strict";
import {
  createS6PreviewReadOnlyPort,
  runS6PreviewCancel,
} from "../tools/s6-preview-cancel-readonly.mjs";

const goal = [
  "# 目标：小七 S6 验收",
  "- 目标ID: G999",
  "- 说明: 用于验证长期目标动态发现。",
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
const scope = { mode: "space", spaceId: "space-PRIVATE_GOALS" };
const ack = (data) => ({
  content: [{ type: "text", text: JSON.stringify({ ok: true, data }) }],
});
function fixture() {
  const calls = [];
  const client = {
    async listTools() {
      return [
        { name: "list_docs", inputSchema: { required: ["space_id"] } },
        { name: "read_doc", inputSchema: { required: ["doc_id"] } },
        { name: "edit_doc", inputSchema: { required: ["doc_id", "content"] } },
        { name: "create_markdown_doc", inputSchema: { required: ["title", "content"] } },
      ];
    },
    async callTool(name, args) {
      calls.push({ name, args });
      if (name === "list_docs") return ack({
        docs: [{ doc_id: "page-G999", title: "G999", space_id: scope.spaceId }], total: 1,
      });
      if (name === "read_doc") return ack({ doc_id: args.doc_id, content: goal });
      throw Error("remote mutation must never be called");
    },
  };
  const metrics = { reads: 0 };
  return { calls, metrics,
    port: createS6PreviewReadOnlyPort(client, "page-TASKS", metrics) };
}

test("S6 local preview and cancel checks real-shaped G999 without any mutation", async () => {
  const f = fixture();
  const result = await runS6PreviewCancel(f.port, scope);
  assert.deepEqual(result, {
    goalVerified: true, prepared: true, canceled: true, finalStatus: "CANCELED",
  });
  assert.equal(f.metrics.reads, 4);
  assert.ok(f.calls.every(({ name }) => name === "list_docs" || name === "read_doc"));
});

test("S6 preview-only local port hard-blocks create and edit even when called directly", async () => {
  const f = fixture();
  await assert.rejects(() => f.port.createDoc(scope, "G001", "secret"), /WRITE_FORBIDDEN/);
  await assert.rejects(() => f.port.editDoc("page-G999", "secret"), /WRITE_FORBIDDEN/);
  assert.equal(f.metrics.reads, 0);
  assert.equal(f.calls.length, 0);
});

test("S6 preview-only fails closed when pinned G999 belongs to another space", async () => {
  const f = fixture();
  await assert.rejects(() => runS6PreviewCancel(f.port, { mode: "space", spaceId: "space-OTHER" }));
  assert.ok(f.calls.every(({ name }) => name === "list_docs" || name === "read_doc"));
});
