/**
 * S5-F read-only official tools/list inspection after a successful create and failed edit_doc.
 * No tools/call, no account document IDs, token or private config printed.
 * Provides update contract, Markdown support restrictions and existing-page lookup contracts.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";

const TARGET_TOOLS = [
  "edit_doc", "append_to_doc", "list_docs", "search_kb", "list_doc_tree",
];
const SAFE_FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

function safeDescription(value) {
  if (typeof value !== "string") return null;
  return value
    .replace(/https?:\/\/[^\s)]+/gi, "[url]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/page-[A-Za-z0-9_-]+/g, "[page-id]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 1200);
}

export function summarizeS5EditMetadata(tools) {
  if (!Array.isArray(tools)) throw new Error("S5F_TOOLS_INVALID");
  return {
    inspection: "S5-F edit and document discovery schema only, no tools/call",
    tools: TARGET_TOOLS.map((name) => {
      const t = tools.find((item) => item?.name === name);
      if (!t) return { name, present: false };
      const schema = t.inputSchema && typeof t.inputSchema === "object" ? t.inputSchema : {};
      const props = schema.properties && typeof schema.properties === "object" &&
        !Array.isArray(schema.properties) ? schema.properties : {};
      const required = Array.isArray(schema.required) ? schema.required : [];
      return {
        name,
        present: true,
        description: safeDescription(t.description),
        fields: Object.keys(props)
          .filter((key) => SAFE_FIELD.test(key)).slice(0, 32)
          .map((key) => ({
            name: key,
            required: required.includes(key),
            type: ["string", "integer", "number", "boolean", "object", "array"].includes(props[key]?.type)
              ? props[key].type : null,
            description: safeDescription(props[key]?.description),
          })),
      };
    }),
    note: "Official metadata only. Does not prove edit permission, response semantics or document compatibility.",
  };
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--live") {
    process.stdout.write("Usage: node tools/s5-inspect-edit-metadata.mjs --live\nRead-only initialize/tools/list, no tools/call and no write.\n");
    return;
  }
  try {
    const configPath = join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
    const connection = extractConnection(JSON.parse(await readFile(configPath, "utf8")));
    const client = new IwikiMcpClient(connection);
    const report = summarizeS5EditMetadata(await client.listTools());
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } catch {
    process.stderr.write("S5-F edit metadata inspection failed; no private details printed; no writes attempted.\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
