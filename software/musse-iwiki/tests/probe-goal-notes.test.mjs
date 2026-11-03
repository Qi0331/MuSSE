import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectThreeDocs } from '../tools/probe-goal-notes.mjs';

const ids = {task:'page-FAKETASK',goal:'page-FAKEGOAL',notes:'page-FAKENOTES'};
const taskTable = [
  '# 任务总表',
  '| ID | 名称 | 说明 | 分类 | 优先级 | 状态 | 截止日期 | 截止时间 | 目标ID | 阶段ID | 创建时间 | 完成时间 |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| T-20261103-A101 | SECRET_OVERDUE | test | 测试 | P1 | todo | 2026-11-02 |  |  |  | 2026-11-01 09:00 |  |',
  '| T-20261103-A102 | SECRET_PENDING | test | 测试 | P2 | todo | 2026-11-06 |  | G-001 | P1 | 2026-11-03 10:00 |  |',
  '| T-20261103-A103 | SECRET_DONE | test | 测试 | P3 | done | 2026-11-01 |  | G-001 | P1 | 2026-11-01 09:00 | 2026-11-01 12:00 |',
].join('\n');
const goalDoc = [
  '# 目标：SECRET_GOAL_TITLE',
  '- 目标ID: G-001',
  '- 说明: 测试完成率',
  '## 阶段',
  '### 阶段 P1：测试阶段',
  '- 阶段ID: P1',
  '- 任务: T-20261103-A102, T-20261103-A103',
  '- 手动进度: 测试中',
  '## 进度历史',
  '| 日期 | 进度 | 说明 |',
  '|---|---|---|',
  '| 2026-11-03 | 50% | 虚构历史 |',
].join('\n');
const notesDoc = '# 快捷笔记\n\n## 2026-11-03 11:00\nSECRET_NOTE_ONE\n\n## 2026-11-03 12:00\nSECRET_NOTE_TWO\n';
const data = {[ids.task]:taskTable,[ids.goal]:goalDoc,[ids.notes]:notesDoc};

test('three official read_doc calls compute goal 50% and two notes without leaking contents', async () => {
  const calls = [];
  const client = {callTool: async (name,args) => {
    calls.push({name,args});
    return {content:[{type:'text',text:JSON.stringify({
      ok:true,data:{doc_id:args.doc_id,title:'fake',content:data[args.doc_id]},
    })}]};
  }};
  const result = await inspectThreeDocs(client,ids);
  assert.equal(result.validatedGoalAndNotes,true);
  assert.equal(result.goalId,'G-001');
  assert.equal(result.goalTaskCount,2);
  assert.equal(result.goalDoneCount,1);
  assert.equal(result.goalPercent,50);
  assert.equal(result.goalPhaseCount,1);
  assert.equal(result.goalMissingReferences,0);
  assert.equal(result.goalMismatchedReferences,0);
  assert.equal(result.goalUnlistedTasks,0);
  assert.equal(result.noteCount,2);
  assert.equal(result.remoteReadCalls,3);
  assert.equal(result.remoteWriteCalls,0);
  assert.equal(calls.length,3);
  assert.ok(calls.every(c=>c.name==='read_doc'));
  const resultText=JSON.stringify(result);
  for(const privateValue of ['SECRET_OVERDUE','SECRET_PENDING','SECRET_DONE','SECRET_GOAL_TITLE','SECRET_NOTE_ONE','SECRET_NOTE_TWO','page-FAKE']) {
    assert.equal(resultText.includes(privateValue),false);
  }
});

test('invalid or duplicate document mapping fails before connecting to remote MCP', async () => {
  let calls=0;
  const client={callTool:async()=>{calls++;throw Error('should not call');}};
  await assert.rejects(inspectThreeDocs(client,{task:'page-OK',goal:'page-OK',notes:'page-NOTES'}));
  await assert.rejects(inspectThreeDocs(client,{task:'../invalid',goal:'page-GOAL',notes:'page-NOTES'}));
  assert.equal(calls,0);
});

test('remote ok:false is rejected without revealing private server data', async () => {
  const client={callTool:async()=>({content:[{type:'text',text:JSON.stringify({
    ok:false,error:'SECRET_SERVER_ERROR',data:{content:'SECRET_DOCUMENT'},
  })}]})};
  await assert.rejects(inspectThreeDocs(client,ids), error=>{
    assert.equal(String(error).includes('SECRET_'),false);
    return true;
  });
});
