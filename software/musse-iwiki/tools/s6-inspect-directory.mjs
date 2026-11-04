/**
 * S6 one-shot READ-ONLY inspection. Never prints tokens, IDs, names,
 * full MCP endpoint, documents, content or raw upstream responses.
 * Does not call create_markdown_doc, edit_doc or any other write tool.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import { validateScope } from "../src/goals/s6-goal-discovery.ts";

const obj = (v) => v && typeof v === "object" && !Array.isArray(v);
export function summarizeS6ListShape(response) {
  if (!obj(response) || response.isError === true) return { businessOk: false };
  const candidates = [];
  if (obj(response.structuredContent)) candidates.push(response.structuredContent);
  if (Array.isArray(response.content)) for (const v of response.content) {
    if (typeof v?.text !== "string") continue;
    try { const parsed = JSON.parse(v.text); if (obj(parsed)) candidates.push(parsed); }
    catch { /* no raw output */ }
  }
  const value = candidates.find((x) => x.ok === true && obj(x.data));
  if (!value) return { businessOk: false };
  const data = value.data;
  const arrayField = ["docs", "documents", "items", "list", "results"]
    .find((k) => Array.isArray(data[k])) ?? null;
  const items = arrayField === null ? [] : data[arrayField];
  const sample = items.find(obj);
  return {
    businessOk: true,
    arrayField,
    itemCount: items.length,
    totalPresent: Number.isSafeInteger(data.total),
    hasMoreExplicitFalse: data.has_more === false,
    cursorAbsent: data.next_cursor == null || data.next_cursor === "",
    sampleFields: {
      docId: Boolean(sample && typeof sample.doc_id === "string"),
      title: Boolean(sample && typeof sample.title === "string"),
      parentId: Boolean(sample && typeof sample.parent_id === "string"),
      spaceId: Boolean(sample && typeof sample.space_id === "string"),
      kind: Boolean(sample && (typeof sample.page_type === "string" || typeof sample.kind === "string")),
    },
  };
}


/**
 * Discover a candidate by exact space name, without returning its private ID
 * in the user-visible diagnostic. This is a READ-ONLY shape hint, not proof
 * of the destination's parent/child or write contract.
 */
export function summarizeS6SpacesShape(response, target = "长期目标") {
  if (!obj(response) || response.isError === true)
    return { businessOk: false, arrayField: null, itemCount: 0, exactMatches: 0, matchesWithIds: 0 };
  const candidates = [];
  if (obj(response.structuredContent)) candidates.push(response.structuredContent);
  if (Array.isArray(response.content)) for (const entry of response.content) {
    if (typeof entry?.text !== "string") continue;
    try { const parsed = JSON.parse(entry.text); if (obj(parsed)) candidates.push(parsed); }
    catch { /* never display source text */ }
  }
  const value = candidates.find((x) => x.ok === true && obj(x.data));
  if (!value) return { businessOk: false, arrayField: null, itemCount: 0, exactMatches: 0, matchesWithIds: 0 };
  const data = value.data;
  const arrayField = ["spaces", "items", "list", "results"]
    .find((key) => Array.isArray(data[key])) ?? null;
  const items = arrayField === null ? [] : data[arrayField];
  const matches = items.filter((item) => obj(item) &&
    [item.name, item.title, item.space_name].some((name) => name === target));
  const ids = matches
    .map((item) => item.space_id ?? item.id)
    .filter((id) => typeof id === "string" && id.length > 0 && id.length <= 256);
  return {
    businessOk: true, arrayField, itemCount: items.length,
    exactMatches: matches.length, matchesWithIds: ids.length,
  };
}

function uniqueSpaceId(response, target = "长期目标") {
  if (!obj(response) || response.isError === true) return null;
  const candidates = [];
  if (obj(response.structuredContent)) candidates.push(response.structuredContent);
  if (Array.isArray(response.content)) for (const entry of response.content) {
    if (typeof entry?.text !== "string") continue;
    try { const parsed = JSON.parse(entry.text); if (obj(parsed)) candidates.push(parsed); }
    catch { /* no raw output */ }
  }
  const value = candidates.find((x) => x.ok === true && obj(x.data));
  if (!value) return null;
  const data = value.data;
  const arrayField = ["spaces", "items", "list", "results"]
    .find((key) => Array.isArray(data[key]));
  if (!arrayField) return null;
  const matches = data[arrayField].filter((item) => obj(item) &&
    [item.name, item.title, item.space_name].some((name) => name === target));
  if (matches.length !== 1) return null;
  const id = matches[0].space_id ?? matches[0].id;
  return typeof id === "string" && id.length > 0 && id.length <= 256 ? id : null;
}

async function main(args) {
  if (args.length !== 1 || args[0] !== "--read-only") {
    process.stdout.write("Usage: npm run inspect:s6-dir -- --read-only\nRead tools/list and list_docs shape only. No writes, no private details printed.\n");
    return;
  }
  try {
    const configPath = join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
    const dir = dirname(configPath);
    const scopeFile = process.env.MUSSE_S6_SCOPE_FILE ?? join(dir, "musse-iwiki-s6-scope.json");
    // Existing scope is optional for this diagnostic. Never create/edit a config.
    let scope = null;
    try {
      scope = JSON.parse(await readFile(scopeFile, "utf8"));
      validateScope(scope);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const connection = extractConnection(JSON.parse(await readFile(configPath, "utf8")));
    const client = new IwikiMcpClient(connection);
    const advertised = await client.listTools();
    const summarize = (name, allowed = ["space_id"]) => {
      const tool = advertised.find((x) => x?.name === name);
      const required = Array.isArray(tool?.inputSchema?.required) ? tool.inputSchema.required : null;
      return { present: Boolean(tool), requiredKnown: required !== null,
        requiredOnlySupported: required !== null && required.every((s) => allowed.includes(s)) };
    };
    const report = {
      listSpaces: summarize("list_spaces", []),
      listDocs: summarize("list_docs"),
      listDocTree: summarize("list_doc_tree"),
    };
    let chosenSpaceId = scope?.spaceId ?? null;
    let spacesShape = null;
    if (report.listSpaces.present && report.listSpaces.requiredOnlySupported) {
      const spaces = await client.callTool("list_spaces", {});
      spacesShape = summarizeS6SpacesShape(spaces);
      // A name match is only a candidate for read-only inspection.
      if (!chosenSpaceId) chosenSpaceId = uniqueSpaceId(spaces);
    }
    let listShape = null;
    if (chosenSpaceId && report.listDocs.present && report.listDocs.requiredOnlySupported) {
      const response = await client.callTool("list_docs", { space_id: chosenSpaceId });
      listShape = summarizeS6ListShape(response);
    }
    process.stdout.write(JSON.stringify({
      inspection: "S6_READ_ONLY_SHAPE",
      privateScopePresent: Boolean(scope),
      candidateSpaceResolved: Boolean(chosenSpaceId),
      ...report, spacesShape, listShape, writesAttempted: 0,
    }, null, 2) + "\n");
  } catch {
    process.stderr.write("S6_READ_ONLY_INSPECTION_UNAVAILABLE: verify private scope locally; do not paste raw errors.\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
