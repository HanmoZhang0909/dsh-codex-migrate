import { MemoryProvider, normalizeMemory } from './provider.js'

function entitiesFrom(result) {
  if (Array.isArray(result?.entities)) return result.entities
  if (Array.isArray(result)) return result
  return []
}

export function createKnowledgeGraphProvider({ id, client, tools = [] }) {
  const names = new Set(tools)
  const required = ['create_entities', 'read_graph', 'search_nodes']
  if (!client || typeof client.callTool !== 'function' || !required.every((name) => names.has(name))) return null
  const canDelete = names.has('delete_entities')
  const revisions = new Map()
  const scopeKey = (scope) => `${scope.kind}:${scope.id}`
  const entityName = (scope, memoryId) => `dsh-codex:${scopeKey(scope)}:${memoryId}`

  class KnowledgeGraphProvider extends MemoryProvider {
    constructor() { super(id || 'mcp-knowledge-graph') }
    async capabilities() { return { read: true, write: true, search: true, delete: canDelete, subscribe: true, scopes: ['conversation', 'project', 'global'] } }
    async bootstrap(scope) {
      const result = await client.callTool('read_graph', {})
      const prefix = `dsh-codex:${scopeKey(scope)}:`
      const memories = entitiesFrom(result).filter((entity) => String(entity.name || '').startsWith(prefix)).map((entity) => ({
        id: String(entity.name).slice(prefix.length),
        kind: entity.entityType || 'fact',
        content: Array.isArray(entity.observations) ? entity.observations.join('\n') : '',
        tags: [], metadata: { entityName: entity.name },
      }))
      return { memories, cursor: { revision: revisions.get(scopeKey(scope)) || 0 } }
    }
    async readSince(scope) {
      const boot = await this.bootstrap(scope)
      return { upserts: boot.memories, deletes: [], cursor: boot.cursor, fullSnapshot: true }
    }
    async upsert(scope, memories, expectedRevision) {
      const key = scopeKey(scope)
      const revision = revisions.get(key) || 0
      if (revision !== expectedRevision) throw new Error(`MEMORY_REVISION_CONFLICT: expected ${revision}, received ${expectedRevision}`)
      const normalized = (memories || []).map(normalizeMemory)
      if (normalized.length > 0) {
        await client.callTool('create_entities', { entities: normalized.map((memory) => ({
          name: entityName(scope, memory.id), entityType: memory.kind, observations: [memory.content],
        })) })
      }
      const next = revision + normalized.length
      revisions.set(key, next)
      return { cursor: { revision: next } }
    }
    async remove(scope, ids, expectedRevision) {
      const key = scopeKey(scope)
      const revision = revisions.get(key) || 0
      if (revision !== expectedRevision) throw new Error(`MEMORY_REVISION_CONFLICT: expected ${revision}, received ${expectedRevision}`)
      if (!canDelete && ids.length > 0) throw new Error('MEMORY_DELETE_UNSUPPORTED')
      if (ids.length > 0) await client.callTool('delete_entities', { entityNames: ids.map((memoryId) => entityName(scope, memoryId)) })
      const next = revision + ids.length
      revisions.set(key, next)
      return { cursor: { revision: next } }
    }
    async search(scope, query) {
      const result = await client.callTool('search_nodes', { query })
      const prefix = `dsh-codex:${scopeKey(scope)}:`
      return entitiesFrom(result).filter((entity) => String(entity.name || '').startsWith(prefix))
    }
  }
  return new KnowledgeGraphProvider()
}
