/**
 * S2-A task read validation: one official remote read, memory-only TaskService queries.
 * Never prints token, doc ID/path, document text, task names or raw error.
 * Default: no network, no private file access.
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { extractConnection } from './inspect-readonly.mjs';

export async function taskCountsFromStore(store, now = new Date()) {
  const { DOC_PATHS } = await import('../src/store/wiki-store.ts');
  const { TaskService } = await import('../src/service/task-service.ts');
  const snapshot = await store.read(DOC_PATHS.tasks); // Exactly ONE remote read.
  const memoryView = {
    read: async (path) => {
      if (path !== DOC_PATHS.tasks) throw Error('UNMAPPED_DOCUMENT');
      return snapshot;
    },
    write: async () => { throw Error('READ_ONLY'); },
    list: async () => { throw Error('READ_ONLY'); },
  };
  const service = new TaskService(memoryView);
  const all = await service.listTasks();
  const today = await service.scheduleToday(now);
  const upcoming = await service.scheduleUpcoming(7, now);
  const overdue = await service.scheduleOverdue(now);
  return {
    validatedTaskTable: true,
    taskCount: all.length,
    todoCount: all.filter(task => task.status === 'todo').length,
    doneCount: all.filter(task => task.status === 'done').length,
    archivedCount: all.filter(task => task.status === 'archived').length,
    todayCount: today.length,
    upcoming7DaysCount: upcoming.length,
    overdueCount: overdue.length,
    remoteReadCalls: 1,
    remoteWriteCalls: 0,
    note: 'Counts are computed from a single remote snapshot; no task titles, IDs or document text are printed.',
  };
}

async function main(args) {
  if (args.length !== 1 || args[0] !== '--live') {
    process.stdout.write('Usage: node tools/probe-task-queries.mjs --live\n' +
      'Default: no private file read or network call. Live mode requires an interactive terminal, a manually prepared NON-SENSITIVE test task-table document, and explicit confirmation.\n');
    return;
  }
  if (!process.stdin.isTTY) throw Error('INTERACTIVE_TERMINAL_REQUIRED');
  const rl = createInterface({input: process.stdin, output: process.stdout});
  let docId;
  try {
    process.stdout.write('Select your own non-sensitive TEST task-table document. The ID may echo on your screen; do not send the full terminal transcript.\n');
    docId = (await rl.question('Enter the TEST task table document ID (page-...): ')).trim();
    if (!/^page-[A-Za-z0-9_-]{1,100}$/.test(docId)) throw Error('INVALID_DOCUMENT_ID');
    const yes = (await rl.question('Confirm ONE read_doc and local task COUNT calculation? Type YES: ')).trim();
    if (yes !== 'YES') throw Error('NOT_CONFIRMED');
  } finally {
    rl.close();
  }
  const configPath = join(homedir(), 'MuSSE-MCP-Local', 'musse-bridge', 'xiaozhi.config.json');
  const connection = extractConnection(JSON.parse(await readFile(configPath, 'utf8')));
  const {IwikiMcpClient} = await import('../src/store/iwiki-mcp-client.ts');
  const {OfficialIwikiReadStore} = await import('../src/store/official-iwiki-read.ts');
  const {DOC_PATHS} = await import('../src/store/wiki-store.ts');
  const store = new OfficialIwikiReadStore(
    new IwikiMcpClient(connection), {[DOC_PATHS.tasks]: docId}
  );
  const summary = await taskCountsFromStore(store);
  process.stdout.write('SAFE_TASK_SUMMARY_BEGIN\n' + JSON.stringify(summary, null, 2) +
    '\nSAFE_TASK_SUMMARY_END\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch(() => {
    process.stderr.write('S2-A task query validation failed (private details suppressed). No writes attempted.\n');
    process.exitCode = 1;
  });
}
