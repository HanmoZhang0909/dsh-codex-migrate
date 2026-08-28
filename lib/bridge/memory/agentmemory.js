import { MemoryProvider, normalizeMemory } from './provider.js'

function firstTool(tools, names) {
  return names.find((name) => tools.has(name)) || ''
}

function scopeArgs(scope) {
  return {
    project: scope.kind === 'project' ? scope.id : undefined,
    sessionId: scope.kind === 'conversation' ? scope.id : undefined,
    scope: `${scope.kind}:${scope.id}`,
  }
}

function resultItems(result) {
  if (Array.isArray(result)) return result
  for (const key of ['memories', 'items', 'results']) if (Array.isArray(result?.[key])) return result[key]
  return []
}

export function createAgentMemoryProvider({ id, client, tools = [] }) {
  const names = new Set(tools)
  const saveTool = firstTool(names, ['add_memory', 'memory_save', 'memory_remember', 'store_memory'])
  const searchTool = firstTool(names, ['search_memories', 'memory_smart_search', 'memory_recall', 'recall_memory'])
  const listTool = firstTool(names, ['list_memories', 'memory_export', 'memory_list'])
  const deleteTool = firstTool(names, ['delete_memory', 'memory_governance_delete', 'memory_forget'])
  if (!client || typeof client.callTool !== 'function' || !saveTool || !searchTool || !listTool) return null
  const revisions = new Map()
  const scopeKey = (scope) => `${scope.kind}:${scope.id}`

  class AgentMemoryProvider extends MemoryProvider {
    constructor() { super(id || 'agentmemory') }
    async capabilities() { return { read: true, write: true, search: true, delete: Boolean(deleteTool), scopes: ['conversation', 'project', 'global'] } }
    async bootstrap(scope) {
      const result = await client.callTool(listTool, scopeArgs(scope))
      return { memories: resultItems(result), cursor: { revision: revisions.get(scopeKey(scope)) || 0 } }
    }
    async readSince(scope, cursor) {
      const boot = await this.bootstrap(scope)
      return { upserts: boot.memories, deletes: [], cursor: boot.cursor, fullSnapshot: true }
    }
    async upsert(scope, memories, expectedRevision) {
      const key = scopeKey(scope)
      const revision = revisions.get(key) || 0
      if (revision !== expectedRevision) throw new Error(`MEMORY_REVISION_CONFLICT: expected ${revision}, received ${expectedRevision}`)
      let next = revision
      for (const raw of memories || []) {
        const memory = normalizeMemory(raw)
        await client.callTool(saveTool, { ...scopeArgs(scope), id: memory.id, content: memory.content, kind: memory.kind, tags: memory.tags, metadata: memory.metadata })
        next += 1
      }
      revisions.set(key, next)
      return { cursor: { revision: next } }
    }
    async remove(scope, ids, expectedRevision) {
      const key = scopeKey(scope)
      const revision = revisions.get(key) || 0
      if (revision !== expectedRevision) throw new Error(`MEMORY_REVISION_CONFLICT: expected ${revision}, received ${expectedRevision}`)
      if (!deleteTool && ids.length > 0) throw new Error('MEMORY_DELETE_UNSUPPORTED')
      let next = revision
      for (const memoryId of ids || []) {
        await client.callTool(deleteTool, { ...scopeArgs(scope), id: memoryId, memoryId, memoryIds: [memoryId] })
        next += 1
      }
      revisions.set(key, next)
      return { cursor: { revision: next } }
    }
    async search(scope, query) { return resultItems(await client.callTool(searchTool, { ...scopeArgs(scope), query })) }
  }
  return new AgentMemoryProvider()
}
