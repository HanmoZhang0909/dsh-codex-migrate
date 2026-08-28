import { normalizeDshTurn } from '../protocol.js'

function canonicalEvents(events) {
  const seen = new Set()
  const turns = []
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || (event.role !== 'user' && event.role !== 'assistant')) continue
    const turn = normalizeDshTurn({
      id: String(event.id || event.turnId || ''),
      role: event.role,
      content: typeof event.content === 'string' ? event.content : typeof event.text === 'string' ? event.text : '',
      createdAtMs: Number.isFinite(event.createdAtMs) ? event.createdAtMs : 0,
      toolCalls: event.toolCalls,
      parentTurnId: event.parentTurnId,
    })
    const identity = turn.hash || turn.turnId
    if (seen.has(identity)) continue
    seen.add(identity)
    turns.push(turn)
  }
  return turns
}

export function parseDshConversation(value) {
  if (!value || typeof value !== 'object') throw new Error('DSH conversation must be an object')
  return {
    conversationId: String(value.conversationId || value.id || ''),
    projectKey: String(value.projectKey || value.workspace || ''),
    archived: Boolean(value.archived),
    turns: canonicalEvents(value.events || value.turns),
  }
}

function requiredFunction(options, key) {
  if (typeof options?.[key] !== 'function') throw new Error(`DSH adapter requires ${key}`)
  return options[key]
}

export function createDshAdapter(options = {}) {
  const readConversation = requiredFunction(options, 'readConversation')
  const createConversation = requiredFunction(options, 'createConversation')
  const append = requiredFunction(options, 'appendTurns')
  const archiveConversation = requiredFunction(options, 'archiveConversation')
  const executionState = requiredFunction(options, 'executionState')
  return Object.freeze({
    side: 'dsh',
    async readSince(conversationId, cursor = { offset: 0 }) {
      const raw = await readConversation(conversationId)
      const events = Array.isArray(raw?.events) ? raw.events : Array.isArray(raw?.turns) ? raw.turns : []
      const offset = Number.isInteger(cursor?.offset) ? cursor.offset : 0
      const parsed = parseDshConversation({ ...raw, events: events.slice(offset) })
      return {
        turns: parsed.turns,
        cursor: { offset: events.length },
        boundary: parsed.turns.at(-1)?.role === 'assistant' ? 'round_completed' : 'none',
        projectKey: parsed.projectKey,
        archived: parsed.archived,
      }
    },
    async createCounterpart(seed) {
      const created = await createConversation(seed)
      return { conversationId: typeof created === 'string' ? created : String(created?.id || created?.conversationId || '') }
    },
    async appendTurns(conversationId, turns, options) { return append(conversationId, turns, options) },
    async archive(conversationId) { return archiveConversation(conversationId) },
    async getExecutionState(conversationId) { return executionState(conversationId) },
  })
}
