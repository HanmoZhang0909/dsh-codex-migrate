import { normalizeCodexTurn } from '../protocol.js'

function textContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((item) => {
    if (typeof item === 'string') return item
    if (item && typeof item.text === 'string') return item.text
    return ''
  }).join('')
}

function timestampMs(line, fallback) {
  const parsed = typeof line.timestamp === 'string' ? Date.parse(line.timestamp) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseArguments(value) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || value === '') return {}
  try { return JSON.parse(value) } catch (error) { return { raw: value } }
}

function compactRegenerations(entries) {
  const result = []
  const logicalIndexes = new Map()
  for (const entry of entries) {
    const logicalId = entry.logicalTurnId
    if (logicalId && entry.role === 'assistant') {
      const previous = logicalIndexes.get(logicalId)
      if (previous !== undefined) {
        result[previous] = entry
        continue
      }
      logicalIndexes.set(logicalId, result.length)
    }
    result.push(entry)
  }
  return result
}

function parseCodexRecords(text) {
  const records = String(text).split(/\r?\n/).filter((line) => line.trim() !== '')
  let conversationId = ''
  let projectKey = ''
  let archived = false
  const entries = []
  for (let index = 0; index < records.length; index += 1) {
    let line
    try { line = JSON.parse(records[index]) } catch (error) { continue }
    const payload = line?.payload && typeof line.payload === 'object' ? line.payload : {}
    if (line.type === 'session_meta') {
      conversationId = String(payload.session_id || payload.id || conversationId)
      projectKey = String(payload.workspace_root || payload.cwd || projectKey)
      archived = Boolean(payload.archived || archived)
      continue
    }
    if (line.type !== 'response_item' && line.type !== 'message' && line.type !== 'event_msg') continue
    const sourceOffset = index + 1
    const createdAtMs = timestampMs(line, sourceOffset)
    if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
      entries.push({
        ...normalizeCodexTurn({
          id: String(payload.id || payload.call_id || `tool-${sourceOffset}`),
          role: 'tool',
          text: '',
          createdAtMs,
          toolCalls: [{
            name: String(payload.name || ''),
            arguments: parseArguments(payload.arguments ?? payload.input),
          }],
        }),
        sourceOffset,
        logicalTurnId: '',
      })
      continue
    }
    const role = payload.role || (payload.type === 'user_message' ? 'user' : payload.type === 'agent_message' ? 'assistant' : '')
    if (role !== 'user' && role !== 'assistant') continue
    const content = payload.message !== undefined ? String(payload.message) : textContent(payload.content)
    entries.push({
      ...normalizeCodexTurn({
        id: String(payload.id || `${role}-${sourceOffset}`),
        role,
        text: content,
        createdAtMs,
        parentTurnId: typeof payload.parent_turn_id === 'string' ? payload.parent_turn_id : '',
      }),
      sourceOffset,
      logicalTurnId: typeof payload.logical_turn_id === 'string' ? payload.logical_turn_id : '',
      generation: Number.isFinite(payload.generation) ? Number(payload.generation) : 0,
    })
  }
  return { conversationId, projectKey, archived, entries: compactRegenerations(entries), recordCount: records.length }
}

export function parseCodexJsonl(text) {
  const parsed = parseCodexRecords(text)
  return { ...parsed, turns: parsed.entries.map(({ logicalTurnId, generation, ...turn }) => turn) }
}

function requiredFunction(options, key) {
  if (typeof options?.[key] !== 'function') throw new Error(`Codex adapter requires ${key}`)
  return options[key]
}

export function createCodexAdapter(options = {}) {
  const readConversation = requiredFunction(options, 'readConversation')
  const createConversation = requiredFunction(options, 'createConversation')
  const append = requiredFunction(options, 'appendTurns')
  const archiveConversation = requiredFunction(options, 'archiveConversation')
  const executionState = requiredFunction(options, 'executionState')
  return Object.freeze({
    side: 'codex',
    async readSince(conversationId, cursor = { offset: 0 }) {
      const parsed = parseCodexRecords(await readConversation(conversationId))
      const offset = Number.isInteger(cursor?.offset) ? cursor.offset : 0
      const turns = parsed.entries
        .filter((entry) => entry.sourceOffset > offset)
        .map(({ logicalTurnId, generation, ...turn }) => turn)
      return {
        turns,
        cursor: { offset: parsed.recordCount },
        boundary: turns.at(-1)?.role === 'assistant' ? 'round_completed' : 'none',
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
