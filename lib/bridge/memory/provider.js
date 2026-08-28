import { createHash } from 'node:crypto'

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

export class MemoryProvider {
  constructor(id) {
    if (typeof id !== 'string' || id === '') throw new Error('memory provider id is required')
    this.id = id
  }

  async capabilities() { throw new Error('capabilities() is not implemented') }
  async bootstrap() { throw new Error('bootstrap() is not implemented') }
  async readSince() { throw new Error('readSince() is not implemented') }
  async upsert() { throw new Error('upsert() is not implemented') }
  async remove() { throw new Error('remove() is not implemented') }
  async subscribe() { return () => {} }
}

export function memoryScope(conversation) {
  if (!conversation?.bridgeId) throw new Error('memory scope requires bridgeId')
  if (typeof conversation.projectKey === 'string' && conversation.projectKey !== '') {
    return { kind: 'project', id: conversation.projectKey }
  }
  return { kind: 'conversation', id: conversation.bridgeId }
}

export function normalizeMemory(memory) {
  if (!memory || typeof memory !== 'object') throw new Error('memory must be an object')
  const content = typeof memory.content === 'string' ? memory.content.trim() : ''
  if (content === '') throw new Error('memory content is required')
  const kind = typeof memory.kind === 'string' && memory.kind !== '' ? memory.kind : 'fact'
  const id = typeof memory.id === 'string' && memory.id !== ''
    ? memory.id
    : `memory-${createHash('sha256').update(`${kind}:${content}`).digest('hex').slice(0, 24)}`
  return {
    id,
    content,
    kind,
    tags: Array.isArray(memory.tags) ? [...new Set(memory.tags.filter((tag) => typeof tag === 'string' && tag !== ''))] : [],
    metadata: memory.metadata && typeof memory.metadata === 'object' && !Array.isArray(memory.metadata) ? copy(memory.metadata) : {},
  }
}

export function createMemorySyncCoordinator({ provider, scope }) {
  if (!provider || typeof provider.bootstrap !== 'function') throw new Error('memory coordinator requires a provider')
  let initialized = false
  let cursor = { revision: 0 }
  const upserts = new Map()
  const deletes = new Set()

  async function initialize() {
    if (initialized) return { cursor: copy(cursor), initialized: false }
    const result = await provider.bootstrap(scope)
    cursor = result?.cursor || { revision: 0 }
    initialized = true
    return { ...result, initialized: true }
  }

  function stageUpserts(memories) {
    for (const raw of Array.isArray(memories) ? memories : []) {
      const memory = normalizeMemory(raw)
      upserts.set(memory.id, memory)
      deletes.delete(memory.id)
    }
  }

  function stageDeletes(ids) {
    for (const id of Array.isArray(ids) ? ids : []) {
      if (typeof id !== 'string' || id === '') continue
      deletes.add(id)
      upserts.delete(id)
    }
  }

  async function commit(force) {
    await initialize()
    if (!force) return { flushed: false, queued: upserts.size + deletes.size > 0, cursor: copy(cursor) }
    if (upserts.size === 0 && deletes.size === 0) return { flushed: true, queued: false, cursor: copy(cursor) }
    try {
      if (upserts.size > 0) {
        const result = await provider.upsert(scope, [...upserts.values()], cursor.revision)
        cursor = result.cursor
        upserts.clear()
      }
      if (deletes.size > 0) {
        const result = await provider.remove(scope, [...deletes], cursor.revision)
        cursor = result.cursor
        deletes.clear()
      }
      return { flushed: true, queued: false, cursor: copy(cursor) }
    } catch (error) {
      return { flushed: false, queued: true, cursor: copy(cursor), error: error?.message || String(error) }
    }
  }

  return Object.freeze({
    initialize,
    stageUpserts,
    stageDeletes,
    async flush(boundary) {
      const commitBoundary = boundary === 'round_completed' || boundary === 'task_completed' || boundary === 'explicit'
      return commit(commitBoundary)
    },
    async remember(memory) {
      stageUpserts([memory])
      return commit(true)
    },
    async replay() { return commit(true) },
    inspect() { return { initialized, cursor: copy(cursor), upserts: [...upserts.values()].map(copy), deletes: [...deletes] } },
  })
}
