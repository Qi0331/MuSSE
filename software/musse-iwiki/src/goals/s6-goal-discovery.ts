import { parseGoal } from "../markdown/goals.ts";
import type { Goal } from "../types.ts";

/**
 * S6 domain boundary. The adapter MUST produce a complete direct-child list
 * anchored by both a trusted space and folder ID, never a search ranking.
 */
export interface GoalScope { spaceId: string; folderId: string }
export interface GoalEntry {
  docId: string; title: string; parentId: string; spaceId: string;
  kind: "markdown";
}
export interface ChildListing { complete: boolean; entries: GoalEntry[] }
export interface GoalPort {
  listDirectChildren(scope: GoalScope): Promise<ChildListing>;
  readDoc(docId: string): Promise<string>;
  createDoc(scope: GoalScope, title: string, content: string): Promise<string>;
  editDoc(docId: string, content: string): Promise<void>;
  readTaskTable(): Promise<string>;
}
export interface FoundGoal { entry: GoalEntry; goal: Goal; content: string }
export class S6Error extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; this.name = "S6Error"; }
}
const ID = /^G-[0-9]{3,6}$/;
const PAGE = /^page-[A-Za-z0-9_-]{1,100}$/;
const ANCHOR = /^[A-Za-z0-9_-]{1,200}$/;

export function validateGoalId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !ID.test(id)) throw new S6Error("S6_INVALID_GOAL_ID");
}
export function validateScope(scope: GoalScope): void {
  if (!scope || typeof scope.spaceId !== "string" || !ANCHOR.test(scope.spaceId) ||
      typeof scope.folderId !== "string" || !ANCHOR.test(scope.folderId)) {
    throw new S6Error("S6_SCOPE_NOT_CONFIGURED");
  }
}

/**
 * Read ALL canonical goal documents (bounded). Detect duplicate names, IDs,
 * misleading metadata, stray cross-folder children and corrupt Markdown.
 * A missing/partial listing is never interpreted as "goal does not exist".
 */
export async function scanGoals(port: GoalPort, scope: GoalScope): Promise<Map<string, FoundGoal>> {
  validateScope(scope);
  let result: ChildListing;
  try { result = await port.listDirectChildren(scope); }
  catch { throw new S6Error("S6_DISCOVERY_UNAVAILABLE"); }
  if (!result || result.complete !== true || !Array.isArray(result.entries) ||
      result.entries.length > 100) throw new S6Error("S6_LIST_INCOMPLETE");
  const names = new Set<string>();
  const ids = new Set<string>();
  const found = new Map<string, FoundGoal>();
  for (const entry of result.entries) {
    if (!entry || entry.spaceId !== scope.spaceId || entry.parentId !== scope.folderId ||
        entry.kind !== "markdown" || !PAGE.test(entry.docId) ||
        typeof entry.title !== "string" || !ID.test(entry.title)) {
      throw new S6Error("S6_SCOPE_OR_METADATA_MISMATCH");
    }
    if (names.has(entry.title) || ids.has(entry.docId)) throw new S6Error("S6_DUPLICATE_DOCUMENT");
    names.add(entry.title);
    ids.add(entry.docId);
  }
  for (const entry of result.entries) {
    let content: string;
    try { content = await port.readDoc(entry.docId); }
    catch { throw new S6Error("S6_READ_FAILED"); }
    if (typeof content !== "string" || content.length > 512_000) throw new S6Error("S6_READ_UNVERIFIED");
    let goal: Goal;
    try { goal = parseGoal(content); }
    catch { throw new S6Error("S6_GOAL_FORMAT_INVALID"); }
    if (goal.id !== entry.title || !ID.test(goal.id) ||
        goal.phases.some((p) => !/^[A-Za-z0-9_-]{1,32}$/.test(p.id)) ||
        new Set(goal.phases.map((p) => p.id)).size !== goal.phases.length) {
      throw new S6Error("S6_GOAL_ID_MISMATCH");
    }
    if (found.has(goal.id)) throw new S6Error("S6_DUPLICATE_GOAL");
    found.set(goal.id, { entry, goal, content });
  }
  return found;
}

export async function findGoal(port: GoalPort, scope: GoalScope, goalId: string): Promise<FoundGoal> {
  validateGoalId(goalId);
  const found = (await scanGoals(port, scope)).get(goalId);
  if (!found) throw new S6Error("S6_GOAL_NOT_FOUND");
  return found;
}
