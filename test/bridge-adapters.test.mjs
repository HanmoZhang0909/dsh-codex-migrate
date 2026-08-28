import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createCodexAdapter, parseCodexJsonl } from '../lib/bridge/adapters/codex.js'
import { createDshAdapter, parseDshConversation } from '../lib/bridge/adapters/dsh.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

test('Codex adapter keeps tools and only the latest regenerated assistant reply', async () => {
  const text = readFileSync(join(fixtures, 'codex-conversation.jsonl'), 'utf8')
  const parsed = parseCodexJsonl(text)

  assert.equal(parsed.conversationId, 'codex-1')
  assert.equal(parsed.projectKey, 'D:\\project-a')
  assert.deepEqual(parsed.turns.filter((turn) => turn.role === 'assistant').map((turn) => turn.content), ['最新版本回答'])
  assert.equal(parsed.turns.some((turn) => turn.toolCalls[0]?.name === 'inspect'), true)

  const appended = []
  const adapter = createCodexAdapter({
    readConversation: async () => text,
    createConversation: async () => 'codex-created',
    appendTurns: async (id, turns) => appended.push({ id, turns }),
    archiveConversation: async () => {},
    executionState: async () => ({ status: 'idle' }),
  })
  const batch = await adapter.readSince('codex-1', { offset: 0 })
  assert.equal(batch.cursor.offset, 5)
  assert.equal((await adapter.createCounterpart({ title: '共享任务' })).conversationId, 'codex-created')
  await adapter.appendTurns('codex-created', batch.turns)
  assert.equal(appended[0].turns.length, batch.turns.length)
})

test('DSH adapter handles project-less archived conversations and duplicate delivery', async () => {
  const fixture = JSON.parse(readFileSync(join(fixtures, 'dsh-conversation.json'), 'utf8'))
  const parsed = parseDshConversation(fixture)
  assert.equal(parsed.projectKey, '')
  assert.equal(parsed.archived, true)
  assert.equal(parsed.turns.length, 2)

  let archived = ''
  const adapter = createDshAdapter({
    readConversation: async () => fixture,
    createConversation: async () => ({ id: 'dsh-created' }),
    appendTurns: async () => {},
    archiveConversation: async (id) => { archived = id },
    executionState: async () => ({ status: 'running', todos: [] }),
  })
  const batch = await adapter.readSince('dsh-1', { offset: 1 })
  assert.equal(batch.turns.length, 1)
  await adapter.archive('dsh-1')
  assert.equal(archived, 'dsh-1')
  assert.equal((await adapter.getExecutionState('dsh-1')).status, 'running')
})
