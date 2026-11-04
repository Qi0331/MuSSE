/**
 * Explicitly installed S5 WRITE launcher for the third Windows xiaozhi MCP.
 * This entrypoint is not used by the existing S4 services or preview service.
 * It enables S5 only in its own child process after private config/contract load.
 */
import { fileURLToPath } from "node:url";
import { buildS5VoiceFlow, serveS5VoiceStdio } from "./server-s5.ts";

export async function mainWrite(env = process.env, input = process.stdin, output = process.stdout) {
  const flow = await buildS5VoiceFlow({ ...env, MUSSE_S5_WRITE_ENABLED: "1" });
  process.stderr.write("[musse-iwiki] S5 two-turn voice writer ready\n");
  await serveS5VoiceStdio(flow, input, output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mainWrite().catch(() => {
    // Never log private config, token, document text, IDs or upstream failures.
    process.stderr.write("[musse-iwiki] S5 writer unavailable (private config or contract invalid)\n");
    process.exitCode = 1;
  });
}
