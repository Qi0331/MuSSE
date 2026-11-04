import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { loadFixtureStore, MemoryStore } from "../src/store/local-store.ts";
import { TaskService } from "../src/service/task-service.ts";
import { DOC_PATHS } from "../src/store/wiki-store.ts";
import { parseTaskTable } from "../src/markdown/tasks.ts";
import { computeGoalProgress, parseGoal } from "../src/markdown/goals.ts";
import { dueTimestamp, isOverdue, shanghaiNow } from "../src/date.ts";
import { createIwikiStoreFromEnv, IwikiMcpStore } from "../src/store/iwiki-store.ts";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { callTool } from "../src/mcp/tools.ts";
import { ConflictError, ParseError, UnavailableError, ValidationError } from "../src/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures");
const NOW = new Date("2026-11-03T04:00:00Z"); // 2026-11-03 12:00 Asia/Shanghai

async function fresh(): Promise<{ store: MemoryStore; service: TaskService }> {
  const store = await loadFixtureStore(fixtures);
  return { store, service: new TaskService(store) };
}

test("parses the fixture task table", async () => {
  const { store } = await fresh();
  const doc = await store.read(DOC_PATHS.tasks);
  const tasks = parseTaskTable(doc.content);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].id, "T-20261101-A1");
  assert.equal(tasks[1].status, "done");
  assert.equal(tasks[2].goalId, "G-001");
});

test("updates only the target task row", async () => {
  const { store, service } = await fresh();
  const before = await store.read(DOC_PATHS.tasks);
  const beforeTasks = parseTaskTable(before.content);
  await service.updateTask("T-20261101-A1", { title: "更新后的调研" }, NOW);
  const after = await store.read(DOC_PATHS.tasks);
  const afterTasks = parseTaskTable(after.content);
  assert.equal(afterTasks.find((t) => t.id === "T-20261101-A1")?.title, "更新后的调研");
  for (const id of ["T-20261102-B2", "T-20261103-C3"]) {
    const original = beforeTasks.find((t) => t.id === id);
    const current = afterTasks.find((t) => t.id === id);
    assert.deepEqual(current, original);
    const beforeLine = before.content.split("\n").find((l) => l.includes(id));
    const afterLine = after.content.split("\n").find((l) => l.includes(id));
    assert.equal(afterLine, beforeLine);
  }
});

test("create, complete, restore and archive transitions", async () => {
  const { service } = await fresh();
  const created = await service.createTask(
    { id: "T-20261103-NEW1", title: "新任务", dueDate: "2026-11-06" },
    NOW,
  );
  assert.equal(created.status, "todo");

  const done = await service.completeTask("T-20261103-NEW1", NOW);
  assert.equal(done.status, "done");

  const restored = await service.restoreTask("T-20261103-NEW1", NOW);
  assert.equal(restored.status, "todo");

  const archived = await service.archiveTask("T-20261103-NEW1", NOW);
  assert.equal(archived.status, "archived");

  await assert.rejects(
    () => service.completeTask("T-20261103-NEW1", NOW),
    ValidationError,
  );
});

test("overdue excludes completed and archived tasks", async () => {
  const { service } = await fresh();
  const overdue = await service.scheduleOverdue(NOW);
  assert.deepEqual(overdue.map((t) => t.id), ["T-20261101-A1"]);

  await service.createTask(
    { id: "T-20261103-TODAY", title: "今日任务", dueDate: "2026-11-03" },
    NOW,
  );
  const today = await service.scheduleToday(NOW);
  assert.ok(today.some((t) => t.id === "T-20261103-TODAY"));
});

test("date-only deadlines expire at the end of the Beijing day", async () => {
  const task = {
    id: "T-20261103-D1",
    title: "当天任务",
    description: "",
    category: "",
    priority: "P2" as const,
    status: "todo" as const,
    dueDate: "2026-11-03",
    dueTime: "",
    goalId: "",
    phaseId: "",
    createdAt: "",
    completedAt: "",
  };
  assert.equal(isOverdue(task, new Date("2026-11-03T12:00:00Z")), false); // 20:00 CST
  assert.equal(isOverdue(task, new Date("2026-11-03T16:00:00Z")), true); // 00:00 CST next day
  assert.equal(dueTimestamp("2026-11-03", ""), Date.parse("2026-11-03T15:59:59.999Z"));
});

test("goal progress is computed from authoritative task status", async () => {
  const { store, service } = await fresh();
  const doc = await store.read("MuSSE 个人管理/长期目标/G-001.md");
  const goal = parseGoal(doc.content);
  const tasks = parseTaskTable((await store.read(DOC_PATHS.tasks)).content);
  const progress = computeGoalProgress(goal, tasks);
  assert.equal(progress.totalTasks, 2);
  assert.equal(progress.completedTasks, 1);
  assert.equal(progress.percent, 50);

  const queried = await service.queryGoal("G-001");
  assert.equal(queried.progress.percent, 50);
});

test("goal progress records use computed percent", async () => {
  const { service, store } = await fresh();
  const result = await service.recordGoalProgress("G-001", "完成模板整理", NOW);
  assert.equal(result.percent, 50);
  const doc = await store.read("MuSSE 个人管理/长期目标/G-001.md");
  assert.match(doc.content, /完成模板整理/);
  assert.match(doc.content, /\| 2026-11-03 \| 50% \|/);
});

test("missing IDs and malformed documents fail loudly", async () => {
  const { store, service } = await fresh();
  await assert.rejects(() => service.completeTask("T-MISSING", NOW), /not found/);
  await assert.rejects(() => service.updateTask("T-MISSING", { title: "x" }), /not found/);

  store.seed("MuSSE 个人管理/任务总表.md", "# 没有表格\n");
  await assert.rejects(() => service.listTasks(), ParseError);

  store.seed(
    DOC_PATHS.tasks,
    "| ID | 名称 |\n|---|---|\n| T-1 | x |\n",
  );
  await assert.rejects(() => service.listTasks(), ParseError);

  store.seed(DOC_PATHS.tasks, "| ID | 名称 | 说明 | 分类 | 优先级 | 状态 | 截止日期 | 截止时间 | 目标ID | 阶段ID | 创建时间 | 完成时间 |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n| T-1 | x |  |  | P2 | todo | 2026-13-99 |  |  |  |  |  |\n");
  await assert.rejects(() => service.listTasks(), ValidationError);
});

test("stale version is rejected instead of overwriting", async () => {
  const { store } = await fresh();
  const doc = await store.read(DOC_PATHS.tasks);
  await store.write(DOC_PATHS.tasks, doc.content + "\n<!-- external edit -->\n");
  await assert.rejects(
    () => store.write(DOC_PATHS.tasks, doc.content, doc.version),
    ConflictError,
  );
});

test("write conflict during a service transition is reported", async () => {
  class RacingStore extends MemoryStore {
    raced = false;
    override async read(path: string) {
      const snapshot = await super.read(path);
      if (!this.raced) {
        this.raced = true;
        await super.write(path, snapshot.content + "\n<!-- concurrent edit -->\n");
      }
      return snapshot;
    }
  }
  const store = new RacingStore();
  const fixture = await loadFixtureStore(fixtures);
  for (const doc of fixture.listSync()) {
    const snap = await fixture.read(doc.path);
    store.seed(doc.path, snap.content);
  }
  const service = new TaskService(store);
  await assert.rejects(() => service.completeTask("T-20261101-A1", NOW), ConflictError);
});

test("iWiki is unavailable without explicit verified configuration", async () => {
  assert.throws(() => createIwikiStoreFromEnv({}), UnavailableError);
  assert.throws(
    () =>
      createIwikiStoreFromEnv({
        MUSSE_ALLOW_UNVERIFIED_IWIKI: "1",
        IWIKI_MCP_URL: "https://example.invalid/mcp",
      }),
    UnavailableError,
  );
  const client = new IwikiMcpClient({ endpoint: "https://example.invalid/mcp" });
  assert.equal(client.configured, false);
  await assert.rejects(
    () => client.callTool("", {}),
    /tool name is not resolved/,
  );
});

test("MCP tool dispatch works on the offline fixture", async () => {
  const { service } = await fresh();
  const tasks = (await callTool(service, "task_query", {})) as Array<{ id: string }>;
  assert.equal(tasks.length, 3);

  const created = (await callTool(service, "task_create", {
    id: "T-20261103-TOOL",
    title: "通过工具创建",
    dueDate: "2026-11-09",
  })) as { id: string; status: string };
  assert.equal(created.status, "todo");

  const beforeDate = shanghaiNow(new Date()).date;
  const note = (await callTool(service, "note_create", { content: "工具笔记" })) as {
    createdAt: string;
  };
  const afterDate = shanghaiNow(new Date()).date;
  assert.ok([beforeDate, afterDate].some((date) => note.createdAt.startsWith(date)));
  const notes = (await callTool(service, "note_query", { limit: 5 })) as Array<{
    content: string;
  }>;
  assert.ok(notes.some((n) => n.content.includes("工具笔记")));
});

test("iWiki adapter requires explicit tool bindings and verifies writes", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let remoteContent = "";
  const fakeClient = {
    async callTool(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === "write_doc") {
        remoteContent = String(args.content ?? "");
        return { structuredContent: { confirmed: true } };
      }
      return { structuredContent: { content: remoteContent, version: "v1" } };
    },
  } as unknown as IwikiMcpClient;

  const store = new IwikiMcpStore(fakeClient, {
    readDocument: "read_doc",
    writeDocument: "write_doc",
    writeEnabled: true,
  });
  const after = await store.write("doc.md", "hello", "v1");
  assert.equal(after.content, "hello");
  assert.equal(calls[0].name, "write_doc");
  assert.equal(calls[1].name, "read_doc");
});

test("remote iWiki writes are disabled by default", async () => {
  const fakeClient = {
    async callTool() {
      throw new Error("must not be called");
    },
  } as unknown as IwikiMcpClient;
  const store = new IwikiMcpStore(fakeClient, {
    readDocument: "read_doc",
    writeDocument: "write_doc",
  });
  await assert.rejects(() => store.write("doc.md", "x"), UnavailableError);
});

test("write tool isError=true is never reported as success", async () => {
  let readCalls = 0;
  const fakeClient = {
    async callTool(name: string) {
      if (name === "read_doc") {
        readCalls++;
        return { structuredContent: { content: "old", version: "v1" } };
      }
      return { isError: true, content: [{ type: "text", text: "permission denied" }] };
    },
  } as unknown as IwikiMcpClient;
  const store = new IwikiMcpStore(fakeClient, {
    readDocument: "read_doc",
    writeDocument: "write_doc",
    writeEnabled: true,
  });
  await assert.rejects(() => store.write("doc.md", "new", "v1"), /IWIKI_TOOL_ERROR|failed/);
  assert.equal(readCalls, 0);  // no read-back, no false success
});

test("write without explicit confirmation is rejected", async () => {
  const fakeClient = {
    async callTool(name: string) {
      if (name === "write_doc") return { structuredContent: { done: true } };
      return { structuredContent: { content: "new", version: "v1" } };
    },
  } as unknown as IwikiMcpClient;
  const store = new IwikiMcpStore(fakeClient, {
    readDocument: "read_doc",
    writeDocument: "write_doc",
    writeEnabled: true,
  });
  await assert.rejects(() => store.write("doc.md", "new", "v1"), /UNCONFIRMED|confirmation/);
});

test("read tool isError=true is surfaced", async () => {
  const fakeClient = {
    async callTool() {
      return { isError: true, content: [{ type: "text", text: "denied" }] };
    },
  } as unknown as IwikiMcpClient;
  const store = new IwikiMcpStore(fakeClient, {
    readDocument: "read_doc",
    writeDocument: "write_doc",
  });
  await assert.rejects(() => store.read("doc.md"), /IWIKI_TOOL_ERROR|failed/);
});

test("task table preserves backslashes and rejects reordered headers", async () => {
  const { store, service } = await fresh();
  const created = await service.createTask(
    {
      id: "T-20261103-PATH",
      title: "路径任务",
      description: "C:\\Users\\Lenovo\\a|b",
      dueDate: "2026-11-09",
    },
    NOW,
  );
  assert.equal(created.id, "T-20261103-PATH");
  const doc = await store.read(DOC_PATHS.tasks);
  const tasks = parseTaskTable(doc.content);
  assert.equal(tasks.find((t) => t.id === "T-20261103-PATH")?.description, "C:\\Users\\Lenovo\\a|b");

  const reordered = doc.content.replace(
    "| ID | 名称 | 说明 | 分类 | 优先级 | 状态 | 截止日期 | 截止时间 | 目标ID | 阶段ID | 创建时间 | 完成时间 |",
    "| 名称 | ID | 说明 | 分类 | 优先级 | 状态 | 截止日期 | 截止时间 | 目标ID | 阶段ID | 创建时间 | 完成时间 |",
  );
  await assert.throws(() => parseTaskTable(reordered), ParseError);
});

test("empty phase task line does not swallow the next field", async () => {
  const goal = parseGoal([
    "# 目标：空阶段",
    "- 目标ID: G-EMPTY",
    "### 阶段 P1：第一阶段",
    "- 阶段ID: P1",
    "- 任务:",
    "- 手动进度: 未开始",
  ].join("\n"));
  assert.deepEqual(goal.phases[0].taskIds, []);
  assert.equal(goal.phases[0].manualProgress, "未开始");
});

test("goal references are validated on create and update", async () => {
  const { service } = await fresh();

  await assert.rejects(
    () => service.createTask({ title: "坏目标", dueDate: "2026-11-09", goalId: "G-MISSING" }, NOW),
    /goal not found/,
  );
  await assert.rejects(
    () => service.createTask({ title: "坏阶段", dueDate: "2026-11-09", goalId: "G-001", phaseId: "P9" }, NOW),
    /phase not found/,
  );
  await assert.rejects(
    () => service.createTask({ title: "无目标阶段", dueDate: "2026-11-09", phaseId: "P1" }, NOW),
    /requires a non-empty goalId/,
  );
  await assert.rejects(
    () => service.createTask({ title: "路径", dueDate: "2026-11-09", goalId: "../G-001" }, NOW),
    /invalid goal ID/,
  );

  await assert.rejects(
    () => service.updateTask("T-20261101-A1", { goalId: "G-001", phaseId: "P9" } as never, NOW),
    /phase not found/,
  );
});

test("goal progress excludes mismatched, duplicate and archived tasks", async () => {
  const goal = parseGoal([
    "# 目标：统计",
    "- 目标ID: G-STAT",
    "### 阶段 P1：一阶段",
    "- 阶段ID: P1",
    "- 任务: T-1, T-1, T-2, T-3, T-4",
    "- 手动进度: 无",
  ].join("\n"));
  const tasks = [
    { id: "T-1", goalId: "G-STAT", phaseId: "P1", status: "done" },
    { id: "T-2", goalId: "G-STAT", phaseId: "P1", status: "todo" },
    { id: "T-3", goalId: "G-OTHER", phaseId: "P1", status: "todo" },
    { id: "T-4", goalId: "G-STAT", phaseId: "P1", status: "archived" },
  ].map((task) => ({
    ...task,
    title: task.id,
    description: "",
    category: "",
    priority: "P2",
    dueDate: "2026-11-09",
    dueTime: "",
    createdAt: "",
    completedAt: task.status === "done" ? "2026-11-03 10:00" : "",
  })) as never;
  const progress = computeGoalProgress(goal, tasks);
  assert.equal(progress.totalTasks, 2);  // T-1 + T-2
  assert.equal(progress.completedTasks, 1);
  assert.equal(progress.percent, 50);
  assert.equal(progress.archivedTasks, 1);
  assert.deepEqual(progress.mismatchedTaskIds, ["T-3"]);
  assert.deepEqual(progress.duplicateTaskIds, ["T-1"]);
});

test("task_update rejects non-editable fields and wrong types", async () => {
  const { service } = await fresh();
  await assert.rejects(
    () => service.updateTask("T-20261101-A1", { status: "done" } as never, NOW),
    /not editable/,
  );
  await assert.rejects(
    () => service.updateTask("T-20261101-A1", { completedAt: "x" } as never, NOW),
    /not editable/,
  );
  await assert.rejects(
    () => service.updateTask("T-20261101-A1", { id: "T-2" } as never, NOW),
    /not editable/,
  );
  await assert.rejects(
    () => service.updateTask("T-20261101-A1", { title: 123 } as never, NOW),
    /must be a string/,
  );
  await assert.rejects(
    () => service.updateTask("T-20261101-A1", { priority: "PX" } as never, NOW),
    /invalid priority/,
  );
});

test("notes escape headings and assign unique same-minute IDs", async () => {
  const { service } = await fresh();
  const first = await service.createNote("第一行\n## 假记录\n正文", NOW);
  const second = await service.createNote("同一分钟", NOW);
  assert.notEqual(first.createdAt, second.createdAt);
  const notes = await service.queryNotes(10);
  assert.ok(notes.some((note) => note.content.includes("## 假记录")));
  assert.equal(notes.length, 3); // fixture note + two new notes
  assert.equal(new Set(notes.map((note) => note.id)).size, notes.length);
});

test("goal progress counts new task-table ownership without editing the goal doc", async () => {
  const { service } = await fresh();
  await service.createTask(
    {
      id: "T-DEMO-002",
      title: "新任务",
      dueDate: "2026-11-09",
      goalId: "G-001",
      phaseId: "P1",
    },
    NOW,
  );
  const result = await service.queryGoal("G-001");
  assert.equal(result.progress.totalTasks, 3);
  assert.equal(result.progress.completedTasks, 1);
  assert.equal(result.progress.percent, 33);
  assert.deepEqual(result.progress.unlistedTaskIds, ["T-DEMO-002"]);
  assert.equal(result.goal.phases[0].taskIds.length, 2); // doc stays human-maintained
});

test("recordGoalProgress rejects a goal document whose ID does not match", async () => {
  const { store, service } = await fresh();
  const wrong = [
    "# 目标：错误文档",
    "- 目标ID: G-001",
    "### 阶段 P1：一阶段",
    "- 阶段ID: P1",
    "- 任务:",
    "- 手动进度: 无",
  ].join("\n");
  store.seed("MuSSE 个人管理/长期目标/G-OTHER.md", wrong);
  await assert.rejects(
    () => service.recordGoalProgress("G-OTHER", "test", NOW),
    /contains ID G-001/,
  );
  assert.equal((await store.read("MuSSE 个人管理/长期目标/G-OTHER.md")).content, wrong);
});

test("progress notes round-trip pipes and normalize newlines", async () => {
  const { service } = await fresh();
  const before = await service.queryGoal("G-001");
  const result = await service.recordGoalProgress("G-001", "A|B\nC", NOW);
  assert.equal(result.note, "A|B C");
  const after = await service.queryGoal("G-001");
  assert.equal(after.goal.history.length, before.goal.history.length + 1);
  assert.equal(after.goal.history.at(-1)?.note, "A|B C");
});

test("progress note cannot inject fake table rows", async () => {
  const { service } = await fresh();
  const before = await service.queryGoal("G-001");
  const injected = "x | 2026-01-01 | 99% | fake";
  await service.recordGoalProgress("G-001", injected, NOW);
  const after = await service.queryGoal("G-001");
  assert.equal(after.goal.history.length, before.goal.history.length + 1);
  assert.equal(after.goal.history.at(-1)?.note, injected);
});
