import { createS5Gate, S5GateError } from "./guarded-write.ts";
import type { S5AtomicPort, S5Planner } from "./guarded-write.ts";

/**
 * Practical two-turn voice UX:
 *  1. prepare(intent): show/read the exact change, ask user to confirm.
 *  2. confirm(operationId, spokenText): only after a new spoken user confirmation.
 *
 * This is conversation-level confirmation, NOT an authenticated speech transcript.
 * The calling assistant must never generate the confirmation phrase itself.
 * Does not register MCP tools or connect a real iWiki writer.
 */
export function createS5VoiceFlow(
  port: S5AtomicPort,
  planner: S5Planner,
  options: { clock?: () => number; ttlMs?: number; concurrencyMode?: "atomic" | "check-before-write" } = {},
) {
  const gate = createS5Gate(port, planner, options);
  const proposals = new Map<string, { digest: string; expiresAt: number }>();
  const clock = options.clock ?? Date.now;

  return {
    async prepare(intent: unknown): Promise<{
      operationId: string;
      preview: string;
      question: string;
      expiresAt: number;
    }> {
      for (const [id, p] of proposals) {
        if (clock() >= p.expiresAt && gate.untrusted.status(id) !== "COMMITTING") proposals.delete(id);
      }
      const p = await gate.untrusted.prepare(intent);
      proposals.set(p.operationId, { digest: p.approvalDigest, expiresAt: p.expiresAt });
      return {
        operationId: p.operationId,
        preview: p.preview,
        question: "需要保存这项修改吗？请明确说“确认写入”或“取消”。",
        expiresAt: p.expiresAt,
      };
    },
    async confirm(operationId: string, spokenText: string): Promise<{ operationId: string; status: "VERIFIED" }> {
      const saved = proposals.get(operationId);
      if (!saved) throw new S5GateError("S5_UNKNOWN_PROPOSAL");
      if (typeof spokenText !== "string" || !["确认写入", "确认保存"].includes(spokenText.trim())) {
        throw new S5GateError("S5_EXPLICIT_CONFIRMATION_REQUIRED");
      }
      gate.trusted.approve(operationId, saved.digest);
      try {
        const result = await gate.untrusted.commit(operationId);
        proposals.delete(operationId);
        return result;
      } catch (error) {
        // Preserve a failed/uncertain proposal in the underlying gate.
        throw error;
      }
    },
    cancel(operationId: string): void {
      if (!proposals.has(operationId)) throw new S5GateError("S5_UNKNOWN_PROPOSAL");
      gate.trusted.reject(operationId);
      proposals.delete(operationId);
    },
    status: gate.untrusted.status,
  };
}
