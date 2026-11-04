/**
 * S5-F read-only metadata inspection for create_markdown_doc.
 * Never calls tools/call, reads any documents or prints credentials.
 * Only prints tool descriptions (public API metadata), not account data.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";

const FIELDS = ["title", "content", "space_id", "space_name", "parent_id"];
const safeText = (value) => {
  if (typeof value !== "string") return null;
  return value
    .replace(/https?:\/\/[^\s)]+/gi, "[url]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/page-[A-Za-z0-9_-]+/g, "[page-id]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 350);
};

export function summarizeCreateMetadata(tools) {
  if (!Array.isArray(tools)) throw new Error("S5F_INVALID_TOOLS");
  const t = tools.find((x) => x?.name === "create_markdown_doc");
  if (!t) return { present: false };
  const schema = t.inputSchema && typeof t.inputSchema === "object" ? t.inputSchema : {};
  const props = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
    ? schema.properties : {};
  return {
    present: true,
    description: safeText(t.description),
    fields: FIELDS.map((name) => {
      const p = props[name];
      return {
        name,
        advertised: !!p,
        required: Array.isArray(schema.required) && schema.required.includes(name),
        type: ["string", "integer", "number", "boolean", "object", "array"].includes(p?.type) ? p.type : null,
        description: safeText(p?.description),
      };
    }),
    warning: "Tool metadata only; no write permission or runtime business-rule verification.",
  };
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--live") {
    process.stdout.write("Usage: node tools/s5-inspect-create-metadata.mjs --live\nRead-only MCP initialize/tools/list. No tools/call.\n");
    return;
  }
  try {
    const configPath = join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
    const connection = extractConnection(JSON.parse(await readFile(configPath, "utf8")));
    const client = new IwikiMcpClient(connection);
    const report = summarizeCreateMetadata(await client.listTools());
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } catch {
    process.stderr.write("S5F metadata inspection failed; no details printed. No write attempted.\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
