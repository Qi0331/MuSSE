/**
 * S2-B: deliberately read-only goal/notes verification against three explicitly
 * selected synthetic iWiki documents. Default invocation reads nothing.
 * Live mode only reports aggregate counts, never document text or IDs.
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { extractConnection } from './inspect-readonly.mjs';

const ID_PATTERN = /^page-[A-Za-z0-9_-]{1,100}$/;
const GOAL = 'G-001';

export async function summarizeGoalNotes(store) {
  const { TaskService } = await import('../src/service/task-service.ts');
  const service = new TaskService(store);
  const goal = await service.queryGoal(GOAL);
  const notes = await service.queryNotes(20);
  return {
    validatedGoalAndNotes: true,
    goalId: GOAL, // synthetic test identifier, not a private iWiki document ID
    goalTaskCount: goal.progress.totalTasks,
    goalDoneCount: goal.progress.completedTasks,
    goalPercent: goal.progress.percent,
    goalPhaseCount: goal.goal.phases.length,
    goalMissingReferences: goal.progress.missingTaskIds.length,
    goalMismatchedReferences: goal.progress.mismatchedTaskIds.length,
    goalUnlistedTasks: goal.progress.unlistedTaskIds.length,
    noteCount: notes.length,
    noteContentsEmitted: false,
  };
}

export async function inspectThreeDocs(client, ids) {
  const { OfficialIwikiReadStore } = await import('../src/store/official-iwiki-read.ts');
  const { DOC_PATHS, goalPath } = await import('../src/store/wiki-store.ts');
  const { task, goal, notes } = ids ?? {};
  if (![task, goal, notes].every(id => typeof id === 'string' && ID_PATTERN.test(id)) ||
      new Set([task, goal, notes]).size !== 3) throw Error('INVALID_TEST_DOCUMENT_IDS');
  const map = { [DOC_PATHS.tasks]: task, [goalPath(GOAL)]: goal, [DOC_PATHS.notes]: notes };
  let remoteReads = 0;
  const guardedClient = {
    callTool: async (name, args) => {
      if (name !== 'read_doc' || Object.keys(args).length !== 1 ||
          typeof args.doc_id !== 'string' || !Object.values(map).includes(args.doc_id)) {
        throw Error('READ_ONLY_GUARD');
      }
      if (++remoteReads > 3) throw Error('READ_LIMIT_EXCEEDED');
      return client.callTool(name, args);
    },
  };
  const summary = await summarizeGoalNotes(new OfficialIwikiReadStore(guardedClient, map));
  if (remoteReads !== 3) throw Error('UNEXPECTED_READ_COUNT');
  return {
    ...summary,
    remoteReadCalls: remoteReads, // local guarded client counter, not server-side audit
    remoteWriteCalls: 0,
    note: 'Three explicitly selected test documents; summary contains no document text or IDs.',
  };
}

async function main(args) {
  if (args.length !== 1 || args[0] !== '--live') {
    process.stdout.write('Usage: node tools/probe-goal-notes.mjs --live\n' +
      'Default: no private configuration read, no network activity. Live mode requires 3 TEST document IDs and YES confirmation.\n');
    return;
  }
  if (!process.stdin.isTTY) throw Error('INTERACTIVE_TERMINAL_REQUIRED');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ids = {};
  try {
    process.stdout.write('Use only your THREE non-sensitive dedicated TEST documents. IDs echo locally; never share the full transcript.\n');
    ids.task = (await rl.question('TEST task-table document ID (page-...): ')).trim();
    ids.goal = (await rl.question('TEST goal document ID (page-...): ')).trim();
    ids.notes = (await rl.question('TEST notes document ID (page-...): ')).trim();
    if (![ids.task,ids.goal,ids.notes].every(id => ID_PATTERN.test(id)) ||
        new Set([ids.task,ids.goal,ids.notes]).size !== 3) {
      throw Error('INVALID_TEST_DOCUMENT_IDS');
    }
    const confirm = (await rl.question('Confirm at most 3 read_doc calls and NO writes? type YES: ')).trim();
    if (confirm !== 'YES') throw Error('NOT_CONFIRMED');
  } finally { rl.close(); }

  const config = extractConnection(JSON.parse(await readFile(
    join(homedir(), 'MuSSE-MCP-Local', 'musse-bridge', 'xiaozhi.config.json'), 'utf8'
  )));
  const { IwikiMcpClient } = await import('../src/store/iwiki-mcp-client.ts');
  const summary = await inspectThreeDocs(new IwikiMcpClient(config), ids);
  process.stdout.write('SAFE_GOAL_NOTES_SUMMARY_BEGIN\n' +
    JSON.stringify(summary, null, 2) + '\nSAFE_GOAL_NOTES_SUMMARY_END\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch(() => {
    process.stderr.write('S2-B read-only verification failed; private details suppressed. No writes attempted.\n');
    process.exitCode = 1;
  });
}
