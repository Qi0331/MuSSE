import test from "node:test";
import assert from "node:assert/strict";
import { runS6OneShot } from "../tools/s6-one-shot-acceptance.mjs";
import { TASK_HEADER } from "../src/markdown/tasks.ts";

const scope = { mode: "space", spaceId: "space-TEST_GOALS" };
const existing = [
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
  "",
].join("\n");
const taskTable = [
  "# 任务总表",
  "| " + TASK_HEADER.join(" | ") + " |",
  "| " + TASK_HEADER.map(() => "---").join(" | ") + " |",
  "| T-001 | 示例任务 | 描述 | 学习 | P2 | todo | 2026-11-20 |  |  |  | 2026-11-04 10:00 |  |",
].join("\n");

function fixture({ existingG998 = false, failEdit = false } = {}) {
  const pages = new Map([
    ["page-G999", { title: "G999", content: existing }],
  ]);
  if (existingG998) pages.set("page-G998", {
    title: "G998",
    content: "# 目标：已有目标\n- 目标ID: G998\n- 说明: 已存在\n\n## 阶段\n\n## 进度历史\n",
  });
  const calls = [];
  const port = {
    async listDirectChildren() {
      calls.push("list");
      return {
        complete: true,
        entries: [...pages.entries()].map(([docId, doc]) => ({
          docId, title: doc.title, parentId: null,
          spaceId: scope.spaceId, kind: "unverified",
        })),
      };
    },
    async readDoc(id) {
      calls.push("read");
      const p = pages.get(id);
      if (!p) throw Error("NOT_FOUND");
      return p.content;
    },
    async readTaskTable() {
      calls.push("tasks");
      return taskTable;
    },
    async createDoc(_scope, title, content) {
      calls.push("create");
      if (pages.has("page-G998")) throw Error("DUPLICATE");
      pages.set("page-G998", { title, content });
      return "page-G998";
    },
    async editDoc(id, content) {
      calls.push("edit");
      const old = pages.get(id);
      if (!old) throw Error("NOT_FOUND");
      pages.set(id, { ...old, content });
      if (failEdit) throw Error("REMOTE_OUTCOME_UNCERTAIN");
    },
  };
  return { port, pages, calls };
}

test("S6 one-run accepted flow exercises all three dry cancellations and exactly three verified writes", async () => {
  const f = fixture();
  let backups = 0;
  const events = [];
  const outcome = await runS6OneShot(f.port, scope, {
    ask: async (phrase) => phrase,
    beforeFirstWrite: async (original) => {
      backups++;
      assert.equal(original, existing);
    },
    report: (event) => events.push(event),
  });
  assert.equal(outcome.finalStatus, "VERIFIED");
  assert.equal(outcome.taskCount, 1);
  assert.equal(outcome.previewCancelActions, 3);
  assert.equal(outcome.writesAttempted, 3);
  assert.equal(outcome.verifiedWrites, 3);
  assert.equal(outcome.finalGoalCount, 2);
  assert.equal(backups, 1);
  assert.deepEqual(f.calls.filter((name) => name === "edit" || name === "create"),
    ["edit", "create", "edit"]);
  assert.match(f.pages.get("page-G999").content, /用于验证长期目标动态发现。 \[小七 S6 一次性验收\]/);
  assert.match(f.pages.get("page-G998").content, /小七 S6 受控进度写入验收/);
  assert.equal(events.filter((e) => e.type === "dry_pass").length, 3);
});

test("S6 one-run rejected first write means all 3 dry tests complete and zero writes", async () => {
  const f = fixture();
  let backups = 0;
  const outcome = await runS6OneShot(f.port, scope, {
    ask: async () => "0",
    beforeFirstWrite: async () => { backups++; },
  });
  assert.equal(outcome.finalStatus, "CANCELED_NO_WRITES");
  assert.equal(outcome.writesAttempted, 0);
  assert.equal(backups, 0);
  assert.ok(f.calls.every((n) => !["edit", "create"].includes(n)));
  assert.equal(f.pages.size, 1);
});

test("S6 one-run approval is per stage; declining after first stops without creating G998", async () => {
  const f = fixture();
  let answered = 0;
  const outcome = await runS6OneShot(f.port, scope, {
    ask: async (phrase) => (++answered === 1 ? phrase : "0"),
    beforeFirstWrite: async () => {},
  });
  assert.equal(outcome.finalStatus, "PARTIAL_VERIFIED_STOP");
  assert.equal(outcome.writesAttempted, 1);
  assert.equal(outcome.verifiedWrites, 1);
  assert.equal(f.pages.size, 1);
  assert.deepEqual(f.calls.filter((name) => ["edit", "create"].includes(name)), ["edit"]);
});

test("S6 one-run aborts immediately on uncertain first remote edit, never retries or creates", async () => {
  const f = fixture({ failEdit: true });
  let answered = 0;
  await assert.rejects(() => runS6OneShot(f.port, scope, {
    ask: async (phrase) => { answered++; return phrase; },
    beforeFirstWrite: async () => {},
  }), (error) => error?.code === "S6_WRITE_UNCERTAIN");
  assert.equal(answered, 1);
  assert.deepEqual(f.calls.filter((name) => ["edit", "create"].includes(name)), ["edit"]);
});

test("S6 one-run refuses an already occupied isolated test ID before any write", async () => {
  const f = fixture({ existingG998: true });
  let asked = 0;
  await assert.rejects(() => runS6OneShot(f.port, scope, {
    ask: async () => { asked++; return "确认修改 G999"; },
    beforeFirstWrite: async () => {},
  }), /S6_G998_ALREADY_EXISTS/);
  assert.equal(asked, 0);
  assert.ok(f.calls.every((n) => !["edit", "create"].includes(n)));
});
