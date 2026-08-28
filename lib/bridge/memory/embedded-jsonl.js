import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import { MemoryProvider, normalizeMemory } from './provider.js'

function scopeKey(scope) {
  if (!scope || !['conversation', 'project', 'global'].includes(scope.kind) || typeof scope.id !== 'string' || scope.id === '') {
    throw new Error('memory scope is invalid')
  }
  return `${scope.kind}:${scope.id}`
}

function readEvents(path) {
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  const events = []
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === '') continue
    try { events.push(JSON.parse(lines[index])) } catch (error) {
      if (lines.slice(index + 1).some((line) => line.trim() !== '')) throw new Error(`MEMORY_LOG_CORRUPT: ${index + 1}`)
      break
    }
  }
  return events
}

function append(path, event) {
  mkdirSync(dirname(path), { recursive: true })
  const handle = openSync(path, 'a')
  try {
    writeSync(handle, `${JSON.stringify(event)}\n`, undefined, 'utf8')
    fsyncSync(handle)
  } finally { closeSync(handle) }
}

function currentFor(events, key) {
  const memories = new Map()
  let revision = 0
  for (const event of events) {
    if (event.scope !== key) continue
    revision = Math.max(revision, Number(event.revision || 0))
    if (event.type === 'memory.upsert') memories.set(event.memory.id, event.memory)
    if (event.type === 'memory.delete') memories.delete(event.memoryId)
  }
  return { memories, revision }
}

export function createEmbeddedJsonlProvider({ path, now = Date.now }) {
  class EmbeddedJsonlProvider extends MemoryProvider {
    constructor() { super('embedded-jsonl') }
    async capabilities() {
      return { read: true, write: true, search: true, delete: true, subscribe: true, scopes: ['conversation', 'project', 'global'] }
    }
    async bootstrap(scope) {
      const current = currentFor(readEvents(path), scopeKey(scope))
      return { memories: [...current.memories.values()], cursor: { revision: current.revision } }
    }
    async readSince(scope, cursor = { revision: 0 }) {
      const key = scopeKey(scope)
      const events = readEvents(path).filter((event) => event.scope === key && event.revision > Number(cursor?.revision || 0))
      return {
        upserts: events.filter((event) => event.type === 'memory.upsert').map((event) => event.memory),
        deletes: events.filter((event) => event.type === 'memory.delete').map((event) => event.memoryId),
        cursor: { revision: events.at(-1)?.revision || Number(cursor?.revision || 0) },
      }
    }
    async upsert(scope, memories, expectedRevision) {
      const key = scopeKey(scope)
      const events = readEvents(path)
      const current = currentFor(events, key)
      if (current.revision !== expectedRevision) throw new Error(`MEMORY_REVISION_CONFLICT: expected ${current.revision}, received ${expectedRevision}`)
      let revision = current.revision
      for (const raw of Array.isArray(memories) ? memories : []) {
        const memory = normalizeMemory(raw)
        const previous = current.memories.get(memory.id)
        if (previous && JSON.stringify(previous) === JSON.stringify(memory)) continue
        revision += 1
        append(path, { type: 'memory.upsert', scope: key, revision, atMs: now(), memory })
        current.memories.set(memory.id, memory)
      }
      return { cursor: { revision } }
    }
    async remove(scope, ids, expectedRevision) {
      const key = scopeKey(scope)
      const events = readEvents(path)
      const current = currentFor(events, key)
      if (current.revision !== expectedRevision) throw new Error(`MEMORY_REVISION_CONFLICT: expected ${current.revision}, received ${expectedRevision}`)
      let revision = current.revision
      for (const id of Array.isArray(ids) ? ids : []) {
        if (!current.memories.has(id)) continue
        revision += 1
        append(path, { type: 'memory.delete', scope: key, revision, atMs: now(), memoryId: id, tombstone: true })
        current.memories.delete(id)
      }
      return { cursor: { revision } }
    }
    async search(scope, query) {
      const needle = String(query || '').toLocaleLowerCase()
      const current = currentFor(readEvents(path), scopeKey(scope))
      return [...current.memories.values()].filter((memory) => `${memory.content} ${memory.kind} ${memory.tags.join(' ')}`.toLocaleLowerCase().includes(needle))
    }
  }
  return new EmbeddedJsonlProvider()
}
