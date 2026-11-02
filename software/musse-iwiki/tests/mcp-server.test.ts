import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "src", "mcp", "server.ts");
const fixtures = join(here, "..", "fixtures");

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

function startServer(env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Map<number, Pending>();
  let nextId = 1;
  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    let message: { id?: number; result?: unknown; error?: unknown };
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof message.id === "number") {
      const entry = pending.get(message.id);
      if (entry) {
        pending.delete(message.id);
        entry.resolve(message);
      }
    }
  });
  child.stderr.resume();

  function request(method: string, params?: unknown): Promise<unknown> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  return { child, request, stop: () => child.kill() };
}

test("MCP stdio server exposes tools and serves fixture data", async () => {
  const server = startServer({
    MUSSE_IWIKI_STORE: "fixture",
    MUSSE_FIXTURE_DIR: fixtures,
  });
  try {
    const init = (await server.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    })) as { result: { protocolVersion: string } };
    assert.equal(init.result.protocolVersion, "2025-06-18");

    const list = (await server.request("tools/list", {})) as {
      result: { tools: Array<{ name: string }> };
    };
    assert.ok(list.result.tools.some((tool) => tool.name === "task_query"));
    assert.ok(list.result.tools.some((tool) => tool.name === "schedule_overdue"));

    const call = (await server.request("tools/call", {
      name: "task_query",
      arguments: {},
    })) as { result: { structuredContent: Array<{ id: string }> } };
    assert.equal(call.result.structuredContent.length, 3);

    const overdue = (await server.request("tools/call", {
      name: "schedule_overdue",
      arguments: {},
    })) as { result: { structuredContent: Array<{ id: string }> } };
    assert.deepEqual(
      overdue.result.structuredContent.map((task) => task.id),
      ["T-20261101-A1"],
    );
  } finally {
    server.stop();
  }
});

test("MCP stdio server reports iWiki as unavailable without credentials", async () => {
  const server = startServer({ MUSSE_IWIKI_STORE: "" });
  try {
    await server.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    const call = (await server.request("tools/call", {
      name: "task_query",
      arguments: {},
    })) as { result: { isError?: boolean; structuredContent: { code: string } } };
    assert.equal(call.result.isError, true);
    assert.equal(call.result.structuredContent.code, "UNAVAILABLE");
  } finally {
    server.stop();
  }
});
