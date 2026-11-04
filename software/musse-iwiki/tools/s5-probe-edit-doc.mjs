/**
 * S5-F one-document isolated probe. DO NOT run without explicit approval.
 * No arguments: inert. --write-test: one edit_doc call on the user-created,
 * specifically marked test page only. Never retry; never print private data.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { OfficialIwikiReadStore } from "../src/store/official-iwiki-read.ts";

export const TEST_ORIGINAL = "MUSSE_S5F_ORIGINAL";
export const TEST_UPDATED = "MUSSE_S5F_UPDATED";
const PAGE_ID = /^page-[A-Za-z0-9_-]{1,100}$/;
const FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

function fields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).filter((key) => FIELD.test(key)).slice(0, 32);
}

/** No content, title, id, exception message or arbitrary server values are returned. */
export function summarizeEditResponse(result) {
  if (!result || typeof result !== "object") {
    return { mcpError: null, envelopes: [] };
  }
  const envelopes = [];
  function append(value, source) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    envelopes.push({
      source,
      fields: fields(value),
      dataFields: fields(value.data),
      ok: value.ok === true ? true : value.ok === false ? false : null,
      success: value.success === true ? true : value.success === false ? false : null,
    });
  }
  append(result.structuredContent, "structuredContent");
  if (Array.isArray(result.content)) {
    for (const block of result.content.slice(0, 8)) {
      if (block && typeof block.text === "string") {
        try { append(JSON.parse(block.text), "textJson"); } catch { /* no raw output */ }
      }
    }
  }
  return { mcpError: result.isError === true, envelopes };
}

/**
 * Must only target an explicitly created throwaway page whose body is exactly
 * TEST_ORIGINAL. A second run after a successful update fails before writing.
 */
export async function probeS5EditDoc(client, docId) {
  if (typeof docId !== "string" || !PAGE_ID.test(docId)) throw new Error("S5F_TEST_PAGE_INVALID");
  const store = new OfficialIwikiReadStore(client, { s5f_isolated_test: docId });
  const before = await store.read("s5f_isolated_test");
  if (before.content.trim() !== TEST_ORIGINAL) throw new Error("S5F_TEST_PAGE_NOT_INITIAL");
  let response;
  let callFailed = false;
  try {
    response = await client.callTool("edit_doc", { doc_id: docId, content: TEST_UPDATED });
  } catch {
    callFailed = true;
  }
  // A timeout/error may still have changed the page; inspect once, never retry.
  let readback = "FAILED";
  try {
    const after = await store.read("s5f_isolated_test");
    readback = after.content.trim() === TEST_UPDATED ? "UPDATED" :
      after.content.trim() === TEST_ORIGINAL ? "UNCHANGED" : "DIFFERENT";
  } catch { /* no raw errors and no retry */ }
  return {
    writeAttempted: true,
    editCallFailed: callFailed,
    responseShape: summarizeEditResponse(response),
    readback,
    note: "One edit_doc attempt only. Verify acknowledgement semantics before production use.",
  };
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--write-test") {
    process.stdout.write("Usage: node tools/s5-probe-edit-doc.mjs --write-test\\nOne real edit_doc on an isolated user-created marker page; requires explicit approval first.\\n");
    return;
  }
  try {
    const file = join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
    const config = JSON.parse(await readFile(file, "utf8"));
    const connection = extractConnection(config);
    const docId = process.env.MUSSE_S5_TEST_DOC_ID;
    const result = await probeS5EditDoc(new IwikiMcpClient(connection), docId);
    process.stdout.write(JSON.stringify(result, null, 2) + "\\n");
  } catch {
    // probeS5EditDoc throws only before issuing a write; post-write failures
    // are summarized separately and never reported as confirmed success.
    process.stderr.write("S5F preflight failed; edit_doc not called. Do not paste private config or raw logs.\\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
