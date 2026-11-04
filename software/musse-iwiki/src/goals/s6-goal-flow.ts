import { createHash, randomUUID } from "node:crypto";
import { appendProgressRecord, computeGoalProgress, parseGoal } from "../markdown/goals.ts";
import { parseTaskTable } from "../markdown/tasks.ts";
import { formatShanghai } from "../date.ts";
import { S6Error, scanGoals, validateGoalId, validateScope } from "./s6-goal-discovery.ts";
import type { GoalPort, GoalScope } from "./s6-goal-discovery.ts";

type PhaseInput = { id: string; name: string };
export type S6GoalAction =
  | { type: "goal_create"; goalId: string; title: string; description: string; phases: PhaseInput[] }
  | { type: "goal_update"; goalId: string; changes: { title?: string; description?: string; addPhase?: PhaseInput } }
  | { type: "goal_record_progress"; goalId: string; note: string };
type State = "AWAITING_APPROVAL" | "COMMITTING" | "VERIFIED" | "CANCELED" | "CONFLICT" | "UNCERTAIN" | "EXPIRED";
type Pending = {
  action: S6GoalAction; beforeHash: string | null; taskHash: string | null;
  docId: string | null; after: string; expiresAt: number; state: State;
};
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const visible = (s: string) => JSON.stringify(s);
const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const only = (o: Record<string, unknown>, allowed: string[], required: string[]) => {
  if (Object.keys(o).some((k) => !allowed.includes(k)) || required.some((k) => !Object.hasOwn(o, k)))
    throw new S6Error("S6_INVALID_FIELDS");
};
const field = (v: unknown, max: number, optional = false): string => {
  if (typeof v !== "string" || v.length > max || (!optional && v.trim().length === 0) ||
      /[\r\n\u0000-\u001f]/.test(v)) throw new S6Error("S6_INVALID_VALUE");
  return v.trim();
};
const phase = (v: unknown): PhaseInput => {
  if (!isObj(v)) throw new S6Error("S6_INVALID_PHASE");
  only(v, ["id", "name"], ["id", "name"]);
  const id = field(v.id, 32);
  if (!/^P[0-9A-Za-z_-]{1,31}$/.test(id)) throw new S6Error("S6_INVALID_PHASE");
  return { id, name: field(v.name, 120) };
};
export function parseS6GoalIntent(input: unknown): S6GoalAction {
  if (!isObj(input)) throw new S6Error("S6_INVALID_INTENT");
  const type = input.type;
  if (type === "goal_create") {
    only(input, ["type", "goalId", "title", "description", "phases"], ["goalId", "title"]);
    validateGoalId(input.goalId);
    const phases = input.phases === undefined ? [] : input.phases;
    if (!Array.isArray(phases) || phases.length > 20) throw new S6Error("S6_INVALID_PHASE");
    const parsed = phases.map(phase);
    if (new Set(parsed.map((p) => p.id)).size !== parsed.length) throw new S6Error("S6_DUPLICATE_PHASE");
    return { type, goalId: input.goalId, title: field(input.title, 120),
      description: input.description === undefined ? "" : field(input.description, 1000, true), phases: parsed };
  }
  if (type === "goal_update") {
    only(input, ["type", "goalId", "changes"], ["goalId", "changes"]);
    validateGoalId(input.goalId);
    if (!isObj(input.changes)) throw new S6Error("S6_INVALID_FIELDS");
    only(input.changes, ["title", "description", "addPhase"], []);
    if (Object.keys(input.changes).length === 0) throw new S6Error("S6_EMPTY_PATCH");
    return { type, goalId: input.goalId, changes: {
      ...(input.changes.title === undefined ? {} : { title: field(input.changes.title, 120) }),
      ...(input.changes.description === undefined ? {} : { description: field(input.changes.description, 1000, true) }),
      ...(input.changes.addPhase === undefined ? {} : { addPhase: phase(input.changes.addPhase) }),
    } };
  }
  if (type === "goal_record_progress") {
    only(input, ["type", "goalId", "note"], ["goalId", "note"]);
    validateGoalId(input.goalId);
    return { type, goalId: input.goalId, note: field(input.note, 600) };
  }
  throw new S6Error("S6_UNSUPPORTED_ACTION");
}

function newGoal(a: Extract<S6GoalAction, { type: "goal_create" }>): string {
  const phases = a.phases.map((p) =>
    "### 阶段 " + p.id + "：" + p.name + "\n- 阶段ID: " + p.id + "\n- 任务: \n- 手动进度: \n").join("\n");
  const content = "# 目标：" + a.title + "\n- 目标ID: " + a.goalId +
    "\n- 说明: " + a.description + "\n\n## 阶段\n\n" + phases +
    "## 进度历史\n\n| 日期 | 进度 | 说明 |\n|---|---|---|\n";
  if (parseGoal(content).id !== a.goalId) throw new S6Error("S6_INVALID_PLAN");
  return content;
}
function changeGoal(content: string, a: Extract<S6GoalAction, { type: "goal_update" }>): string {
  let updated = content;
  if (a.changes.title !== undefined) {
    updated = updated.replace(/^#[ \t]*目标[:：][ \t]*.+$/m, "# 目标：" + a.changes.title);
  }
  if (a.changes.description !== undefined) {
    if (!/^-\s*说明[:：].*$/m.test(updated)) throw new S6Error("S6_GOAL_FORMAT_INVALID");
    updated = updated.replace(/^-\s*说明[:：].*$/m, "- 说明: " + a.changes.description);
  }
  if (a.changes.addPhase) {
    if (!/^##\s*阶段\s*$/m.test(updated)) throw new S6Error("S6_GOAL_FORMAT_INVALID");
    const old = parseGoal(updated);
    if (old.phases.some((p) => p.id === a.changes.addPhase!.id)) throw new S6Error("S6_DUPLICATE_PHASE");
    const p = a.changes.addPhase;
    const chunk = "### 阶段 " + p.id + "：" + p.name +
      "\n- 阶段ID: " + p.id + "\n- 任务: \n- 手动进度: \n\n";
    const at = updated.search(/^##\s*进度历史\s*$/m);
    updated = at >= 0 ? updated.slice(0, at) + chunk + updated.slice(at)
      : updated.trimEnd() + "\n\n" + chunk;
  }
  if (parseGoal(updated).id !== a.goalId || updated === content) throw new S6Error("S6_NO_CHANGE");
  return updated;
}

/**
 * Separate S6 two-utterance flow. It never exposes arbitrary Markdown writes.
 * No background retries: any ambiguous create/edit is UNCERTAIN and blocks this
 * goal ID in the current process until manual investigation/restart.
 */
export function createS6GoalFlow(
  port: GoalPort, scope: GoalScope, options: { clock?: () => number; ttlMs?: number } = {},
) {
  validateScope(scope);
  const pending = new Map<string, Pending>();
  const clock = options.clock ?? Date.now;
  const ttlMs = options.ttlMs ?? 120_000;
  if (!Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > 600_000) throw new S6Error("S6_INVALID_CONFIG");
  const check = (id: string) => {
    const p = pending.get(id);
    if (!p) throw new S6Error("S6_UNKNOWN_PROPOSAL");
    if (p.state === "AWAITING_APPROVAL" && clock() >= p.expiresAt) p.state = "EXPIRED";
    return p;
  };
  return {
    async find(goalId: string) {
      validateGoalId(goalId);
      const doc = (await scanGoals(port, scope)).get(goalId);
      if (!doc) throw new S6Error("S6_GOAL_NOT_FOUND");
      return { goal: doc.goal, documentTitle: doc.entry.title };
    },
    async prepare(input: unknown) {
      const action = parseS6GoalIntent(input);
      for (const [key, item] of pending) {
        if (item.state !== "COMMITTING" && item.state !== "UNCERTAIN" && clock() >= item.expiresAt)
          pending.delete(key);
      }
      if ([...pending.values()].some((p) => p.action.goalId === action.goalId &&
          (p.state === "COMMITTING" || p.state === "UNCERTAIN")))
        throw new S6Error("S6_GOAL_BLOCKED");
      if (pending.size >= 32) throw new S6Error("S6_TOO_MANY_PENDING");
      const found = (await scanGoals(port, scope)).get(action.goalId);
      if (action.type === "goal_create" && found) throw new S6Error("S6_DUPLICATE_GOAL");
      if (action.type !== "goal_create" && !found) throw new S6Error("S6_GOAL_NOT_FOUND");
      let content: string;
      let preview: string;
      let taskHash: string | null = null;
      if (action.type === "goal_create") {
        content = newGoal(action);
        preview = "在指定长期目标目录创建 " + action.goalId + "，名称：" + visible(action.title) +
          "；说明：" + visible(action.description) + "；阶段数：" + action.phases.length;
      } else if (action.type === "goal_update") {
        content = changeGoal(found!.content, action);
        preview = "更新长期目标 " + action.goalId + "，变更：" + visible(JSON.stringify(action.changes));
      } else {
        let taskContent: string;
        try { taskContent = await port.readTaskTable(); parseTaskTable(taskContent); }
        catch { throw new S6Error("S6_TASK_READ_FAILED"); }
        taskHash = digest(taskContent);
        const progress = computeGoalProgress(found!.goal, parseTaskTable(taskContent));
        const date = formatShanghai(new Date(clock())).slice(0, 10);
        content = appendProgressRecord(found!.content, { date, percent: progress.percent, note: action.note });
        preview = "追加目标 " + action.goalId + " 的进度记录：" + progress.completedTasks + "/" +
          progress.totalTasks + " 项已完成（" + progress.percent + "%），说明：" + visible(action.note);
      }
      if (content.length > 512_000 || preview.length > 2000) throw new S6Error("S6_PLAN_TOO_LARGE");
      const operationId = randomUUID();
      pending.set(operationId, {
        action, beforeHash: found ? digest(found.content) : null, taskHash,
        docId: found ? found.entry.docId : null, after: content,
        expiresAt: clock() + ttlMs, state: "AWAITING_APPROVAL",
      });
      return { operationId, preview, question: "请下一轮明确说“确认写入”或“取消”。",
        expiresAt: clock() + ttlMs, status: "AWAITING_APPROVAL" };
    },
    cancel(operationId: string) {
      const p = check(operationId);
      if (p.state !== "AWAITING_APPROVAL") throw new S6Error("S6_NOT_PENDING");
      p.state = "CANCELED"; p.after = "";
      return { canceled: true };
    },
    async confirm(operationId: string, spokenText: string) {
      const p = check(operationId);
      if (p.state !== "AWAITING_APPROVAL") throw new S6Error("S6_NOT_PENDING");
      if (spokenText?.trim() !== "确认写入" && spokenText?.trim() !== "确认保存")
        throw new S6Error("S6_EXPLICIT_CONFIRMATION_REQUIRED");
      if ([...pending.values()].some((other) => other !== p && other.action.goalId === p.action.goalId &&
          other.state === "COMMITTING")) throw new S6Error("S6_GOAL_BUSY");
      p.state = "COMMITTING";
      let found;
      try {
        found = (await scanGoals(port, scope)).get(p.action.goalId);
        if ((p.docId === null && found) || (p.docId !== null &&
          (!found || found.entry.docId !== p.docId || digest(found.content) !== p.beforeHash)))
          throw new S6Error("S6_CONFLICT");
        if (p.taskHash !== null) {
          const currentTasks = await port.readTaskTable();
          parseTaskTable(currentTasks);
          if (digest(currentTasks) !== p.taskHash) throw new S6Error("S6_CONFLICT");
        }
      } catch (error) {
        p.state = "CONFLICT"; p.after = "";
        throw error instanceof S6Error ? error : new S6Error("S6_PREWRITE_FAILED");
      }
      let writtenId = p.docId;
      try {
        if (p.docId === null) writtenId = await port.createDoc(scope, p.action.goalId, p.after);
        else await port.editDoc(p.docId, p.after);
      } catch {
        p.state = "UNCERTAIN"; p.after = "";
        throw new S6Error("S6_WRITE_UNCERTAIN");
      }
      try {
        if (!writtenId) throw new Error("missing ID");
        const scanned = (await scanGoals(port, scope)).get(p.action.goalId);
        if (!scanned || scanned.entry.docId !== writtenId || scanned.content !== p.after)
          throw new Error("readback mismatch");
        p.state = "VERIFIED"; p.after = "";
        return { operationId, status: "VERIFIED" };
      } catch {
        p.state = "UNCERTAIN"; p.after = "";
        throw new S6Error("S6_READBACK_UNCERTAIN");
      }
    },
    status(operationId: string) { return check(operationId).state; },
  };
}
