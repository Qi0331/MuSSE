/**
 * Standalone no-write S5 voice-preview MCP server for the optional third
 * xiaozhi MCP entry. No write contract, edit_doc or write-enable flag.
 */
import { fileURLToPath } from "node:url";
import { mainPreview } from "./server-s5.ts";

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mainPreview().catch(() => {
    process.stderr.write("[musse-iwiki] S5 preview unavailable (private read mapping/config missing)\n");
    process.exitCode = 1;
  });
}
