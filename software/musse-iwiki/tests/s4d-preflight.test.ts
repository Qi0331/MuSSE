import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readonlyDocumentIdsFromFile } from "../src/mcp/document-ids.ts";
import { handleReadonlyRpc } from "../src/mcp/readonly-protocol.ts";
import { DOC_PATHS, goalPath } from "../src/store/wiki-store.ts";
import type { TaskService } from "../src/service/task-service.ts";

test("private local mapping is accepted but invalid or missing files fail closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "musse-s4d-"));
  const file = join(dir, "musse-iwiki-readonly.json");
  try {
    await writeFile(file, JSON.stringify({
      taskDocId: "page-FAKE-TASK",
      notesDocId: "page-FAKE-NOTES",
      goalDocIds: { "G-001": "page-FAKE-GOAL" },
    }));
    assert.deepEqual(await readonlyDocumentIdsFromFile(file), {
      [DOC_PATHS.tasks]: "page-FAKE-TASK",
      [DOC_PATHS.notes]: "page-FAKE-NOTES",
      [goalPath("G-001")]: "page-FAKE-GOAL",
    });
    await writeFile(file, JSON.stringify({ taskDocId: "page-VALID", goalDocIds: { "../escape": "page-NO" } }));
    await assert.rejects(readonlyDocumentIdsFromFile(file), /S4_READONLY_MAPPING_INVALID/);
    await rm(file);
    await assert.rejects(readonlyDocumentIdsFromFile(file), /S4_READONLY_MAPPING_FILE_UNAVAILABLE/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("task and notes arrays use MCP object structuredContent, never bare arrays", async () => {
  const service = {
    listTasks: async () => [{ id: "T-SYNTHETIC" }],
    queryNotes: async () => [{ id: "N-SYNTHETIC" }],
  } as unknown as TaskService;
  for (const [name, expected] of [["task_query", "T-SYNTHETIC"], ["note_query", "N-SYNTHETIC"]] as const) {
    const reply = await handleReadonlyRpc(service, {
      jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: {} },
    });
    const result = reply?.result as { structuredContent: { data: Array<{ id: string }> }; isError?: boolean };
    assert.equal(result.isError, undefined);
    assert.equal(Array.isArray(result.structuredContent), false);
    assert.equal(result.structuredContent.data[0].id, expected);
  }
});
