/**
 * S6 local-only scope pinning, intentionally a distinct explicit command.
 * Reads ONLY tools/list, list_spaces and list_docs. Never changes iWiki or
 * existing bridge config; creates one new private scope file with exclusive wx.
 * No tokens, IDs, titles, body text or upstream errors are printed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConnection } from "./inspect-readonly.mjs";
import { IwikiMcpClient } from "../src/store/iwiki-mcp-client.ts";
import {
  summarizeS6ListShape, summarizeS6SpacesShape, summarizeS6Tool,
  uniqueSpaceId,
} from "./s6-inspect-directory.mjs";
import { validateScope } from "../src/goals/s6-goal-discovery.ts";

export function planS6SpacePin(spacesResponse, docsResponse) {
  const spaces = summarizeS6SpacesShape(spacesResponse);
  if (!spaces.businessOk || spaces.exactMatches !== 1 ||
      spaces.matchesWithIds !== 1) throw Error("S6_SCOPE_UNVERIFIED");
  const spaceId = uniqueSpaceId(spacesResponse);
  if (!spaceId) throw Error("S6_SCOPE_UNVERIFIED");
  const list = summarizeS6ListShape(docsResponse);
  if (!list.businessOk || list.arrayField !== "docs" ||
      list.itemCount !== 0 || !list.totalIsZero ||
      !list.totalEqualsItemCount || !list.cursorAbsent ||
      (!list.hasMoreOmitted && !list.hasMoreExplicitFalse)) {
    throw Error("S6_SCOPE_UNVERIFIED");
  }
  const scope = { mode: "space", spaceId };
  validateScope(scope);
  return scope;
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--pin-local") {
    process.stdout.write("Usage: npm run pin:s6-scope -- --pin-local\n" +
      "Explicitly creates ONLY a new local private S6 scope file; no remote writes.\n");
    return;
  }
  try {
    const configFile = join(homedir(), "MuSSE-MCP-Local", "musse-bridge", "xiaozhi.config.json");
    const privateDir = dirname(configFile);
    const file = join(privateDir, "musse-iwiki-s6-scope.json");
    // Fail before making any requests if an existing scope would be overwritten.
    try {
      await readFile(file, "utf8");
      throw Error("S6_SCOPE_ALREADY_EXISTS");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const connection = extractConnection(JSON.parse(await readFile(configFile, "utf8")));
    const client = new IwikiMcpClient(connection);
    const advertised = await client.listTools();
    if (!summarizeS6Tool(advertised.find((x) => x?.name === "list_spaces"), []).requiredOnlySupported ||
        !summarizeS6Tool(advertised.find((x) => x?.name === "list_docs")).requiredOnlySupported)
      throw Error("S6_TOOL_CONTRACT_UNVERIFIED");
    const spacesResponse = await client.callTool("list_spaces", {});
    const spaceId = uniqueSpaceId(spacesResponse);
    if (!spaceId) throw Error("S6_SPACE_AMBIGUOUS");
    const docsResponse = await client.callTool("list_docs", { space_id: spaceId });
    const scope = planS6SpacePin(spacesResponse, docsResponse);
    await writeFile(file, JSON.stringify(scope, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    process.stdout.write("S6_LOCAL_SCOPE_PINNED: single empty goal knowledge base; iWiki writes=0. " +
      "Existing bridge configuration unchanged.\n");
  } catch {
    process.stderr.write("S6_LOCAL_SCOPE_UNAVAILABLE: no changes to iWiki; check local scope privately.\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
