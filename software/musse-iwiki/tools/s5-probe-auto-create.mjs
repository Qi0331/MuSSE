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

export async function probeS5CreateAndEdit(client, label = `MuSSE S5-F 自动隔离测试 ${randomUUID().slice(0, 8)}`) {
  if (typeof label !== "string" || !/^MuSSE S5-F 自动隔离测试 [0-9a-f]{8}$/.test(label)) {
    throw new Error("S5F_INVALID_TEST_LABEL");
  }
  // Only documented required parameters; no existing real document ID is used.
  let creation;
  let createCallFailed = false;
  try {
    creation = await client.callTool("create_markdown_doc", {
      title: label,
      content: TEST_ORIGINAL,
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
    process.stdout.write("Usage: node tools/s5-probe-auto-create.mjs --create-and-write-test\nExplicitly creates ONE isolated Markdown test page and edits it once. Does not retry.\n");
    return;
  }
  try {
    const configFile = join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
    const config = JSON.parse(await readFile(configFile, "utf8"));
    const connection = extractConnection(config);
    const result = await probeS5CreateAndEdit(new IwikiMcpClient(connection));
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch {
    process.stderr.write("S5F automatic test unavailable. Do not re-run after an uncertain result; inspect the test page locally.\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
