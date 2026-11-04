import test from 'node:test';
import assert from 'node:assert/strict';
import { OfficialIwikiReadStore } from '../src/store/official-iwiki-read.ts';

const logicalPath = 'MuSSE 个人管理/任务总表.md';
const docId = 'page-FAKE123';
const envelope = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
const createStore = (fn) => new OfficialIwikiReadStore({callTool: fn}, {[logicalPath]: docId});

test('official read_doc envelope yields exactly the intended document content', async () => {
  const calls = [];
  const original = '# 合成任务表\n| ID | 名称 |\n';
  const store = createStore(async (name, args) => {
    calls.push({name,args});
    return envelope({ ok: true, data: { doc_id: docId, title: 'test-only', content: original, permissions: 'ignored' } });
  });
  const doc = await store.read(logicalPath);
  assert.deepEqual(doc, { path: logicalPath, content: original, version: '' });
  assert.deepEqual(calls, [{name:'read_doc', args:{doc_id:docId}}]);
});

test('server ok:false is not mistaken for success even when content is present', async () => {
  const store = createStore(async () => envelope({ok:false,data:{doc_id:docId,content:'fake'}}));
  await assert.rejects(store.read(logicalPath), {code:'IWIKI_RESPONSE_UNVERIFIED'});
});

test('MCP isError result fails closed without exposing response body', async () => {
  const store = createStore(async () => ({isError:true,content:[{type:'text',text:'PRIVATE_SENTINEL'}]}));
  await assert.rejects(store.read(logicalPath), error => {
    assert.equal(error.code, 'IWIKI_TOOL_ERROR');
    assert.equal(String(error.message).includes('PRIVATE_SENTINEL'), false);
    return true;
  });
});

test('mismatched doc_id and malformed data are rejected', async () => {
  let remote = envelope({ok:true,data:{doc_id:'page-OTHER',content:'incorrect'}});
  const store = createStore(async () => remote);
  await assert.rejects(store.read(logicalPath), {code:'IWIKI_RESPONSE_UNVERIFIED'});
  remote = envelope({ok:true,data:{doc_id:docId,content:{nested:'bad'}}});
  await assert.rejects(store.read(logicalPath), {code:'IWIKI_RESPONSE_UNVERIFIED'});
  remote = {content:[{type:'text',text:'unparseable text'}]};
  await assert.rejects(store.read(logicalPath), {code:'IWIKI_RESPONSE_UNVERIFIED'});
});

test('unmapped path, bad ID, writes and list all fail without network calls', async () => {
  let calls = 0;
  const client = {callTool: async () => {calls++; throw new Error('unexpected call');}};
  const store = new OfficialIwikiReadStore(client, {[logicalPath]: docId});
  await assert.rejects(store.read('another.md'), {code:'UNAVAILABLE'});
  await assert.rejects(store.write(logicalPath, 'x'), {code:'UNAVAILABLE'});
  await assert.rejects(store.list(), {code:'UNAVAILABLE'});
  const invalidStore = new OfficialIwikiReadStore(client, {[logicalPath]:'../untrusted'});
  await assert.rejects(invalidStore.read(logicalPath), {code:'UNAVAILABLE'});
  assert.equal(calls,0);
});
