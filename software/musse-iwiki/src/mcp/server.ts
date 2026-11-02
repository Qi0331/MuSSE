import { createInterface } from "node:readline";

import { TOOL_DEFINITIONS, callTool } from "./tools.ts";
import { TaskService, unavailableStore } from "../service/task-service.ts";
import { loadFixtureStore } from "../store/local-store.ts";
import { createIwikiStoreFromEnv } from "../store/iwiki-store.ts";
import type { WikiStore } from "../store/wiki-store.ts";
import { MusseError } from "../types.ts";

/**
 * Minimal MCP stdio server. No dependencies.
 *
 * Persistence is iWiki only; MUSSE_IWIKI_STORE=fixture exists solely for
 * offline verification and is never a production fallback.
 */
async function buildStore(env: NodeJS.ProcessEnv): Promise<WikiStore> {
  if (env.MUSSE_IWIKI_STORE === "fixture") {
    if (!env.MUSSE_FIXTURE_DIR) {
      throw new MusseError("CONFIG_ERROR", "MUSSE_FIXTURE_DIR is required for fixture mode");
    }
    return loadFixtureStore(env.MUSSE_FIXTURE_DIR);
  }
  try {
    return createIwikiStoreFromEnv(env);
  } catch {
    return unavailableStore();
  }
}

function reply(id: unknown, result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function replyError(id: unknown, error: unknown): void {
  const code = error instanceof MusseError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify({ code, message }) }],
        structuredContent: { ok: false, code, message },
        isError: true,
      },
    })}\n`,
  );
}

async function main(): Promise<void> {
  const store = await buildStore(process.env);
  const service = new TaskService(store);
  process.stderr.write(`[musse-iwiki] MCP server ready (store=${store.constructor.name})\n`);

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim() === "") continue;
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line) as Record<string, unknown>;
    } catch {
      process.stderr.write("[musse-iwiki] invalid JSON on stdin\n");
      continue;
    }
    const id = message.id;
    const method = message.method;
    if (id === undefined) continue; // notification

    try {
      if (method === "initialize") {
        reply(id, {
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "musse-iwiki", version: "0.1.0" },
        });
      } else if (method === "ping") {
        reply(id, {});
      } else if (method === "tools/list") {
        reply(id, { tools: TOOL_DEFINITIONS });
      } else if (method === "tools/call") {
        const params = (message.params ?? {}) as Record<string, unknown>;
        const name = String(params.name ?? "");
        const args = (params.arguments ?? {}) as Record<string, unknown>;
        try {
          const value = await callTool(service, name, args);
          reply(id, {
            content: [{ type: "text", text: JSON.stringify(value) }],
            structuredContent: value,
          });
        } catch (error) {
          replyError(id, error);
        }
      } else {
        process.stdout.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `method not found: ${String(method)}` },
          })}\n`,
        );
      }
    } catch (error) {
      replyError(id, error);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`[musse-iwiki] fatal: ${String(error)}\n`);
  process.exitCode = 1;
});
