import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReadResult, probeRead } from '../tools/probe-read-structure.mjs';

test('response shape redacts document text and arbitrary private keys', () => {
  const privateContent = 'PRIVATE_DOCUMENT_SENTINEL';
  const result = summarizeReadResult({
    structuredContent: { content: privateContent, title: 'SECRET_TITLE', 'PERSONAL_ID': 'SENSITIVE' },
    content: [{ type: 'text', text: JSON.stringify({ content: privateContent, doc_id: 'SECRET_ID', noteWithRealName: 'SENSITIVE' }) }],
  });
  const output = JSON.stringify(result);
  assert.equal(result.success, true);
  assert.equal(output.includes('PRIVATE_DOCUMENT_SENTINEL'), false);
  assert.equal(output.includes('SECRET_TITLE'), false);
  assert.equal(output.includes('SENSITIVE'), false);
  assert.equal(output.includes('SECRET_ID'), false);
  assert.equal(output.includes('PERSONAL_ID'), false);
  assert.equal(output.includes('noteWithRealName'), false);
  assert.equal(result.structuredContent.fields.content, 'string');
});

test('errors never include original error bodies', () => {
  const output = JSON.stringify(summarizeReadResult({ isError: true, content: [{ type: 'text', text: 'PRIVATE_TOKEN' }] }));
  assert.equal(output.includes('PRIVATE_TOKEN'), false);
  assert.equal(summarizeReadResult({ isError: true }).success, false);
});

test('probe invokes exactly one read_doc with the explicitly selected field', async () => {
  const calls = [];
  const client = { callTool: async (name, args) => { calls.push({name,args}); return { content: [{ type: 'text', text: 'a test string' }] }; }};
  const result = await probeRead(client, 'doc_id', 'FAKE_DOC');
  assert.deepEqual(calls, [{ name: 'read_doc', args: { doc_id: 'FAKE_DOC' } }]);
  assert.equal(result.success, true);
  await assert.rejects(probeRead(client, 'write_doc', 'FAKE_DOC'));
  assert.equal(calls.length, 1);
});
