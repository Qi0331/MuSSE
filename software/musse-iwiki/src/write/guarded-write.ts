import { createHash, randomUUID } from "node:crypto";

/** S5-B offline gate. No MCP server or production write adapter is wired here. */
export type S5Action =
  | { type: "task_create"; title: string; dueDate: string; dueTime?: string; description?: string; category?: string; priority?: "P0" | "P1" | "P2" | "P3" }
  | { type: "task_update"; taskId: string; changes: Record<string, string> }
  | { type: "task_complete" | "task_archive" | "task_restore"; taskId: string }
  | { type: "note_create"; content: string };
export type S5Document = "tasks" | "notes";
export type S5Status = "AWAITING_APPROVAL" | "APPROVED" | "COMMITTING" | "VERIFIED" | "REJECTED" | "EXPIRED" | "CONFLICT" | "UNCERTAIN";

export interface S5Snapshot {
  /** The authoritative iWiki document, not a local copy. */
  content: string;
  /** Nonempty opaque token accepted by an independently verified atomic conditional write endpoint. */
  revision: string;
}

/** Atomic writes are preferred. For personal low-frequency use, an explicitly enabled read-check-write fallback is also supported. */
export interface S5AtomicPort {
  readonly supportsAtomicConditionalWrite: boolean;
  read(document: S5Document): Promise<S5Snapshot>;
  compareAndWrite(document: S5Document, expectedRevision: string, content: string, operationId: string): Promise<void>;
  /** Optional best-effort fallback; never atomic against concurrent iWiki browser edits. */
  writeWithoutCondition?(document: S5Document, content: string, operationId: string): Promise<void>;
}

export interface S5Mutation {
  /** Human-readable preview for a trusted confirmation display, never for public logs. */
  preview: string;
  /** Full resulting Markdown stays in volatile process memory only. */
  content: string;
}

/** Domain planner may read/validate, but it MUST NOT invoke any write operation. */
export type S5Planner = (action: S5Action, current: string, operationId: string, now: Date) => S5Mutation;

export class S5GateError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code; // Never interpolate upstream responses, document text, IDs or tokens.
    this.name = "S5GateError";
  }
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new S5GateError("S5_INVALID_INTENT");
  return value as Record<string, unknown>;
}

function keys(obj: Record<string, unknown>, allowed: readonly string[], required: readonly string[] = []): void {
  if (Object.keys(obj).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(obj, key))) {
    throw new S5GateError("S5_INVALID_FIELDS");
  }
}

function textField(value: unknown, max: number, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && value.trim() === "") || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
    throw new S5GateError("S5_INVALID_VALUE");
  }
  return value.trim();
}

const TASK_FIELDS = ["title", "description", "category", "priority", "dueDate", "dueTime"] as const;
const LIMITS: Record<string, number> = { title: 160, description: 4000, category: 100, priority: 2, dueDate: 10, dueTime: 5 };
const PRIORITIES = ["P0", "P1", "P2", "P3"];

function validateDate(s: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new S5GateError("S5_INVALID_DATE");
  const [y, m, d] = s.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d));
  if (x.getUTCFullYear() !== y || x.getUTCMonth() !== m - 1 || x.getUTCDate() !== d) throw new S5GateError("S5_INVALID_DATE");
}
function validateTime(s: string): void {
  if (s !== "" && (!/^\d{2}:\d{2}$/.test(s) || Number(s.slice(0, 2)) > 23 || Number(s.slice(3)) > 59)) {
    throw new S5GateError("S5_INVALID_TIME");
  }
}
function validateTaskFields(input: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of Object.keys(input)) {
    if (!TASK_FIELDS.includes(field as typeof TASK_FIELDS[number])) throw new S5GateError("S5_INVALID_FIELDS");
    if (typeof input[field] === "string" && /[\r\n]/.test(input[field])) throw new S5GateError("S5_INVALID_VALUE");
    const value = textField(input[field], LIMITS[field], ["description", "category", "dueTime"].includes(field));
    if (field === "priority" && !PRIORITIES.includes(value)) throw new S5GateError("S5_INVALID_PRIORITY");
    if (field === "dueDate") validateDate(value);
    if (field === "dueTime") validateTime(value);
    result[field] = value;
  }
  return result;
}

/** Strict allowlist. A model-supplied 'confirmed' field cannot trigger approval. */
export function parseS5Intent(input: unknown): S5Action {
  const obj = record(input);
  if (typeof obj.type !== "string") throw new S5GateError("S5_INVALID_INTENT");
  switch (obj.type) {
    case "task_create": {
      keys(obj, ["type", ...TASK_FIELDS], ["title", "dueDate"]);
      return { type: "task_create", ...validateTaskFields(Object.fromEntries(Object.entries(obj).filter(([k]) => k !== "type"))) } as S5Action;
    }
    case "task_update": {
      keys(obj, ["type", "taskId", "changes"], ["taskId", "changes"]);
      const taskId = textField(obj.taskId, 64);
      if (!/^[A-Za-z0-9_-]{3,64}$/.test(taskId)) throw new S5GateError("S5_INVALID_ID");
      const changes = validateTaskFields(record(obj.changes));
      if (Object.keys(changes).length === 0) throw new S5GateError("S5_EMPTY_PATCH");
      return { type: "task_update", taskId, changes };
    }
    case "task_complete":
    case "task_archive":
    case "task_restore": {
      keys(obj, ["type", "taskId"], ["taskId"]);
      const taskId = textField(obj.taskId, 64);
      if (!/^[A-Za-z0-9_-]{3,64}$/.test(taskId)) throw new S5GateError("S5_INVALID_ID");
      return { type: obj.type, taskId };
    }
    case "note_create":
      keys(obj, ["type", "content"], ["content"]);
      return { type: "note_create", content: textField(obj.content, 4000) };
    default:
      throw new S5GateError("S5_UNSUPPORTED_ACTION");
  }
}

function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function target(action: S5Action): S5Document { return action.type === "note_create" ? "notes" : "tasks"; }

interface Pending {
  id: string;
  digest: string;
  document: S5Document;
  beforeHash: string;
  revision: string;
  content: string;
  expiresAt: number;
  status: S5Status;
  receipt?: { operationId: string; status: "VERIFIED" };
}

export interface S5Prepared {
  operationId: string;
  approvalDigest: string;
  preview: string;
  expiresAt: number;
  status: "AWAITING_APPROVAL";
}

/**
 * Split capabilities: only 'untrusted' may later be exposed to an MCP client.
 * 'trusted.approve' must be wired to an independently authenticated user action,
 * never to a model-accessible tool or a model-provided boolean.
 */
export function createS5Gate(
  port: S5AtomicPort,
  planner: S5Planner,
  options: { clock?: () => number; ttlMs?: number; maxPending?: number; concurrencyMode?: "atomic" | "check-before-write" } = {},
) {
  const pending = new Map<string, Pending>();
  const receipts = new Map<string, { receipt: { operationId: string; status: "VERIFIED" }; expiresAt: number }>();
  let preparing = 0;
  const clock = options.clock ?? Date.now;
  const ttlMs = options.ttlMs ?? 120_000;
  const maxPending = options.maxPending ?? 32;
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 600_000 || !Number.isInteger(maxPending) || maxPending < 1 || maxPending > 256) {
    throw new S5GateError("S5_INVALID_CONFIG");
  }
  const get = (id: string): Pending => {
    const item = pending.get(id);
    if (!item) throw new S5GateError("S5_UNKNOWN_PROPOSAL");
    if ((item.status === "AWAITING_APPROVAL" || item.status === "APPROVED") && clock() >= item.expiresAt) { item.status = "EXPIRED"; item.content = ""; }
    return item;
  };
  const untrusted = Object.freeze({
    async prepare(input: unknown): Promise<S5Prepared> {
      const action = parseS5Intent(input);
      const document = target(action);
      for (const [id, entry] of receipts) if (clock() >= entry.expiresAt) receipts.delete(id);
      for (const [id, item] of pending) {
        if (item.status === "VERIFIED" && item.receipt) {
          receipts.set(id, { receipt: item.receipt, expiresAt: clock() + ttlMs });
          pending.delete(id);
        } else if (item.status !== "COMMITTING" && item.status !== "UNCERTAIN" && clock() >= item.expiresAt) {
          pending.delete(id);
        }
      }
      while (receipts.size > 128) receipts.delete(receipts.keys().next().value!);
      // A write with unknown outcome must block further mutations to the same document.
      if ([...pending.values()].some((item) => item.document === document &&
        (item.status === "COMMITTING" || item.status === "UNCERTAIN"))) {
        throw new S5GateError("S5_DOCUMENT_BLOCKED");
      }
      if (pending.size + preparing >= maxPending) throw new S5GateError("S5_TOO_MANY_PENDING");
      preparing++; // Reserve capacity before the asynchronous read.
      try {
      let snapshot: S5Snapshot;
      try { snapshot = await port.read(document); } catch { throw new S5GateError("S5_READ_FAILED"); }
      if (!snapshot || typeof snapshot.content !== "string" || snapshot.content.length > 512_000) throw new S5GateError("S5_INVALID_SNAPSHOT");
      const id = randomUUID();
      let plan: S5Mutation;
      try { plan = planner(action, snapshot.content, id, new Date(clock())); }
      catch (error) { throw error instanceof S5GateError ? error : new S5GateError("S5_PLAN_REJECTED"); }
      if (!plan || typeof plan.content !== "string" || typeof plan.preview !== "string" || plan.content.length > 512_000 || plan.preview.length > 2000 || plan.content === snapshot.content) {
        throw new S5GateError("S5_INVALID_PLAN");
      }
      const approvalDigest = digest(JSON.stringify([id, action, document, snapshot.revision, digest(snapshot.content), digest(plan.content), plan.preview]));
      const expiresAt = clock() + ttlMs;
      pending.set(id, {
        id, digest: approvalDigest, document, beforeHash: digest(snapshot.content), revision: snapshot.revision,
        content: plan.content, expiresAt, status: "AWAITING_APPROVAL",
      });
      return { operationId: id, approvalDigest, preview: plan.preview, expiresAt, status: "AWAITING_APPROVAL" };
      } finally { preparing--; }
    },
    async commit(operationId: string): Promise<{ operationId: string; status: "VERIFIED" }> {
      const cached = receipts.get(operationId);
      if (cached && clock() < cached.expiresAt) return cached.receipt;
      const item = get(operationId);
      if (item.status === "VERIFIED" && item.receipt) return item.receipt;
      if (item.status !== "APPROVED") throw new S5GateError("S5_NOT_APPROVED");
      const useAtomic = port.supportsAtomicConditionalWrite && typeof item.revision === "string" && item.revision.trim() !== "";
      const useBestEffort = !useAtomic && options.concurrencyMode === "check-before-write" && typeof port.writeWithoutCondition === "function";
      if (!useAtomic && !useBestEffort) throw new S5GateError("S5_ATOMIC_WRITE_UNAVAILABLE");
      if ([...pending.values()].some((other) => other.id !== item.id && other.document === item.document && other.status === "COMMITTING")) {
        throw new S5GateError("S5_DOCUMENT_BUSY");
      }
      item.status = "COMMITTING"; // Prevent concurrent duplicates before any await.
      try {
        const current = await port.read(item.document);
        if (current.revision !== item.revision || digest(current.content) !== item.beforeHash) {
          item.status = "CONFLICT";
          item.content = "";
          throw new S5GateError("S5_CONFLICT");
        }
      } catch (error) {
        // The update tool has not been called yet: a failed pre-write read
        // is a rejection, not an indeterminate remote write. Allow a fresh
        // proposal instead of permanently blocking this document.
        if (item.status !== "CONFLICT") item.status = "REJECTED";
        item.content = "";
        throw error instanceof S5GateError ? error : new S5GateError("S5_READ_BEFORE_WRITE_FAILED");
      }
      try {
        if (useAtomic) await port.compareAndWrite(item.document, item.revision, item.content, item.id);
        else await port.writeWithoutCondition!(item.document, item.content, item.id);
      } catch {
        // Even a timeout may have committed remotely. Never blindly retry.
        item.status = "UNCERTAIN";
        item.content = "";
        throw new S5GateError("S5_WRITE_UNCERTAIN");
      }
      try {
        const after = await port.read(item.document);
        if (after.content !== item.content) throw new Error("mismatch");
        const receipt = { operationId: item.id, status: "VERIFIED" as const };
        item.receipt = receipt;
        item.status = "VERIFIED";
        item.content = ""; // Minimize retention after verification.
        return receipt;
      } catch {
        item.status = "UNCERTAIN";
        item.content = "";
        throw new S5GateError("S5_READBACK_UNCERTAIN");
      }
    },
    status(operationId: string): S5Status {
      const cached = receipts.get(operationId);
      if (cached && clock() < cached.expiresAt) return "VERIFIED";
      return get(operationId).status;
    },
  });
  const trusted = Object.freeze({
    approve(operationId: string, approvalDigest: string): void {
      const item = get(operationId);
      if (item.status !== "AWAITING_APPROVAL" || item.digest !== approvalDigest) throw new S5GateError("S5_APPROVAL_REJECTED");
      item.status = "APPROVED";
    },
    reject(operationId: string): void {
      const item = get(operationId);
      if (item.status !== "AWAITING_APPROVAL") throw new S5GateError("S5_APPROVAL_REJECTED");
      item.status = "REJECTED";
      item.content = "";
    },
  });
  return { untrusted, trusted } as const;
}
