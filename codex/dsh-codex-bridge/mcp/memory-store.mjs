import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

function scopeKey(scopeKind, scopeId) {
  if (!['conversation', 'project', 'global'].includes(scopeKind)) throw new Error('Invalid memory scope kind.')
  if (typeof scopeId !== 'string' || scopeId.trim() === '') throw new Error('Memory scope ID is required.')
  return `${scopeKind}:${scopeId.trim()}`
}

function readEvents(file) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    const events = []
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].trim()) continue
      try { events.push(JSON.parse(lines[index])) } catch (error) {
        if (lines.slice(index + 1).some((line) => line.trim())) throw new Error(`Memory journal is corrupt at line ${index + 1}.`)
        break
      }
    }
    return events
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

function append(file, event) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const handle = fs.openSync(file, 'a', 0o600)
  try {
    fs.writeSync(handle, `${JSON.stringify(event)}\n`, undefined, 'utf8')
    fs.fsyncSync(handle)
  } finally { fs.closeSync(handle) }
}

function materialize(events, scope) {
  const memories = new Map()
  let revision = 0
  for (const event of events) {
    if (event.scope !== scope) continue
    revision = Math.max(revision, Number(event.revision || 0))
    if (event.type === 'memory.upsert') memories.set(event.memory.id, event.memory)
    if (event.type === 'memory.delete') memories.delete(event.memoryId)
  }
  return { memories, revision }
}

export function createMemoryStore(file) {
  function list({ scopeKind, scopeId }) {
    const scope = scopeKey(scopeKind, scopeId)
    const current = materialize(readEvents(file), scope)
    return { memories: [...current.memories.values()], cursor: { revision: current.revision } }
  }

  return Object.freeze({
    remember(args) {
      const scope = scopeKey(args.scopeKind, args.scopeId)
      const content = typeof args.content === 'string' ? args.content.trim() : ''
      if (!content) throw new Error('Memory content is required.')
      const current = materialize(readEvents(file), scope)
      const kind = typeof args.kind === 'string' && args.kind ? args.kind : 'fact'
      const id = typeof args.id === 'string' && args.id
        ? args.id
        : `memory-${createHash('sha256').update(`${kind}:${content}`).digest('hex').slice(0, 24)}`
      const memory = { id, content, kind, tags: Array.isArray(args.tags) ? [...new Set(args.tags.filter((tag) => typeof tag === 'string'))] : [], updatedAtMs: Date.now() }
      const previous = current.memories.get(id)
      if (previous && previous.content === memory.content && previous.kind === memory.kind && JSON.stringify(previous.tags) === JSON.stringify(memory.tags)) {
        return { memory: previous, cursor: { revision: current.revision }, unchanged: true }
      }
      const revision = current.revision + 1
      append(file, { eventId: `memory-event-${randomUUID()}`, type: 'memory.upsert', scope, revision, atMs: Date.now(), memory })
      return { memory, cursor: { revision }, unchanged: false }
    },
    list,
    search(args) {
      const result = list(args)
      const query = String(args.query || '').toLocaleLowerCase()
      return { ...result, memories: result.memories.filter((memory) => `${memory.content} ${memory.kind} ${memory.tags.join(' ')}`.toLocaleLowerCase().includes(query)) }
    },
    forget(args) {
      const scope = scopeKey(args.scopeKind, args.scopeId)
      const current = materialize(readEvents(file), scope)
      if (!current.memories.has(args.id)) return { deleted: false, cursor: { revision: current.revision } }
      const revision = current.revision + 1
      append(file, { eventId: `memory-event-${randomUUID()}`, type: 'memory.delete', scope, revision, atMs: Date.now(), memoryId: args.id, tombstone: true })
      return { deleted: true, cursor: { revision } }
    },
    resource() {
      const events = readEvents(file)
      return { schemaVersion: 1, events: events.map((event) => ({ ...event, eventId: undefined })) }
    },
  })
}
