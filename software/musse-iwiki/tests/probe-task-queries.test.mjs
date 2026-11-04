import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { taskCountsFromStore } from '../tools/probe-task-queries.mjs';
import { loadFixtureStore } from '../src/store/local-store.ts';
import { DOC_PATHS } from '../src/store/wiki-store.ts';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const now = new Date('2026-11-03T04:00:00Z');

test('task summary reuses exactly one remote snapshot for multiple read-only queries', async () => {
  const local = await loadFixtureStore(fixture);
  const calls = [];
  const store = {
    read: async (path) => { calls.push(['read', path]); return local.read(path); },
    write: async () => { throw Error('unexpected remote write'); },
    list: async () => { throw Error('unexpected remote listing'); },
  };
  const result = await taskCountsFromStore(store, now);
  assert.deepEqual(calls, [['read', DOC_PATHS.tasks]]);
  assert.equal(result.validatedTaskTable, true);
  assert.equal(result.taskCount, 3);
  assert.equal(result.todoCount, 2);
  assert.equal(result.doneCount, 1);
  assert.equal(result.archivedCount, 0);
  assert.equal(result.todayCount, 0);
  assert.equal(result.upcoming7DaysCount, 1);
  assert.equal(result.overdueCount, 1);
  assert.equal(result.remoteReadCalls, 1);
  assert.equal(result.remoteWriteCalls, 0);
  const output = JSON.stringify(result);
  assert.equal(output.includes('完成 iWiki MCP 调研'), false);
  assert.equal(output.includes('T-20261101-A1'), false);
});

test('invalid real markdown fails instead of returning invented zero tasks', async () => {
  const store = { read: async () => ({path:DOC_PATHS.tasks,content:'# not a table',version:''}) };
  await assert.rejects(taskCountsFromStore(store, now));
});
