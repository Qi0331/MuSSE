/**
 * S5-F isolated write capability probe:
 * create ONE fresh test Markdown doc, read it, edit it ONCE, read it back.
 * Never guess a page ID or retry an ambiguous creation/write.
 * No arguments: inert. Private config and Token remain on the user's machine.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { TEST_ORIGINAL, probeS5EditDoc, summarizeEditResponse } from "./s5-probe-edit-doc.mjs";

const PAGE_ID = /^page-[A-Za-z0-9_-]{1,100}$/;

function responseObjects(response) {
  if (!response || typeof response !== "object" || response.isError === true) return [];
  const objects = [];
  if (response.structuredContent && typeof response.structuredContent === "object") {
    objects.push(response.structuredContent);
  }
  if (Array.isArray(response.content)) {
    for (const item of response.content.slice(0, 8)) {
      if (item && typeof item.text === "string") {
        try { objects.push(JSON.parse(item.text)); } catch { /* Ignore non-JSON output. */ }
      }
    }
  }
  return objects;
}

/**
 * Read-only space discovery. A visible space is NOT proof of write permission.
 * Accept known iWiki MCP list shapes, no raw response/body/IDs are printed.
 */
export function extractListedSpaceNames(response) {
  if (response?.isError === true) return [];
  const names = new Set();
  const envelopes = responseObjects(response);
  for (const envelope of envelopes) {
    if (!envelope || typeof envelope !== "object" || envelope.ok === false || envelope.success === false) continue;
    const payloads = [envelope, envelope.data, envelope.result, envelope.data?.data];
    for (const payload of payloads) {
      if (!payload || typeof payload !== "object") continue;
      const arrays = Array.isArray(payload) ? [payload] :
        [payload.spaces, payload.items, payload.list, payload.results].filter(Array.isArray);
      for (const arr of arrays) {
        for (const entry of arr.slice(0, 100)) {
          const name = entry?.name ?? entry?.space_name ?? entry?.spaceName;
          if (typeof name !== "string" || name !== name.trim() || name.length < 1 ||
            name.length > 200 || /[\r\n\u0000-\u001f]/.test(name)) continue;
          names.add(name);
        }
      }
    }
  }
  return [...names].slice(0, 100);
}

export async function listAvailableSpaceNames(client) {
  const advertised = await client.listTools();
  const listTool = advertised.find((t) => t?.name === "list_spaces");
  if (!listTool) return [];
  // Do not invent mandatory parameters: fail closed, with no tools/call.
  if (Array.isArray(listTool.inputSchema?.required) && listTool.inputSchema.required.length) return [];
  return extractListedSpaceNames(await client.callTool("list_spaces", {}));
}

/** Only accept exactly one page-... ID attached to an explicit success envelope. */
export function extractConfirmedCreatedPageId(response) {
  const ids = new Set();
  for (const item of responseObjects(response)) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
      (item.ok !== true && item.success !== true)) continue;
    for (const body of [item.data, item]) {
      if (!body || typeof body !== "object" || Array.isArray(body)) continue;
      for (const key of ["doc_id", "page_id", "id", "docId", "pageId"]) {
        if (typeof body[key] === "string" && PAGE_ID.test(body[key])) ids.add(body[key]);
      }
    }
  }
  return ids.size === 1 ? [...ids][0] : null;
}

export async function probeS5CreateAndEdit(client, spaceName, label = `MuSSE S5-F 自动隔离测试 ${randomUUID().slice(0, 8)}`) {
  if (typeof spaceName !== "string" || spaceName.trim() !== spaceName || !spaceName || spaceName.length > 200 || /[\r\n\u0000-\u001f]/.test(spaceName)) {
    throw new Error("S5F_SPACE_NAME_REQUIRED");
  }
  if (typeof label !== "string" || !/^MuSSE S5-F 自动隔离测试 [0-9a-f]{8}$/.test(label)) {
    throw new Error("S5F_INVALID_TEST_LABEL");
  }
  // The real official tools/list requires space_id OR space_name despite optional schema flags.
  // The user selects the exact space locally; never guess it or use a private existing page ID.
  let creation;
  let createCallFailed = false;
  try {
    creation = await client.callTool("create_markdown_doc", {
      title: label,
      content: TEST_ORIGINAL,
      space_name: spaceName,
    });
  } catch {
    createCallFailed = true;
  }
  const createResponseShape = summarizeEditResponse(creation);
  const docId = extractConfirmedCreatedPageId(creation);
  const base = {
    testTitle: label, // purely synthetic, useful to locate an uncertain creation manually
    createAttempted: true,
    createCallFailed,
    createResponseShape,
  };
  if (!docId) {
    return { ...base, editAttempted: false, outcome: "CREATE_UNCONFIRMED" };
  }

  try {
    const edit = await probeS5EditDoc(client, docId); // strict read-before marker + one edit + readback
    return {
      ...base,
      editAttempted: edit.writeAttempted,
      editCallFailed: edit.editCallFailed,
      editResponseShape: edit.responseShape,
      readback: edit.readback,
      outcome: edit.readback === "UPDATED" && edit.editCallFailed === false &&
        edit.responseShape.envelopes.some((e) => e.ok === true || e.success === true)
        ? "CREATE_AND_EDIT_VERIFIED" : "EDIT_UNCONFIRMED",
    };
  } catch {
    // A new document might already exist, but its content/shape was not verified.
    // Do not issue edit_doc, and never call create_markdown_doc a second time.
    return { ...base, editAttempted: false, outcome: "CREATED_BUT_PRECHECK_FAILED" };
  }
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--create-and-write-test") {
    process.stdout.write("Usage: node tools/s5-probe-auto-create.mjs --create-and-write-test\nLists spaces read-only, lets the user choose a private space by number, then creates ONE isolated page and edits it once. Does not retry.\n");
    return;
  }
  try {
    if (!process.stdin.isTTY) throw new Error("S5F_INTERACTIVE_TERMINAL_REQUIRED");
    const configFile = join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
    const config = JSON.parse(await readFile(configFile, "utf8"));
    const connection = extractConnection(config);
    const client = new IwikiMcpClient(connection);
    // Read-only list_spaces first; no write if the service response is unrecognized.
    const spaces = await listAvailableSpaceNames(client);
    if (!spaces.length) {
      process.stdout.write("S5F_SPACE_LIST_UNAVAILABLE: list_spaces returned no recognizable spaces. No write attempted.\n");
      return;
    }
    process.stdout.write("iWiki 当前账号可见的空间（仅显示在本机；可见不代表可写）：\n");
    spaces.forEach((name, i) => process.stdout.write(`${i + 1}. ${name}\n`));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let selected = null;
    try {
      const answer = (await rl.question("输入你自己的私人测试空间编号，0 取消（输入非 0 编号将执行一次真实写入）：")).trim();
      if (answer === "0" || !/^[1-9][0-9]{0,2}$/.test(answer)) {
        process.stdout.write("S5F_CANCELLED: no write attempted.\n");
        return;
      }
      const index = Number(answer) - 1;
      if (index < 0 || index >= spaces.length) {
        process.stdout.write("S5F_SELECTION_INVALID: no write attempted.\n");
        return;
      }
      selected = spaces[index];
    } finally { rl.close(); }
    const result = await probeS5CreateAndEdit(client, selected);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch {
    process.stderr.write("S5F automatic test unavailable. Do not re-run after an uncertain result; inspect the test page locally.\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
