import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ARCHIVE_POLICY,
  BRIDGE_STATUS,
  REGISTRATION_MODE,
  SYNC_POLICY,
  createBridgeEvent,
  createBridgeState,
  normalizeCodexTurn,
  normalizeDshTurn,
  reduceBridgeEvent,
} from '../lib/bridge/protocol.js'

const registered = (overrides = {}) => createBridgeEvent({
  bridgeId: 'bridge-test',
  type: 'conversation.registered',
  baseRevision: 0,
  side: 'codex',
  idempotencyKey: 'register-1',
  createdAtMs: 1000,
  payload: {
    codexConversationId: 'codex-1',
    projectKey: 'project-a',
    registrationMode: REGISTRATION_MODE.PROJECT_ALL,
    syncPolicy: SYNC_POLICY.TASK_TURN,
    archivePolicy: ARCHIVE_POLICY.MANUAL,
    ...overrides,
  },
})

test('registers a canonical shared conversation with frozen policy defaults', () => {
  const state = reduceBridgeEvent(createBridgeState(), registered())
  const conversation = state.conversations['bridge-test']

  assert.equal(conversation.status, BRIDGE_STATUS.READY)
  assert.equal(conversation.activeSide, 'none')
  assert.equal(conversation.revision, 1)
  assert.equal(conversation.registrationMode, REGISTRATION_MODE.PROJECT_ALL)
  assert.equal(conversation.syncPolicy, SYNC_POLICY.TASK_TURN)
  assert.equal(conversation.archivePolicy, ARCHIVE_POLICY.MANUAL)
  assert.equal(state.revision, 1)
})

test('creates deterministic event IDs from the idempotency boundary', () => {
  const first = registered()
  const second = registered()
  const changed = registered({ projectKey: 'project-b' })

  assert.equal(first.eventId, second.eventId)
  assert.notEqual(first.eventId, changed.eventId)
  assert.match(first.eventId, /^evt-[a-f0-9]{32}$/)
})

test('ignores an already applied event without changing revisions', () => {
  const event = registered()
  const once = reduceBridgeEvent(createBridgeState(), event)
  const twice = reduceBridgeEvent(once, event)

  assert.deepEqual(twice, once)
  assert.equal(twice.revision, 1)
})

test('rejects stale base revisions instead of silently overwriting state', () => {
  const state = reduceBridgeEvent(createBridgeState(), registered())
  const stale = createBridgeEvent({
    bridgeId: 'bridge-test',
    type: 'status.updated',
    baseRevision: 0,
    side: 'dsh',
    idempotencyKey: 'stale-status',
    createdAtMs: 1100,
    payload: { status: BRIDGE_STATUS.RUNNING, activeSide: 'dsh' },
  })

  assert.throws(() => reduceBridgeEvent(state, stale), /REVISION_CONFLICT/)
})

test('normalizes Codex and DSH turns to the same stable hash', () => {
  const codex = normalizeCodexTurn({
    id: 'codex-turn-1',
    role: 'assistant',
    text: '同步完成',
    createdAtMs: 1200,
    toolCalls: [{ name: 'sync', arguments: { scope: 'project-a' } }],
  })
  const dsh = normalizeDshTurn({
    id: 'dsh-event-99',
    role: 'assistant',
    content: '同步完成',
    createdAtMs: 1200,
    tools: [{ name: 'sync', arguments: { scope: 'project-a' } }],
  })

  assert.equal(codex.hash, dsh.hash)
  assert.equal(codex.content, '同步完成')
  assert.equal(dsh.toolCalls[0].name, 'sync')
})

test('appends canonical turns once and advances the conversation revision', () => {
  let state = reduceBridgeEvent(createBridgeState(), registered())
  const turn = normalizeCodexTurn({ id: 'turn-1', role: 'user', text: '继续', createdAtMs: 1300 })
  const append = createBridgeEvent({
    bridgeId: 'bridge-test',
    type: 'turns.appended',
    baseRevision: 1,
    side: 'codex',
    idempotencyKey: 'append-turn-1',
    createdAtMs: 1301,
    payload: { turns: [turn] },
  })
  state = reduceBridgeEvent(state, append)

  assert.equal(state.conversations['bridge-test'].turns.length, 1)
  assert.equal(state.conversations['bridge-test'].revision, 2)
  assert.equal(state.conversations['bridge-test'].lastCommonTurnId, 'turn-1')
})

test('validates policies and statuses at the protocol boundary', () => {
  assert.throws(() => registered({ syncPolicy: 'always' }), /syncPolicy/)

  assert.throws(() => createBridgeEvent({
    bridgeId: 'bridge-test',
    type: 'status.updated',
    baseRevision: 1,
    side: 'dsh',
    idempotencyKey: 'invalid-status',
    createdAtMs: 1400,
    payload: { status: 'finished-ish' },
  }), /status/)
})

test('keeps monitor metadata inside the canonical conversation revision', () => {
  let state = reduceBridgeEvent(createBridgeState(), registered({ title: '共享任务' }))
  assert.equal(state.conversations['bridge-test'].title, '共享任务')

  const metadata = createBridgeEvent({
    bridgeId: 'bridge-test',
    type: 'metadata.updated',
    baseRevision: 1,
    side: 'dsh',
    idempotencyKey: 'metadata-1',
    createdAtMs: 1500,
    payload: {
      summary: 'DSH 正在推进',
      todos: [{ id: 'todo-1', text: '同步状态', status: 'in_progress' }],
      messages: [{ id: 'message-1', role: 'dsh', text: '已接收。', createdAtMs: 1490 }],
    },
  })
  state = reduceBridgeEvent(state, metadata)

  assert.equal(state.conversations['bridge-test'].summary, 'DSH 正在推进')
  assert.equal(state.conversations['bridge-test'].todos[0].status, 'in_progress')
  assert.equal(state.conversations['bridge-test'].messages[0].text, '已接收。')
  assert.equal(state.conversations['bridge-test'].revision, 2)
})
