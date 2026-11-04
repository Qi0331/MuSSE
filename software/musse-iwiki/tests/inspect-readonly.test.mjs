import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractConnection, summarizeTools, inspectFromFile } from '../tools/inspect-readonly.mjs';

const config = {
  mcpServers: { iwiki: { type: 'http', url: 'https://ssemarket.cn/iwiki-api/mcp',
    headers: { Authorization: 'Bearer FAKE_SECRET_SENTINEL' } } },
};

test('read-only config accepts only the known official endpoint and Bearer token', () => {
  assert.equal(extractConnection(config).token, 'FAKE_SECRET_SENTINEL');
  assert.throws(() => extractConnection({mcpServers: { iwiki: {...config.mcpServers.iwiki, url: 'https://evil.example/mcp'} }}));
  assert.throws(() => extractConnection({mcpServers: { iwiki: {...config.mcpServers.iwiki, headers: { Authorization: 'Bearer secret with spaces'} } }}));
});

test('summary does not expose tool descriptions, schema examples, hidden tools, or document details', () => {
  const result = summarizeTools([
    { name: 'list_spaces', description: 'private document title', inputSchema: {
      properties: { page: { type: 'integer', default: 'PRIVATE_VALUE' }, 'private/name': {} }, required: ['page'] } },
    { name: 'write_doc', description: 'sensitive server data', inputSchema: { properties: { secret: {} } } },
  ]);
  const printed = JSON.stringify(result);
  assert.equal(result.totalAdvertisedTools, 2);
  assert.deepEqual(result.queries[0], {name: 'list_spaces', present: true, fields: ['page'], required: ['page']});
  assert.equal(result.queries[1].present, false);
  for (const needle of ['private document title', 'PRIVATE_VALUE', 'sensitive server data', 'write_doc', 'private/name']) {
    assert.equal(printed.includes(needle), false);
  }
});

test('live inspection requests only listTools, never calls any tool', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'musse-s2a-test-'));
  try {
    const path = join(dir, 'local-private.json');
    await writeFile(path, JSON.stringify(config));
    let listed = 0;
    let called = 0;
    const result = await inspectFromFile(path, (params) => {
      assert.equal(params.token, 'FAKE_SECRET_SENTINEL');
      return { listTools: async () => {listed++; return [{name:'read_doc', inputSchema: { properties:{doc_id:{type:'string'}} }}];},
        callTool: async () => {called++; throw Error('write or read not allowed');} };
    });
    assert.equal(listed, 1);
    assert.equal(called, 0);
    assert.equal(result.queries.find((x)=>x.name==='read_doc').present, true);
    assert.equal(JSON.stringify(result).includes('FAKE_SECRET_SENTINEL'), false);
  } finally {
    await rm(dir, {recursive:true, force:true});
  }
});
