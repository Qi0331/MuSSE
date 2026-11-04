/**
 * S5-F opt-in probe on an EXISTING synthetic test document.
 * Locates it via read-only list_spaces + list_docs; preflights read_doc marker;
 * makes at most ONE edit_doc call after the user explicitly types EDIT.
 * No new documents, no changes to production S4, no private IDs or raw errors printed.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { OfficialIwikiReadStore } from "../src/store/official-iwiki-read.ts";
import {
  TEST_ORIGINAL, TEST_UPDATED, summarizeEditResponse,
} from "./s5-probe-edit-doc.mjs";

export const EXISTING_TITLE = "MuSSE S5-F 自动隔离测试 8a6fc40f";
const PAGE_ID = /^page-[A-Za-z0-9_-]{1,100}$/;
const SIMPLE_ID = /^[A-Za-z0-9_-]{1,200}$/;

function envelopes(response) {
  if (!response || typeof response !== "object" || response.isError === true) return [];
  const items = [];
  if (response.structuredContent && typeof response.structuredContent === "object") items.push(response.structuredContent);
  if (Array.isArray(response.content)) {
    for (const block of response.content.slice(0, 8)) {
      if (typeof block?.text !== "string") continue;
      try { items.push(JSON.parse(block.text)); } catch { /* never emit raw text */ }
    }
  }
  return items.filter((item) => item && typeof item === "object" && !Array.isArray(item) &&
    item.ok !== false && item.success !== false);
}

function arraysIn(value, keys) {
  if (Array.isArray(value)) return [value];
  if (!value || typeof value !== "object") return [];
  return keys.filter((key) => Array.isArray(value[key])).map((key) => value[key]);
}

function collectionObjects(response, keys) {
  const result = [];
  for (const obj of envelopes(response)) {
    for (const data of [obj, obj.data, obj.result, obj.data?.data]) {
      for (const array of arraysIn(data, keys)) result.push(...array.slice(0, 200));
    }
  }
  return result;
}

export function exactSpaceFromList(response, name) {
  const matches = [];
  for (const item of collectionObjects(response, ["spaces", "items", "list", "results"])) {
    if (!item || typeof item !== "object") continue;
    const itemName = item.name ?? item.space_name ?? item.spaceName;
    const id = item.space_id ?? item.id ?? item.spaceId;
    if (itemName === name && typeof id === "string" && SIMPLE_ID.test(id)) matches.push(id);
  }
  const unique = [...new Set(matches)];
  return unique.length === 1 ? unique[0] : null;
}

export function exactTestDocFromList(response, title = EXISTING_TITLE) {
  const ids = [];
  for (const item of collectionObjects(response, ["docs", "documents", "items", "list", "results"])) {
    if (!item || typeof item !== "object") continue;
    const name = item.title ?? item.name;
    const id = item.doc_id ?? item.page_id ?? item.id ?? item.docId;
    if (name === title && typeof id === "string" && PAGE_ID.test(id)) ids.push(id);
  }
  const unique = [...new Set(ids)];
  return unique.length === 1 ? unique[0] : null;
}

/** Conservative classification only; arbitrary server errors and IDs are never echoed. */
export function safeEditFailureKind(response) {
  let foundFailure = false;
  for (const obj of envelopesForFailure(response)) {
    if (obj.ok !== false && obj.success !== false) continue;
    foundFailure = true;
    const data = obj.data && typeof obj.data === "object" ? obj.data : {};
    const error = data.error;
    const entries = [error, data.code, data.reason,
      error && typeof error === "object" ? error.code : null,
      error && typeof error === "object" ? error.message : null];
    const input = entries.filter((x) => typeof x === "string").join(" ").toLowerCase().slice(0, 4000);
    if (/permission|forbidden|access.?denied|unauthorized|权限|无权|禁止操作|not allowed/.test(input)) return "PERMISSION";
    if (/not.?found|does.?not.?exist|不存在|找不到/.test(input)) return "NOT_FOUND";
    if (/conflict|revision|version|merge|并发|冲突|合并/.test(input)) return "CONFLICT";
    if (/readonly|read.only|只读/.test(input)) return "READ_ONLY";
    if (/unsupported|not supported|markdown|editor.?mode|格式|不支持|编辑器/.test(input)) return "DOCUMENT_TYPE";
    if (/invalid|argument|required|missing|bad request|参数|必填|缺少/.test(input)) return "ARGUMENT";
  }
  return foundFailure ? "OTHER_BUSINESS_ERROR" : "NO_EXPLICIT_BUSINESS_ERROR";
}

function envelopesForFailure(response) {
  if (!response || typeof response !== "object") return [];
  const out = [];
  if (response.structuredContent && typeof response.structuredContent === "object") out.push(response.structuredContent);
  if (Array.isArray(response.content)) {
    for (const item of response.content.slice(0, 8)) {
      if (typeof item?.text !== "string") continue;
      try { out.push(JSON.parse(item.text)); } catch {}
    }
  }
  return out.filter((obj) => obj && typeof obj === "object" && !Array.isArray(obj));
}

export async function findExistingTest(client, spaceName) {
  if (typeof spaceName !== "string" || !spaceName || spaceName.trim() !== spaceName ||
      spaceName.length > 200 || /[\r\n\u0000-\u001f]/.test(spaceName)) {
    throw new Error("S5F_SPACE_INVALID");
  }
  const tools = await client.listTools();
  for (const name of ["list_spaces", "list_docs"]) {
    const t = tools.find((item) => item?.name === name);
    if (!t) return { status: "TOOL_UNAVAILABLE" };
    if (name === "list_spaces" && Array.isArray(t.inputSchema?.required) &&
        t.inputSchema.required.length !== 0) return { status: "TOOL_UNAVAILABLE" };
    if (name === "list_docs" && Array.isArray(t.inputSchema?.required) &&
        t.inputSchema.required.some((key) => key !== "space_id")) {
      return { status: "TOOL_UNAVAILABLE" };
    }
  }
  const spaceId = exactSpaceFromList(await client.callTool("list_spaces", {}), spaceName);
  if (!spaceId) return { status: "SPACE_NOT_CONFIRMED" };
  const docId = exactTestDocFromList(await client.callTool("list_docs", { space_id: spaceId }));
  if (!docId) return { status: "TEST_DOC_NOT_UNIQUELY_FOUND" };
  const store = new OfficialIwikiReadStore(client, { s5f_existing_test: docId });
  const snapshot = await store.read("s5f_existing_test");
  if (snapshot.content.trim() !== TEST_ORIGINAL) return { status: "INITIAL_MARKER_MISMATCH" };
  return { status: "READY", docId, store };
}

export async function editExistingTestOnce(client, found) {
  if (found?.status !== "READY" || !PAGE_ID.test(found.docId) || !found.store) {
    throw new Error("S5F_NOT_PREFLIGHTED");
  }
  let response;
  let callFailed = false;
  try { response = await client.callTool("edit_doc", { doc_id: found.docId, content: TEST_UPDATED }); }
  catch { callFailed = true; }
  let readback = "FAILED";
  try {
    const after = await found.store.read("s5f_existing_test");
    readback = after.content.trim() === TEST_UPDATED ? "UPDATED" :
      after.content.trim() === TEST_ORIGINAL ? "UNCHANGED" : "DIFFERENT";
  } catch { /* no raw error */ }
  const responseShape = summarizeEditResponse(response);
  const confirmed = responseShape.mcpError === false &&
    responseShape.envelopes.some((item) => item.ok === true || item.success === true);
  return {
    editAttempted: true,
    editCallFailed: callFailed,
    responseShape,
    errorKind: safeEditFailureKind(response),
    readback,
    outcome: confirmed && !callFailed && readback === "UPDATED"
      ? "EXISTING_EDIT_VERIFIED" : "EXISTING_EDIT_UNCONFIRMED",
  };
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--edit-once") {
    process.stdout.write("Usage: node tools/s5-probe-existing-edit.mjs --edit-once\nFinds ONE existing synthetic test page, then requires a second local EDIT confirmation before ONE edit_doc; never creates documents.\n");
    return;
  }
  try {
    if (!process.stdin.isTTY) throw Error("S5F_TTY_REQUIRED");
    const configPath = join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
    const connection = extractConnection(JSON.parse(await readFile(configPath, "utf8")));
    const client = new IwikiMcpClient(connection);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const spaceName = (await rl.question("输入测试页所属的私人空间精确名称（仅本机）：")).trim();
      const found = await findExistingTest(client, spaceName);
      if (found.status !== "READY") {
        process.stdout.write(JSON.stringify({ status: found.status, editAttempted: false }) + "\n");
        return;
      }
      const answer = (await rl.question(`已只读确认现有测试文档「${EXISTING_TITLE}」内容未修改。输入 EDIT 仅编辑这篇文档一次，其他输入取消：`)).trim();
      if (answer !== "EDIT") {
        process.stdout.write("S5F_CANCELLED: no write attempted.\n");
        return;
      }
      const result = await editExistingTestOnce(client, found);
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } finally { rl.close(); }
  } catch {
    process.stderr.write("S5F existing-page probe failed or unavailable. No automatic retries; do not paste raw logs or configuration.\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
