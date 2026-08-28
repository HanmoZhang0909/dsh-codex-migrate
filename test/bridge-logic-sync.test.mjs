import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createLogic } from '../lib/logic.js'
import { normalizeCodexTurn } from '../lib/bridge/protocol.js'

test('logic coordinator persists an immediately created counterpart after sync', async (t) => {
  const outputDir = mkdtempSync(join(tmpdir(), 'bridge-logic-sync-'))
  t.after(() => rmSync(outputDir, { recursive: true, force: true }))
  const writes = []
  const source = {
    side: 'codex',
    async readSince() {
      return {
        turns: [normalizeCodexTurn({ id: 'user-1', role: 'user', text: '继续', createdAtMs: 1 })],
        cursor: { offset: 1 },
        boundary: 'task_completed',
      }
    },
    async getExecutionState() { return { status: 'idle' } },
  }
  const target = {
    side: 'dsh',
    async createCounterpart() { return { conversationId: 'dsh-created' } },
    async readSince() { return { turns: [], cursor: { offset: 0 } } },
    async appendTurns(id, turns) { writes.push({ id, turns }) },
  }
  const services = { codexConversationAdapter: source, dshConversationAdapter: target }
  const ctx = {
    get: (name) => services[name],
    interval: () => () => {},
    timeout: () => {},
  }
  const logic = createLogic(ctx, { outputDir, bridgeEnabled: false }, outputDir)
  await logic.init()
  const registered = await logic.registerBridgeConversation({ codexConversationId: 'codex-1', syncPolicy: 'task_turn' })
  const result = await logic.syncBridgeConversation({ bridgeId: registered.bridgeId, sourceSide: 'codex' })

  assert.equal(result.appended, 1)
  assert.equal(writes[0].id, 'dsh-created')
  assert.equal(logic.getBridgeConversation({ bridgeId: registered.bridgeId }).dshConversationId, 'dsh-created')
})

test('logic exposes replayable lease operations that reject simultaneous writers', async (t) => {
  const outputDir = mkdtempSync(join(tmpdir(), 'bridge-logic-lease-'))
  t.after(() => rmSync(outputDir, { recursive: true, force: true }))
  const ctx = { get: () => undefined, interval: () => () => {}, timeout: () => {} }
  const logic = createLogic(ctx, { outputDir, bridgeEnabled: false }, outputDir)
  await logic.init()
  const record = await logic.registerBridgeConversation({ codexConversationId: 'codex-lock' })
  const leased = await logic.acquireBridgeLease({ bridgeId: record.bridgeId, side: 'dsh', token: 'lease-dsh', ttlMs: 5000 })
  assert.equal(leased.lease.owner, 'dsh')
  await assert.rejects(() => logic.acquireBridgeLease({ bridgeId: record.bridgeId, side: 'codex', token: 'lease-codex', ttlMs: 5000 }), /LEASE_HELD/)
  const renewed = await logic.heartbeatBridgeLease({ bridgeId: record.bridgeId, token: 'lease-dsh', ttlMs: 5000 })
  assert.equal(renewed.lease.token, 'lease-dsh')
  const released = await logic.releaseBridgeLease({ bridgeId: record.bridgeId, token: 'lease-dsh' })
  assert.equal(released.lease, null)
})

test('bridge messages keep the caller id and ignore replayed offline duplicates', async (t) => {
  const outputDir = mkdtempSync(join(tmpdir(), 'bridge-logic-message-'))
  t.after(() => rmSync(outputDir, { recursive: true, force: true }))
  const ctx = { get: () => undefined, interval: () => () => {}, timeout: () => {} }
  const logic = createLogic(ctx, { outputDir, bridgeEnabled: false }, outputDir)
  await logic.init()
  const record = await logic.registerBridgeConversation({ codexConversationId: 'codex-offline' })

  const first = await logic.sendBridgeMessage({ bridgeId: record.bridgeId, messageId: 'offline-message-1', text: '离线补充要求' })
  const replayed = await logic.sendBridgeMessage({ bridgeId: record.bridgeId, messageId: 'offline-message-1', text: '离线补充要求' })

  assert.equal(first.pendingMessages.length, 1)
  assert.equal(replayed.pendingMessages.length, 1)
  assert.equal(replayed.pendingMessages[0].id, 'offline-message-1')
  assert.equal(replayed.messages.filter((message) => message.id === 'offline-message-1').length, 1)
})

test('registers all or selected project conversations and immediately creates Codex counterparts', async (t) => {
  const outputDir = mkdtempSync(join(tmpdir(), 'bridge-logic-scope-'))
  t.after(() => rmSync(outputDir, { recursive: true, force: true }))
  const created = []
  const codexAdapter = {
    side: 'codex',
    async createCounterpart(seed) {
      created.push(seed)
      return { conversationId: `codex-created-${created.length}` }
    },
  }
  const ctx = {
    get: (name) => name === 'codexConversationAdapter' ? codexAdapter : undefined,
    interval: () => () => {}, timeout: () => {},
  }
  const logic = createLogic(ctx, { outputDir, bridgeEnabled: false }, outputDir)
  await logic.init()
  const sessions = [
    { id: 'dsh-1', projectKey: 'project-a', title: '一' },
    { id: 'dsh-2', projectKey: 'project-a', title: '二' },
    { id: 'dsh-3', projectKey: 'project-b', title: '三' },
  ]

  const selected = await logic.registerBridgeScope({
    registrationMode: 'selected', projectKey: 'project-a', selectedConversationIds: ['dsh-2'], sessions,
  })
  assert.equal(selected.conversations.length, 1)
  assert.equal(selected.conversations[0].dshConversationId, 'dsh-2')
  assert.equal(selected.conversations[0].codexConversationId, 'codex-created-1')

  const all = await logic.registerBridgeScope({ registrationMode: 'project_all', projectKey: 'project-a', sessions })
  assert.equal(all.conversations.length, 2)
  assert.equal(all.futureConversations, true)
  assert.equal(created.length, 2, 'the already registered selected conversation is reused')

  const future = await logic.observeBridgeConversation({ id: 'dsh-future', projectKey: 'project-a', title: '未来对话' })
  assert.equal(future.registrationMode, 'project_all')
  assert.equal(future.dshConversationId, 'dsh-future')
  assert.equal(future.codexConversationId, 'codex-created-3')
})

test('continue actions create the missing counterpart but stay idle until the target starts work', async (t) => {
  const outputDir = mkdtempSync(join(tmpdir(), 'bridge-logic-continue-'))
  t.after(() => rmSync(outputDir, { recursive: true, force: true }))
  const created = []
  const services = {
    codexConversationAdapter: {
      side: 'codex',
      async createCounterpart(seed) { created.push(['codex', seed]); return { conversationId: 'codex-real-counterpart' } },
    },
    dshConversationAdapter: {
      side: 'dsh',
      async createCounterpart(seed) { created.push(['dsh', seed]); return { conversationId: 'dsh-real-counterpart' } },
    },
  }
  const ctx = { get: (name) => services[name], interval: () => () => {}, timeout: () => {} }
  const logic = createLogic(ctx, { outputDir, bridgeEnabled: false }, outputDir)
  await logic.init()

  const fromCodex = await logic.registerBridgeConversation({ codexConversationId: 'codex-source', title: 'Codex source' })
  const inDsh = await logic.continueBridgeConversation({ bridgeId: fromCodex.bridgeId })
  assert.equal(inDsh.dshConversationId, 'dsh-real-counterpart')
  assert.equal(inDsh.activeSide, 'none')
  assert.equal(inDsh.status, 'pending')
  assert.match(inDsh.navigationRequestId, /^navigation-/)

  const fromDsh = await logic.registerBridgeConversation({ dshConversationId: 'dsh-source', title: 'DSH source' })
  const inCodex = await logic.continueBridgeInCodex({ bridgeId: fromDsh.bridgeId })
  assert.equal(inCodex.codexConversationId, 'codex-real-counterpart')
  assert.equal(inCodex.activeSide, 'none')
  assert.deepEqual(created.map(([side]) => side), ['dsh', 'codex'])
})

test('logic reuses compatible memory providers or falls back to incremental embedded memory', async (t) => {
  const outputDir = mkdtempSync(join(tmpdir(), 'bridge-logic-memory-'))
  t.after(() => rmSync(outputDir, { recursive: true, force: true }))
  const source = {
    side: 'codex',
    async readSince() {
      return {
        turns: [normalizeCodexTurn({ id: 'assistant-memory', role: 'assistant', text: '完成', createdAtMs: 1 })],
        cursor: { offset: 1 }, boundary: 'task_completed',
        memoryMutations: { upserts: [{ id: 'preference-1', content: '默认使用中文', kind: 'preference' }] },
      }
    },
    async getExecutionState() { return { status: 'idle' } },
  }
  const target = {
    side: 'dsh',
    async createCounterpart() { return { conversationId: 'dsh-memory' } },
    async readSince() { return { turns: [], cursor: { offset: 0 } } },
    async appendTurns() {},
  }
  const services = { codexConversationAdapter: source, dshConversationAdapter: target }
  const ctx = { get: (name) => services[name], interval: () => () => {}, timeout: () => {} }
  const logic = createLogic(ctx, { outputDir, bridgeEnabled: false, bridgeMemoryProvider: 'auto' }, outputDir)
  await logic.init()
  const record = await logic.registerBridgeConversation({ codexConversationId: 'codex-memory' })
  const result = await logic.syncBridgeConversation({ bridgeId: record.bridgeId, sourceSide: 'codex' })
  const memoryPath = join(outputDir, 'bridge', 'memory.jsonl')

  assert.equal(result.memory.flushed, true)
  assert.equal(existsSync(memoryPath), true)
  assert.match(readFileSync(memoryPath, 'utf8'), /默认使用中文/)
  assert.equal(logic.getBridgeConversation({ bridgeId: record.bridgeId }).memoryProviderId, 'embedded-jsonl')
})
