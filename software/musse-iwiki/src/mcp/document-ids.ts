import { DOC_PATHS, goalPath } from "../store/wiki-store.ts";

const PAGE_ID = /^page-[A-Za-z0-9_-]{1,100}$/;
const GOAL_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** S4-C: explicit logical paths for official read_doc; never discover private spaces. */
export function readonlyDocumentIds(env: NodeJS.ProcessEnv): Record<string, string> {
  const taskId = env.MUSSE_IWIKI_TASK_DOC_ID;
  if (!taskId || !PAGE_ID.test(taskId)) throw new Error("S4_READONLY_MAPPING_INVALID");
  const ids: Record<string, string> = { [DOC_PATHS.tasks]: taskId };

  // Optional mapping retains S4-B task-only compatibility; missing lookups fail closed.
  const notesId = env.MUSSE_IWIKI_NOTES_DOC_ID;
  if (notesId !== undefined) {
    if (!PAGE_ID.test(notesId)) throw new Error("S4_READONLY_MAPPING_INVALID");
    ids[DOC_PATHS.notes] = notesId;
  }

  const raw = env.MUSSE_IWIKI_GOAL_DOC_IDS;
  if (raw !== undefined) {
    let goals: unknown;
    try { goals = JSON.parse(raw); } catch { throw new Error("S4_READONLY_MAPPING_INVALID"); }
    if (!goals || typeof goals !== "object" || Array.isArray(goals)) {
      throw new Error("S4_READONLY_MAPPING_INVALID");
    }
    const entries = Object.entries(goals);
    if (entries.length > 100) throw new Error("S4_READONLY_MAPPING_INVALID");
    for (const [goalId, docId] of entries) {
      if (!GOAL_ID.test(goalId) || typeof docId !== "string" || !PAGE_ID.test(docId)) {
        throw new Error("S4_READONLY_MAPPING_INVALID");
      }
      ids[goalPath(goalId)] = docId;
    }
  }
  return ids;
}
