import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCodexTurn } from '../lib/bridge/protocol.js'
import { createSyncEngine, shouldFlushBatch } from '../lib/bridge/sync-engine.js'

function turn(id, role, content, at) {
  return normalizeCodexTurn({ id, role, text: content, createdAtMs: at })
}

function sourceAdapter(batches) {
  let index = 0
  return {
    side: 'codex',
    async readSince() { return batches[Math.min(index++, batches.length - 1)] },
    async getExecutionState() { return { status: 'idle' } },
  }
}

function targetAdapter(existing = []) {
  const writes = []
  return {
    side: 'dsh', writes,
    async createCounterpart() { return { conversationId: 'dsh-created' } },
    async readSince() { return { turns: existing, cursor: { offset: existing.length } } },
    async appendTurns(id, turns, options) { writes.push({ id, turns, options }) },
  }
}

test('task-turn policy waits for a boundary, creates the counterpart immediately, and flushes pending turns once', async () => {
  const user = turn('u1', 'user', '开始', 1)
  const answer = turn('a1', 'assistant', '完成', 2)
  const source = sourceAdapter([
    { turns: [user], cursor: { offset: 1 }, boundary: 'none' },
    { turns: [answer], cursor: { offset: 2 }, boundary: 'round_completed' },
  ])
  const target = targetAdapter()
  const engine = createSyncEngine()
  const conversation = { bridgeId: 'bridge-1', syncPolicy: 'task_turn', codexConversationId: 'codex-1', dshConversationId: '' }

  const waiting = await engine.syncOnce({ conversation, source, target })
  assert.equal(waiting.counterpartId, 'dsh-created')
  assert.equal(waiting.flushed, false)
  const flushed = await engine.syncOnce({ conversation: { ...conversation, dshConversationId: 'dsh-created' }, source, target })
  assert.equal(flushed.flushed, true)
  assert.deepEqual(target.writes[0].turns.map((item) => item.turnId), ['u1', 'a1'])
})

test('agent-message policy flushes each assistant delivery and canonical hashes prevent loops', async () => {
  const answer = turn('a1', 'assistant', '完成', 2)
  const source = sourceAdapter([{ turns: [answer, answer], cursor: { offset: 2 }, boundary: 'agent_message' }])
  const target = targetAdapter([answer])
  const result = await createSyncEngine().syncOnce({
    conversation: { bridgeId: 'bridge-2', syncPolicy: 'agent_message', codexConversationId: 'codex-1', dshConversationId: 'dsh-1' },
    source,
    target,
  })
  assert.equal(result.flushed, true)
  assert.equal(result.appended, 0)
  assert.equal(target.writes.length, 0)
})

test('sync policy boundaries are explicit', () => {
  assert.equal(shouldFlushBatch('task_turn', { boundary: 'task_completed', turns: [] }), true)
  assert.equal(shouldFlushBatch('task_turn', { boundary: 'agent_message', turns: [turn('a', 'assistant', 'x', 1)] }), false)
  assert.equal(shouldFlushBatch('agent_message', { boundary: 'agent_message', turns: [turn('a', 'assistant', 'x', 1)] }), true)
})

test('sync engine forwards only explicit memory mutations at the same boundary, never raw chat turns', async () => {
  const staged = []
  const memoryCoordinator = {
    stageUpserts(items) { staged.push(['upsert', items]) },
    stageDeletes(ids) { staged.push(['delete', ids]) },
    async flush(boundary) { staged.push(['flush', boundary]); return { flushed: true } },
  }
  const source = sourceAdapter([{
    turns: [turn('u1', 'user', '普通聊天内容', 1)], cursor: { offset: 1 }, boundary: 'task_completed',
    memoryMutations: { upserts: [{ id: 'm1', content: '明确记忆' }], deletes: ['m0'] },
  }])
  const target = targetAdapter()
  await createSyncEngine().syncOnce({
    conversation: { bridgeId: 'bridge-memory', syncPolicy: 'task_turn', codexConversationId: 'codex-1', dshConversationId: 'dsh-1' },
    source, target, memoryCoordinator,
  })
  assert.deepEqual(staged, [
    ['upsert', [{ id: 'm1', content: '明确记忆' }]],
    ['delete', ['m0']],
    ['flush', 'task_completed'],
  ])
})
