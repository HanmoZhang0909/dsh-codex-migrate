import { createHash } from 'node:crypto'
import { acquireLease, heartbeatLease, releaseLease } from './lease.js'
import { detectConflict, resolveConflict } from './conflicts.js'

export const BRIDGE_STATUS = Object.freeze({
  READY: 'ready',
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  ERROR: 'error',
  CONFLICT: 'conflict',
})

export const REGISTRATION_MODE = Object.freeze({
  SINGLE: 'single',
  PROJECT_ALL: 'project_all',
  SELECTED: 'selected',
})

export const SYNC_POLICY = Object.freeze({
  TASK_TURN: 'task_turn',
  AGENT_MESSAGE: 'agent_message',
})

export const ARCHIVE_POLICY = Object.freeze({
  MANUAL: 'manual',
  AUTOMATIC: 'automatic',
})

const STATUS_VALUES = new Set(Object.values(BRIDGE_STATUS))
const REGISTRATION_VALUES = new Set(Object.values(REGISTRATION_MODE))
const SYNC_VALUES = new Set(Object.values(SYNC_POLICY))
const ARCHIVE_VALUES = new Set(Object.values(ARCHIVE_POLICY))
const SIDES = new Set(['none', 'codex', 'dsh'])
const METADATA_KEYS = Object.freeze([
  'registered', 'shared', 'registeredAtMs', 'title', 'workspace', 'openUrl', 'latestRenderId',
  'navigationRequestId', 'navigationRequestedAtMs', 'navigationAcknowledgedAtMs',
  'summary', 'todos', 'messages', 'workingText', 'pendingMessages',
  'lastContinueAtMs', 'lastTakeoverAtMs', 'syncCursors', 'lastSyncAtMs',
  'memoryProviderId', 'memoryCursor',
])

function plainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value !== null && typeof value === 'object') {
    const result = {}
    for (const key of Object.keys(value).sort()) result[key] = stableValue(value[key])
    return result
  }
  return value
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function digest(prefix, value) {
  return `${prefix}-${createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 32)}`
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`)
  return value
}

function validateRegistration(payload) {
  const registrationMode = payload.registrationMode || REGISTRATION_MODE.SINGLE
  const syncPolicy = payload.syncPolicy || SYNC_POLICY.TASK_TURN
  const archivePolicy = payload.archivePolicy || ARCHIVE_POLICY.MANUAL
  if (!REGISTRATION_VALUES.has(registrationMode)) throw new Error(`registrationMode is invalid: ${registrationMode}`)
  if (!SYNC_VALUES.has(syncPolicy)) throw new Error(`syncPolicy is invalid: ${syncPolicy}`)
  if (!ARCHIVE_VALUES.has(archivePolicy)) throw new Error(`archivePolicy is invalid: ${archivePolicy}`)
}

function validateEventPayload(type, payload) {
  plainObject(payload, 'payload')
  if (type === 'conversation.registered') validateRegistration(payload)
  if (type === 'status.updated') {
    if (!STATUS_VALUES.has(payload.status)) throw new Error(`status is invalid: ${payload.status}`)
    if (payload.activeSide !== undefined && !SIDES.has(payload.activeSide)) throw new Error(`activeSide is invalid: ${payload.activeSide}`)
  }
  if (type === 'turns.appended' && !Array.isArray(payload.turns)) throw new Error('turns must be an array')
  if (type === 'branch.created') {
    requiredString(payload.branchBridgeId, 'branchBridgeId')
    requiredString(payload.sourceTurnId, 'sourceTurnId')
    if (typeof payload.sync !== 'boolean') throw new Error('sync must be a boolean')
  }
  if (type === 'metadata.updated') plainObject(payload, 'metadata payload')
  if (type === 'lease.acquired' || type === 'lease.heartbeat') {
    requiredString(payload.token, 'lease token')
    if (!Number.isFinite(payload.ttlMs) || payload.ttlMs <= 0) throw new Error('ttlMs must be positive')
  }
  if (type === 'lease.released') requiredString(payload.token, 'lease token')
  if (type === 'conflict.detected') {
    if (!Array.isArray(payload.codexTurns) || !Array.isArray(payload.dshTurns)) throw new Error('conflict turns must be arrays')
  }
  if (type === 'conflict.resolved' && payload.selectedSide !== 'codex' && payload.selectedSide !== 'dsh') {
    throw new Error('selectedSide must be codex or dsh')
  }
}

export function createBridgeEvent(input) {
  plainObject(input, 'event')
  const bridgeId = requiredString(input.bridgeId, 'bridgeId')
  const type = requiredString(input.type, 'type')
  const side = input.side || 'none'
  if (!SIDES.has(side)) throw new Error(`side is invalid: ${side}`)
  if (!Number.isInteger(input.baseRevision) || input.baseRevision < 0) throw new Error('baseRevision must be a non-negative integer')
  const idempotencyKey = requiredString(input.idempotencyKey, 'idempotencyKey')
  const payload = input.payload || {}
  validateEventPayload(type, payload)
  const identity = { bridgeId, type, baseRevision: input.baseRevision, side, idempotencyKey, payload }
  return {
    eventId: input.eventId || digest('evt', identity),
    bridgeId,
    type,
    side,
    baseRevision: input.baseRevision,
    idempotencyKey,
    createdAtMs: Number.isFinite(input.createdAtMs) ? Number(input.createdAtMs) : Date.now(),
    payload: JSON.parse(JSON.stringify(payload)),
  }
}

export function createBridgeState() {
  return { schemaVersion: 1, revision: 0, conversations: {}, appliedEventIds: [] }
}

function createConversation(event) {
  const payload = event.payload
  return {
    bridgeId: event.bridgeId,
    codexConversationId: typeof payload.codexConversationId === 'string' ? payload.codexConversationId : '',
    dshConversationId: typeof payload.dshConversationId === 'string' ? payload.dshConversationId : '',
    projectKey: typeof payload.projectKey === 'string' ? payload.projectKey : '',
    registrationMode: payload.registrationMode || REGISTRATION_MODE.SINGLE,
    syncPolicy: payload.syncPolicy || SYNC_POLICY.TASK_TURN,
    archivePolicy: payload.archivePolicy || ARCHIVE_POLICY.MANUAL,
    status: BRIDGE_STATUS.READY,
    activeSide: 'none',
    revision: 0,
    turns: [],
    lastCommonTurnId: '',
    lease: null,
    conflict: null,
    branches: [],
    archived: false,
    archivePending: false,
    memoryProviderId: '',
    memoryCursor: '',
    createdAtMs: event.createdAtMs,
    updatedAtMs: event.createdAtMs,
  }
}

function applyRegistration(conversation, payload) {
  const next = { ...conversation }
  for (const key of ['codexConversationId', 'dshConversationId', 'projectKey']) {
    if (typeof payload[key] === 'string') next[key] = payload[key]
  }
  if (payload.registrationMode) next.registrationMode = payload.registrationMode
  if (payload.syncPolicy) next.syncPolicy = payload.syncPolicy
  if (payload.archivePolicy) next.archivePolicy = payload.archivePolicy
  return applyMetadata(next, payload)
}

function applyMetadata(conversation, payload) {
  const next = { ...conversation }
  for (const key of METADATA_KEYS) {
    if (payload[key] !== undefined) next[key] = JSON.parse(JSON.stringify(payload[key]))
  }
  return next
}

function applyTurns(conversation, turns) {
  const existing = new Set(conversation.turns.map((turn) => turn.hash || turn.turnId))
  const additions = turns.filter((turn) => turn && typeof turn === 'object' && !existing.has(turn.hash || turn.turnId))
  const nextTurns = conversation.turns.concat(additions.map((turn) => JSON.parse(JSON.stringify(turn))))
  return {
    ...conversation,
    turns: nextTurns,
    lastCommonTurnId: additions.length > 0 ? additions[additions.length - 1].turnId : conversation.lastCommonTurnId,
  }
}

export function reduceBridgeEvent(currentState, rawEvent) {
  const state = currentState && typeof currentState === 'object' ? currentState : createBridgeState()
  const event = rawEvent && rawEvent.eventId ? rawEvent : createBridgeEvent(rawEvent)
  if (state.appliedEventIds.includes(event.eventId)) return state

  const existing = state.conversations[event.bridgeId]
  if (event.type !== 'conversation.registered' && !existing) throw new Error(`UNKNOWN_BRIDGE: ${event.bridgeId}`)
  const expectedRevision = existing ? existing.revision : 0
  if (event.baseRevision !== expectedRevision) {
    throw new Error(`REVISION_CONFLICT: expected ${expectedRevision}, received ${event.baseRevision}`)
  }

  let conversation = existing ? JSON.parse(JSON.stringify(existing)) : createConversation(event)
  if (event.type === 'conversation.registered') conversation = applyRegistration(conversation, event.payload)
  else if (event.type === 'status.updated') {
    conversation.status = event.payload.status
    if (event.payload.activeSide !== undefined) conversation.activeSide = event.payload.activeSide
    if (typeof event.payload.summary === 'string') conversation.summary = event.payload.summary
  } else if (event.type === 'turns.appended') conversation = applyTurns(conversation, event.payload.turns)
  else if (event.type === 'branch.created') {
    conversation.branches = (conversation.branches || []).concat({
      branchBridgeId: event.payload.branchBridgeId,
      sourceTurnId: event.payload.sourceTurnId,
      sync: event.payload.sync,
    })
  } else if (event.type === 'archive.requested') {
    const automatic = conversation.archivePolicy === ARCHIVE_POLICY.AUTOMATIC
    conversation.archived = automatic
    conversation.archivePending = !automatic
    conversation.status = BRIDGE_STATUS.PAUSED
    conversation.activeSide = 'none'
    conversation.lease = null
  } else if (event.type === 'metadata.updated') conversation = applyRegistration(conversation, event.payload)
  else if (event.type === 'lease.acquired') {
    conversation = acquireLease(conversation, event.side, event.createdAtMs, event.payload.ttlMs, event.payload.token)
  } else if (event.type === 'lease.heartbeat') {
    conversation = heartbeatLease(conversation, event.payload.token, event.createdAtMs, event.payload.ttlMs)
  } else if (event.type === 'lease.released') {
    conversation = releaseLease(conversation, event.payload.token, event.createdAtMs)
  } else if (event.type === 'conflict.detected') {
    conversation = detectConflict(conversation, {
      codexTurns: event.payload.codexTurns,
      dshTurns: event.payload.dshTurns,
      lastCommonTurnId: event.payload.lastCommonTurnId,
      detectedAtMs: event.createdAtMs,
    })
  } else if (event.type === 'conflict.resolved') {
    conversation = resolveConflict(conversation, event.payload.selectedSide, event.createdAtMs)
  }
  else throw new Error(`UNKNOWN_EVENT_TYPE: ${event.type}`)

  conversation.revision = expectedRevision + 1
  conversation.updatedAtMs = event.createdAtMs
  return {
    ...state,
    revision: Number(state.revision || 0) + 1,
    conversations: { ...state.conversations, [event.bridgeId]: conversation },
    appliedEventIds: state.appliedEventIds.concat(event.eventId),
  }
}

function normalizeToolCalls(value) {
  if (!Array.isArray(value)) return []
  return value.map((tool) => ({
    name: typeof tool?.name === 'string' ? tool.name : '',
    arguments: tool?.arguments && typeof tool.arguments === 'object' ? stableValue(tool.arguments) : {},
  })).filter((tool) => tool.name !== '')
}

function normalizeTurn(input, source) {
  plainObject(input, `${source} turn`)
  const role = requiredString(input.role, 'role')
  const content = typeof input.text === 'string' ? input.text : typeof input.content === 'string' ? input.content : ''
  const toolCalls = normalizeToolCalls(input.toolCalls || input.tools)
  const createdAtMs = Number.isFinite(input.createdAtMs) ? Number(input.createdAtMs) : 0
  const canonical = { role, content, toolCalls, createdAtMs }
  return {
    turnId: typeof input.turnId === 'string' ? input.turnId : typeof input.id === 'string' ? input.id : digest('turn', canonical),
    source,
    role,
    content,
    toolCalls,
    createdAtMs,
    parentTurnId: typeof input.parentTurnId === 'string' ? input.parentTurnId : '',
    hash: digest('sha', canonical),
  }
}

export function normalizeCodexTurn(input) {
  return normalizeTurn(input, 'codex')
}

export function normalizeDshTurn(input) {
  return normalizeTurn(input, 'dsh')
}
