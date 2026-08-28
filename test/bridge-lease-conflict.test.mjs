import assert from 'node:assert/strict'
import test from 'node:test'
import {
  acquireLease,
  heartbeatLease,
  isLeaseLive,
  releaseLease,
} from '../lib/bridge/lease.js'
import {
  detectConflict,
  findFirstDivergence,
  resolveConflict,
} from '../lib/bridge/conflicts.js'
import {
  ARCHIVE_POLICY,
  BRIDGE_STATUS,
  createBridgeEvent,
  createBridgeState,
  normalizeCodexTurn,
  normalizeDshTurn,
  reduceBridgeEvent,
} from '../lib/bridge/protocol.js'

function conversation(overrides = {}) {
  return {
    bridgeId: 'bridge-lock',
    status: BRIDGE_STATUS.READY,
    activeSide: 'none',
    revision: 1,
    lease: null,
    turns: [],
    lastCommonTurnId: '',
    archivePolicy: ARCHIVE_POLICY.MANUAL,
    ...overrides,
  }
}

test('prevents a second writer while the first lease is live', () => {
  const dsh = acquireLease(conversation(), 'dsh', 1000, 5000, 'lease-dsh')
  assert.equal(dsh.activeSide, 'dsh')
  assert.equal(dsh.status, BRIDGE_STATUS.RUNNING)
  assert.equal(isLeaseLive(dsh.lease, 5999), true)
  assert.throws(() => acquireLease(dsh, 'codex', 2000, 5000, 'lease-codex'), /LEASE_HELD/)
})

test('renews a valid heartbeat and rejects stale lease tokens', () => {
  const leased = acquireLease(conversation(), 'dsh', 1000, 5000, 'lease-dsh')
  const renewed = heartbeatLease(leased, 'lease-dsh', 3000, 5000)
  assert.equal(renewed.lease.expiresAtMs, 8000)
  assert.throws(() => heartbeatLease(renewed, 'old-token', 4000, 5000), /LEASE_TOKEN_INVALID/)
  assert.throws(() => releaseLease(renewed, 'old-token', 4000), /LEASE_TOKEN_INVALID/)
})

test('allows takeover after expiry and pauses when the owner releases', () => {
  const dsh = acquireLease(conversation(), 'dsh', 1000, 1000, 'lease-dsh')
  const codex = acquireLease(dsh, 'codex', 2001, 1000, 'lease-codex')
  assert.equal(codex.activeSide, 'codex')
  assert.equal(codex.lease.token, 'lease-codex')

  const released = releaseLease(codex, 'lease-codex', 2200)
  assert.equal(released.lease, null)
  assert.equal(released.activeSide, 'none')
  assert.equal(released.status, BRIDGE_STATUS.PAUSED)
})

test('finds the first differing turn after the last common turn', () => {
  const common = normalizeCodexTurn({ id: 'common', role: 'user', text: '开始', createdAtMs: 1 })
  const codexReply = normalizeCodexTurn({ id: 'codex-reply', role: 'assistant', text: 'Codex 方案', createdAtMs: 2 })
  const dshReply = normalizeDshTurn({ id: 'dsh-reply', role: 'assistant', content: 'DSH 方案', createdAtMs: 2 })
  const difference = findFirstDivergence([common, codexReply], [common, dshReply], 'common')

  assert.equal(difference.index, 1)
  assert.equal(difference.codexTurn.turnId, 'codex-reply')
  assert.equal(difference.dshTurn.turnId, 'dsh-reply')
})

test('pauses on conflict and keeps only the selected canonical history visible', () => {
  const common = normalizeCodexTurn({ id: 'common', role: 'user', text: '开始', createdAtMs: 1 })
  const codexReply = normalizeCodexTurn({ id: 'codex-reply', role: 'assistant', text: 'Codex 方案', createdAtMs: 2 })
  const dshReply = normalizeDshTurn({ id: 'dsh-reply', role: 'assistant', content: 'DSH 方案', createdAtMs: 2 })
  const conflicted = detectConflict(conversation({ turns: [common] }), {
    codexTurns: [common, codexReply],
    dshTurns: [common, dshReply],
    lastCommonTurnId: 'common',
    detectedAtMs: 3000,
  })

  assert.equal(conflicted.status, BRIDGE_STATUS.CONFLICT)
  assert.equal(conflicted.activeSide, 'none')
  assert.equal(conflicted.conflict.firstDivergenceIndex, 1)

  const resolved = resolveConflict(conflicted, 'dsh', 4000)
  assert.deepEqual(resolved.turns.map((turn) => turn.turnId), ['common', 'dsh-reply'])
  assert.equal(resolved.status, BRIDGE_STATUS.PAUSED)
  assert.equal(resolved.conflict.resolution.selectedSide, 'dsh')
  assert.equal(resolved.conflict.recovery.codexTurns[1].turnId, 'codex-reply')
})

test('records branch decisions and archive behavior through protocol events', () => {
  const register = createBridgeEvent({
    bridgeId: 'bridge-lock', type: 'conversation.registered', baseRevision: 0,
    side: 'codex', idempotencyKey: 'register', createdAtMs: 1,
    payload: { archivePolicy: ARCHIVE_POLICY.MANUAL },
  })
  let state = reduceBridgeEvent(createBridgeState(), register)
  const branch = createBridgeEvent({
    bridgeId: 'bridge-lock', type: 'branch.created', baseRevision: 1,
    side: 'codex', idempotencyKey: 'branch-1', createdAtMs: 2,
    payload: { branchBridgeId: 'bridge-child', sourceTurnId: 'turn-1', sync: true },
  })
  state = reduceBridgeEvent(state, branch)
  assert.deepEqual(state.conversations['bridge-lock'].branches[0], {
    branchBridgeId: 'bridge-child', sourceTurnId: 'turn-1', sync: true,
  })

  const archive = createBridgeEvent({
    bridgeId: 'bridge-lock', type: 'archive.requested', baseRevision: 2,
    side: 'dsh', idempotencyKey: 'archive-1', createdAtMs: 3,
    payload: {},
  })
  state = reduceBridgeEvent(state, archive)
  assert.equal(state.conversations['bridge-lock'].archivePending, true)
  assert.equal(state.conversations['bridge-lock'].archived, false)
  assert.equal(state.conversations['bridge-lock'].status, BRIDGE_STATUS.PAUSED)
})

test('persists lease lifecycle and conflict choice as replayable protocol events', () => {
  let state = reduceBridgeEvent(createBridgeState(), createBridgeEvent({
    bridgeId: 'bridge-lock', type: 'conversation.registered', baseRevision: 0,
    side: 'codex', idempotencyKey: 'register-events', createdAtMs: 1, payload: {},
  }))
  state = reduceBridgeEvent(state, createBridgeEvent({
    bridgeId: 'bridge-lock', type: 'lease.acquired', baseRevision: 1,
    side: 'dsh', idempotencyKey: 'lease-acquire', createdAtMs: 1000,
    payload: { token: 'lease-dsh', ttlMs: 5000 },
  }))
  assert.equal(state.conversations['bridge-lock'].lease.owner, 'dsh')
  state = reduceBridgeEvent(state, createBridgeEvent({
    bridgeId: 'bridge-lock', type: 'lease.heartbeat', baseRevision: 2,
    side: 'dsh', idempotencyKey: 'lease-heartbeat', createdAtMs: 2000,
    payload: { token: 'lease-dsh', ttlMs: 5000 },
  }))
  assert.equal(state.conversations['bridge-lock'].lease.expiresAtMs, 7000)
  state = reduceBridgeEvent(state, createBridgeEvent({
    bridgeId: 'bridge-lock', type: 'lease.released', baseRevision: 3,
    side: 'dsh', idempotencyKey: 'lease-release', createdAtMs: 2500,
    payload: { token: 'lease-dsh' },
  }))
  assert.equal(state.conversations['bridge-lock'].lease, null)

  const common = normalizeCodexTurn({ id: 'common-2', role: 'user', text: '开始', createdAtMs: 10 })
  const codex = normalizeCodexTurn({ id: 'codex-2', role: 'assistant', text: 'C', createdAtMs: 11 })
  const dsh = normalizeDshTurn({ id: 'dsh-2', role: 'assistant', content: 'D', createdAtMs: 11 })
  state = reduceBridgeEvent(state, createBridgeEvent({
    bridgeId: 'bridge-lock', type: 'conflict.detected', baseRevision: 4,
    side: 'none', idempotencyKey: 'conflict-detect', createdAtMs: 3000,
    payload: { codexTurns: [common, codex], dshTurns: [common, dsh], lastCommonTurnId: 'common-2' },
  }))
  assert.equal(state.conversations['bridge-lock'].status, BRIDGE_STATUS.CONFLICT)
  state = reduceBridgeEvent(state, createBridgeEvent({
    bridgeId: 'bridge-lock', type: 'conflict.resolved', baseRevision: 5,
    side: 'none', idempotencyKey: 'conflict-resolve', createdAtMs: 4000,
    payload: { selectedSide: 'codex' },
  }))
  assert.equal(state.conversations['bridge-lock'].turns.at(-1).turnId, 'codex-2')
  assert.equal(state.conversations['bridge-lock'].conflict.recovery.dshTurns.at(-1).turnId, 'dsh-2')
})
