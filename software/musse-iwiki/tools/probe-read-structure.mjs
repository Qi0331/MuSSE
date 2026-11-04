/**
 * MuSSE S2-A: opt-in read_doc response-shape probe.
 * Reads exactly one explicitly selected document, prints ONLY structure.
 * No document content, token, IDs, paths, HTTP body or exception detail printed.
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { extractConnection } from './inspect-readonly.mjs';

const GENERIC_KEYS = new Set([
  'ok', 'success', 'result', 'data', 'content', 'structuredContent',
  'doc', 'document', 'id', 'doc_id', 'doc_path', 'path', 'title', 'text',
  'markdown', 'body', 'version', 'updatedAt', 'updated_at', 'createdAt',
  'type', 'mimeType', 'meta', 'metadata', 'isError', 'items', 'results',
  'error', 'message', 'code', 'children', 'format', 'status',
]);

export function shape(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return depth >= 4 ? 'array' : { type: 'array', firstItem: value.length ? shape(value[0], depth + 1) : 'empty' };
  }
  if (typeof value !== 'object') return typeof value;
  if (depth >= 4) return 'object';
  const fields = {};
  let other = false;
  for (const [key, nested] of Object.entries(value)) {
    if (GENERIC_KEYS.has(key)) fields[key] = shape(nested, depth + 1);
    else other = true;
  }
  if (other) fields['otherKeysOmitted'] = true;
  return { type: 'object', fields };
}

export function summarizeReadResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { success: false, responseType: typeof result };
  }
  if (result.isError === true) {
    return { success: false, isError: true, errorDetailsSuppressed: true };
  }
  const blocks = Array.isArray(result.content) ? result.content : [];
  return {
    success: true,
    structuredContent: result.structuredContent === undefined ? 'absent' : shape(result.structuredContent),
    contentBlocks: blocks.slice(0, 3).map(block => {
      if (!block || typeof block !== 'object') return 'unknown';
      if (typeof block.text !== 'string') return { type: 'non-text-or-unknown' };
      let decoded;
      try { decoded = JSON.parse(block.text); } catch { return { type: 'text', payload: 'string (not printed)' }; }
      return { type: 'text', payload: shape(decoded) };
    }),
    otherContentBlocksOmitted: blocks.length > 3,
    note: 'Only approved generic field names and value types appear; no document text or IDs are emitted.',
  };
}

export async function probeRead(client, mode, identifier) {
  if (!['doc_id', 'doc_path'].includes(mode) || typeof identifier !== 'string' || identifier.trim() === '') {
    throw new Error('ARGUMENTS_INVALID');
  }
  const result = await client.callTool('read_doc', { [mode]: identifier.trim() });
  return summarizeReadResult(result);
}

async function main(args) {
  if (args.length !== 1 || args[0] !== '--live') {
    process.stdout.write('Usage: node tools/probe-read-structure.mjs --live\n' +
      'Default: no config access or network call. --live requires a terminal and interactively reads ONE chosen document, printing structural types only.\n');
    return;
  }
  if (!process.stdin.isTTY) throw new Error('INTERACTIVE_TERMINAL_REQUIRED');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let mode, identifier;
  try {
    process.stdout.write('Use a non-sensitive test document you are permitted to read. Your entered identifier may be echoed locally: do not share the prompt transcript.\n');
    mode = (await rl.question('Choose identifier type (doc_id / doc_path): ')).trim();
    if (!['doc_id', 'doc_path'].includes(mode)) throw new Error('ARGUMENTS_INVALID');
    identifier = (await rl.question('Enter the TEST document identifier (will not be printed in report): ')).trim();
    if (!identifier || identifier.length > 1024) throw new Error('ARGUMENTS_INVALID');
    const yes = (await rl.question('Confirm exactly one read_doc on your selected test document? type YES: ')).trim();
    if (yes !== 'YES') throw new Error('NOT_CONFIRMED');
  } finally { rl.close(); }

  const configPath = join(homedir(), 'MuSSE-MCP-Local', 'musse-bridge', 'xiaozhi.config.json');
  const connection = extractConnection(JSON.parse(await readFile(configPath, 'utf8')));
  const { IwikiMcpClient } = await import('../src/store/iwiki-mcp-client.ts');
  const client = new IwikiMcpClient(connection);
  const summary = await probeRead(client, mode, identifier);
  process.stdout.write('SAFE_READ_STRUCTURE_BEGIN\n' + JSON.stringify(summary, null, 2) + '\nSAFE_READ_STRUCTURE_END\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch(() => {
    process.stderr.write('S2-A read shape probe failed. Sensitive error details suppressed. No further requests made.\n');
    process.exitCode = 1;
  });
}
