import type { IwikiMcpClient } from "../store/iwiki-mcp-client.ts";
import { OfficialIwikiReadStore } from "../store/official-iwiki-read.ts";
import { DOC_PATHS } from "../store/wiki-store.ts";
import type { S5AtomicPort, S5Document } from "./guarded-write.ts";
import { S5GateError } from "./guarded-write.ts";

/**
 * S5-E pragmatic adapter: read_doc + an explicitly verified document-update tool.
 * NOT a production entrypoint. No default tool name, no auto-enablement,
 * no Windows config changes and no access to documents without explicit mapping.
 *
 * The remote web editor might change a document between our final read and write.
 * This adapter cannot close that race unless the provider exposes atomic updates.
 */
export interface IwikiBestEffortContract {
  toolName: string;
  documentIdArgument: string;
  contentArgument: string;
}

const PAGE_ID = /^page-[A-Za-z0-9_-]{1,100}$/;
const FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const TOOL = /^[a-z][a-z0-9_]{0,63}$/;

function assertContract(contract: IwikiBestEffortContract): void {
  if (!contract || !TOOL.test(contract.toolName) ||
      !FIELD.test(contract.documentIdArgument) ||
      !FIELD.test(contract.contentArgument) ||
      contract.documentIdArgument === contract.contentArgument ||
      contract.toolName === "read_doc") {
    throw new S5GateError("S5_WRITE_CONTRACT_MISSING");
  }
}

function confirmed(result: unknown, expectedDocumentId: string): boolean {
  if (!result || typeof result !== "object" || (result as { isError?: unknown }).isError === true) return false;
  const reply = result as Record<string, unknown>;
  const candidates: unknown[] = [reply.structuredContent];
  if (Array.isArray(reply.content)) {
    for (const item of reply.content) {
      if (item && typeof item === "object" && typeof item.text === "string") {
        try { candidates.push(JSON.parse(item.text)); } catch { /* not a structured acknowledgement */ }
      }
    }
  }
  let acknowledged = false;
  for (const item of candidates) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const envelope = item as Record<string, unknown>;
    if (!Object.hasOwn(envelope, "ok")) continue;
    // Only the observed edit_doc business envelope counts. Contradictory
    // envelopes or another page ID must never be accepted as an update.
    if (envelope.ok !== true) return false;
    const data = envelope.data;
    if (!data || typeof data !== "object" || Array.isArray(data) ||
        (data as Record<string, unknown>).doc_id !== expectedDocumentId) return false;
    acknowledged = true;
  }
  return acknowledged;
}

/**
 * Can only be used after the actual official tools/list contract has been
 * checked. This factory accepts no credentials and performs no remote call.
 */
export function createOfficialIwikiBestEffortPort(
  client: Pick<IwikiMcpClient, "callTool">,
  documentIds: Readonly<Record<string, string>>,
  contract: IwikiBestEffortContract,
): S5AtomicPort {
  assertContract(contract);
  const ids: Record<S5Document, string | undefined> = {
    tasks: documentIds[DOC_PATHS.tasks],
    notes: documentIds[DOC_PATHS.notes],
  };
  if (!ids.tasks || !PAGE_ID.test(ids.tasks) ||
      (ids.notes !== undefined && !PAGE_ID.test(ids.notes))) {
    throw new S5GateError("S5_WRITE_MAPPING_INVALID");
  }
  const readStore = new OfficialIwikiReadStore(client, { ...documentIds });
  const pathFor = (document: S5Document) => {
    const path = document === "tasks" ? DOC_PATHS.tasks : DOC_PATHS.notes;
    if (!ids[document]) throw new S5GateError("S5_WRITE_MAPPING_MISSING");
    return path;
  };

  return {
    supportsAtomicConditionalWrite: false,
    async read(document) {
      const snapshot = await readStore.read(pathFor(document));
      return { content: snapshot.content, revision: "" };
    },
    async compareAndWrite() {
      throw new S5GateError("S5_ATOMIC_WRITE_UNAVAILABLE");
    },
    async writeWithoutCondition(document, content) {
      pathFor(document);
      if (typeof content !== "string" || content === "") throw new S5GateError("S5_INVALID_PLAN");
      const args = {
        [contract.documentIdArgument]: ids[document],
        [contract.contentArgument]: content,
      };
      let response: unknown;
      try { response = await client.callTool(contract.toolName, args); }
      catch { throw new S5GateError("S5_IWIKI_WRITE_FAILED"); }
      if (!confirmed(response, ids[document]!)) throw new S5GateError("S5_IWIKI_WRITE_UNCONFIRMED");
      // Caller verifies the final document with read_doc before reporting success.
    },
  };
}
