import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeS6ListShape,
  summarizeS6SpacesShape,
  summarizeS6Tool,
} from "../tools/s6-inspect-directory.mjs";

const envelope = (data) => ({
  content: [{ type: "text", text: JSON.stringify({ ok: true, data }) }],
});

test("S6 read-only bootstrap detects a named knowledge space without exposing IDs", () => {
  const result = summarizeS6SpacesShape(envelope({
    spaces: [
      { name: "小七个人管理", space_id: "private-parent" },
      { name: "长期目标", space_id: "private-goal-space" },
    ],
  }));
  assert.deepEqual(result, {
    businessOk: true,
    arrayField: "spaces",
    itemCount: 2,
    exactMatches: 1,
    matchesWithIds: 1,
  });
  assert.equal(JSON.stringify(result).includes("private-goal-space"), false);
});

test("S6 diagnostic reports ambiguous named spaces, never selects one in its summary", () => {
  const result = summarizeS6SpacesShape(envelope({
    spaces: [
      { title: "长期目标", id: "private-a" },
      { title: "长期目标", id: "private-b" },
    ],
  }));
  assert.equal(result.exactMatches, 2);
  assert.equal(result.matchesWithIds, 2);
  assert.equal(JSON.stringify(result).includes("private-a"), false);
});

test("S6 list shape considers an omitted next_cursor absent but never infers completeness", () => {
  const result = summarizeS6ListShape(envelope({
    docs: [{ doc_id: "page-private", title: "Hidden", parent_id: "folder-private", space_id: "space-private", page_type: "markdown" }],
    total: 1,
    has_more: false,
  }));
  assert.equal(result.businessOk, true);
  assert.equal(result.cursorAbsent, true);
  assert.equal(result.hasMoreExplicitFalse, true);
  assert.equal(result.sampleFields.parentId, true);
  assert.equal(JSON.stringify(result).includes("folder-private"), false);
});

test("S6 diagnostic never fabricates success for unsuccessful upstream envelopes", () => {
  assert.equal(summarizeS6SpacesShape(envelope({})).exactMatches, 0);
  assert.equal(summarizeS6SpacesShape({ content: [{ text: '{"ok":false}' }] }).businessOk, false);
  assert.equal(summarizeS6ListShape({ isError: true }).businessOk, false);
});


test("S6 inspector treats omitted JSON Schema required as an empty required list", () => {
  const info = summarizeS6Tool({
    name: "list_spaces",
    inputSchema: { type: "object", properties: { space_type: { type: "string" } } },
  }, []);
  assert.equal(info.present, true);
  assert.equal(info.requiredKnown, true);
  assert.equal(info.requiredOnlySupported, true);
  assert.equal(info.requiredDefaultedEmpty, true);
});

test("S6 inspector still rejects absent or malformed tool schema", () => {
  assert.equal(summarizeS6Tool({ name: "list_spaces" }, []).requiredOnlySupported, false);
  assert.equal(summarizeS6Tool({ inputSchema: { required: "space_id" } }, []).requiredOnlySupported, false);
  assert.equal(summarizeS6Tool({ inputSchema: { required: ["space_id"] } }, []).requiredOnlySupported, false);
  assert.equal(summarizeS6Tool(null, []).present, false);
});
