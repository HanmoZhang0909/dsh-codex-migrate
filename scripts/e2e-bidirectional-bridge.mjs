import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLogic } from '../lib/logic.js'
import { normalizeCodexTurn } from '../lib/bridge/protocol.js'

const outputDir = mkdtempSync(join(tmpdir(), 'dsh-codex-e2e-'))
const codex = new Map()
const dsh = new Map()
let createdCodex = 0
let createdDsh = 0

function adapter(side, own, other) {
  return {
    side,
    async createCounterpart(seed) {
      const id = side === 'codex' ? `codex-e2e-${++createdCodex}` : `dsh-e2e-${++createdDsh}`
      own.set(id, { turns: [], boundary: 'round_completed', seed })
      return { conversationId: id }
    },
    async readSince(id, cursor = { offset: 0 }) {
      const conversation = own.get(id) || { turns: [], boundary: 'none' }
      const offset = Number(cursor.offset || 0)
      return {
        turns: conversation.turns.slice(offset), cursor: { offset: conversation.turns.length },
        boundary: conversation.boundary, memoryMutations: conversation.memoryMutations,
      }
    },
    async appendTurns(id, turns) {
      const conversation = own.get(id) || { turns: [], boundary: 'round_completed' }
      const seen = new Set(conversation.turns.map((turn) => turn.hash))
      for (const turn of turns) if (!seen.has(turn.hash)) conversation.turns.push(turn)
      own.set(id, conversation)
    },
    async archive(id) { const conversation = own.get(id); if (conversation) conversation.archived = true },
    async getExecutionState() { return { status: 'idle' } },
  }
}

const services = {
  codexConversationAdapter: adapter('codex', codex, dsh),
  dshConversationAdapter: adapter('dsh', dsh, codex),
}
const ctx = { get: (name) => services[name], interval: () => () => {}, timeout: () => {} }

try {
  codex.set('codex-source', {
    turns: [
      normalizeCodexTurn({ id: 'u1', role: 'user', text: '实现双向同步', createdAtMs: 1 }),
      normalizeCodexTurn({ id: 'a1', role: 'assistant', text: '开始执行', createdAtMs: 2 }),
    ],
    boundary: 'task_completed',
    memoryMutations: { upserts: [{ id: 'm1', content: '用户偏好中文', kind: 'preference' }] },
  })
  const logic = createLogic(ctx, { outputDir, bridgeEnabled: false }, outputDir)
  await logic.init()

  const single = await logic.registerBridgeConversation({ codexConversationId: 'codex-source', syncPolicy: 'task_turn' })
  const firstSync = await logic.syncBridgeConversation({ bridgeId: single.bridgeId, sourceSide: 'codex' })
  assert.equal(firstSync.flushed, true)
  assert.equal(firstSync.appended, 2)
  assert.equal(dsh.get(firstSync.counterpartId).turns.length, 2)
  assert.equal(firstSync.memory.flushed, true)

  const scopes = await logic.registerBridgeScope({
    registrationMode: 'project_all', projectKey: 'project-e2e',
    sessions: [
      { id: 'dsh-project-1', projectKey: 'project-e2e', title: '项目一' },
      { id: 'dsh-project-2', projectKey: 'project-e2e', title: '项目二' },
    ],
  })
  assert.equal(scopes.conversations.length, 2)
  assert.equal(scopes.futureConversations, true)
  const future = await logic.observeBridgeConversation({ id: 'dsh-project-future', projectKey: 'project-e2e', title: '后来新建的对话' })
  assert.equal(future.registrationMode, 'project_all')
  assert.match(future.codexConversationId, /^codex-e2e-/)

  const running = await logic.continueBridgeConversation({ bridgeId: single.bridgeId, leaseToken: 'lease-dsh-e2e' })
  assert.equal(running.activeSide, 'none')
  await logic.acquireBridgeLease({ bridgeId: single.bridgeId, side: 'dsh', token: 'lease-dsh-e2e' })
  await logic.updateBridgeConversation({ bridgeId: single.bridgeId, status: 'running', summary: 'DSH 正在处理' })
  await assert.rejects(() => logic.acquireBridgeLease({ bridgeId: single.bridgeId, side: 'codex', token: 'lease-codex-e2e' }), /LEASE_HELD/)
  await logic.sendBridgeMessage({ bridgeId: single.bridgeId, messageId: 'offline-e2e', text: '补充一个边界条件' })
  const duplicate = await logic.sendBridgeMessage({ bridgeId: single.bridgeId, messageId: 'offline-e2e', text: '补充一个边界条件' })
  assert.equal(duplicate.pendingMessages.filter((message) => message.id === 'offline-e2e').length, 1)
  const takeover = await logic.takeOverBridgeConversation({ bridgeId: single.bridgeId })
  assert.equal(takeover.activeSide, 'none')

  await logic.createBridgeBranch({ bridgeId: single.bridgeId, side: 'codex', branchBridgeId: 'branch-local', sourceTurnId: 'a1', sync: false })
  await logic.detectBridgeConflict({
    bridgeId: single.bridgeId,
    codexTurns: [{ turnId: 'same' }, { turnId: 'codex-tail' }],
    dshTurns: [{ turnId: 'same' }, { turnId: 'dsh-tail' }],
    lastCommonTurnId: 'same',
  })
  assert.equal(logic.getBridgeConversation({ bridgeId: single.bridgeId }).status, 'conflict')
  const resolved = await logic.resolveBridgeConflict({ bridgeId: single.bridgeId, selectedSide: 'dsh' })
  assert.equal(resolved.status, 'paused')

  const automatic = await logic.registerBridgeConversation({ dshConversationId: 'auto-archive', archivePolicy: 'automatic' })
  const archived = await logic.archiveBridgeConversation({ bridgeId: automatic.bridgeId, side: 'dsh' })
  assert.equal(archived.archived, true)

  logic.dispose()
  const restarted = createLogic(ctx, { outputDir, bridgeEnabled: false }, outputDir)
  await restarted.init()
  assert.equal(restarted.getBridgeConversation({ bridgeId: single.bridgeId }).bridgeId, single.bridgeId)
  assert.equal(restarted.getState({}).bridge.scopes[0].futureConversations, true)
  restarted.dispose()

  process.stdout.write('bidirectional bridge e2e passed\n')
} finally {
  rmSync(outputDir, { recursive: true, force: true })
}
