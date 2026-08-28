import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { selectMemoryProvider } from '../lib/bridge/memory/discovery.js'
import { createEmbeddedJsonlProvider } from '../lib/bridge/memory/embedded-jsonl.js'
import { createMemorySyncCoordinator, memoryScope } from '../lib/bridge/memory/provider.js'
import { createAgentMemoryProvider } from '../lib/bridge/memory/agentmemory.js'
import { createKnowledgeGraphProvider } from '../lib/bridge/memory/mcp-knowledge-graph.js'
import { createNeo4jMemoryProvider } from '../lib/bridge/memory/neo4j.js'

function compatible(id, extra = {}) {
  return {
    id,
    async capabilities() { return { read: true, write: true, search: true, delete: true, ...extra } },
  }
}

test('selects memory providers by explicit choice, source use, capability, then embedded fallback', async () => {
  const embedded = compatible('embedded')
  const graph = compatible('knowledge-graph')
  const source = compatible('source-memory')
  const readonly = compatible('readonly', { write: false })

  assert.equal((await selectMemoryProvider({ preferredId: 'knowledge-graph', sourceProviderId: 'source-memory', providers: [source, graph], fallback: embedded })).id, 'knowledge-graph')
  assert.equal((await selectMemoryProvider({ sourceProviderId: 'source-memory', providers: [graph, source], fallback: embedded })).id, 'source-memory')
  assert.equal((await selectMemoryProvider({ providers: [readonly, graph], fallback: embedded })).id, 'knowledge-graph')
  assert.equal((await selectMemoryProvider({ providers: [readonly], fallback: embedded })).id, 'embedded')
})

test('uses conversation scope without a project and project scope when registered to a project', () => {
  assert.deepEqual(memoryScope({ bridgeId: 'bridge-1', projectKey: '' }), { kind: 'conversation', id: 'bridge-1' })
  assert.deepEqual(memoryScope({ bridgeId: 'bridge-1', projectKey: 'D:/project' }), { kind: 'project', id: 'D:/project' })
})

test('embedded provider bootstraps once and then emits incremental upserts and tombstones', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'bridge-memory-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const path = join(directory, 'memory.jsonl')
  const provider = createEmbeddedJsonlProvider({ path, now: () => 1000 })
  const scope = { kind: 'project', id: 'project-a' }

  const initial = await provider.bootstrap(scope)
  assert.equal(initial.cursor.revision, 0)
  const first = await provider.upsert(scope, [{ id: 'm1', content: '偏好中文', kind: 'preference' }], 0)
  assert.equal(first.cursor.revision, 1)
  const unchanged = await provider.upsert(scope, [{ id: 'm1', content: '偏好中文', kind: 'preference' }], 1)
  assert.equal(unchanged.cursor.revision, 1)
  await assert.rejects(() => provider.upsert(scope, [{ id: 'm2', content: '过期写入' }], 0), /MEMORY_REVISION_CONFLICT/)
  const removed = await provider.remove(scope, ['m1'], 1)
  assert.equal(removed.cursor.revision, 2)

  const delta = await provider.readSince(scope, { revision: 0 })
  assert.deepEqual(delta.upserts.map((item) => item.id), ['m1'])
  assert.deepEqual(delta.deletes, ['m1'])
  assert.equal(delta.cursor.revision, 2)
  assert.equal(readFileSync(path, 'utf8').trim().split(/\r?\n/).length, 2)
})

test('memory coordinator bootstraps once, batches normal mutations, flushes explicit remember immediately, and replays after outage', async () => {
  let available = true
  const calls = []
  const provider = {
    id: 'provider',
    async capabilities() { return { read: true, write: true, search: true, delete: true } },
    async bootstrap() { calls.push('bootstrap'); return { memories: [], cursor: { revision: 0 } } },
    async upsert(scope, memories, revision) {
      if (!available) throw new Error('offline')
      calls.push(['upsert', memories.map((item) => item.id), revision])
      return { cursor: { revision: revision + 1 } }
    },
    async remove(scope, ids, revision) {
      if (!available) throw new Error('offline')
      calls.push(['remove', ids, revision])
      return { cursor: { revision: revision + 1 } }
    },
  }
  const coordinator = createMemorySyncCoordinator({ provider, scope: { kind: 'conversation', id: 'b1' } })
  await coordinator.initialize()
  await coordinator.initialize()
  coordinator.stageUpserts([{ id: 'm1', content: '事实' }])
  assert.equal((await coordinator.flush('agent_message')).flushed, false)
  assert.equal((await coordinator.flush('round_completed')).flushed, true)
  await coordinator.remember({ id: 'm2', content: '立即记住' })
  available = false
  coordinator.stageDeletes(['m1'])
  const queued = await coordinator.flush('task_completed')
  assert.equal(queued.queued, true)
  available = true
  assert.equal((await coordinator.replay()).flushed, true)
  assert.equal(calls.filter((call) => call === 'bootstrap').length, 1)
  assert.deepEqual(calls.filter(Array.isArray).map((call) => call[0]), ['upsert', 'upsert', 'remove'])
})

test('recognizes compatible MCP providers by tools instead of relying on the server name', async () => {
  const calls = []
  const client = { async callTool(name, args) { calls.push([name, args]); return name.startsWith('list') ? [] : {} } }
  const agent = createAgentMemoryProvider({
    id: 'custom-memory-name', client,
    tools: ['add_memory', 'search_memories', 'list_memories', 'delete_memory'],
  })
  assert.equal((await agent.capabilities()).write, true)
  await agent.upsert({ kind: 'project', id: 'p1' }, [{ id: 'm1', content: '事实' }], 0)
  assert.equal(calls[0][0], 'add_memory')

  const graph = createKnowledgeGraphProvider({
    id: 'not-called-memory', client,
    tools: ['create_entities', 'add_observations', 'read_graph', 'search_nodes', 'delete_entities'],
  })
  assert.equal((await graph.capabilities()).search, true)

  const neo4j = createNeo4jMemoryProvider({
    id: 'neo4j-labs', client,
    tools: ['create_entities', 'add_observations', 'read_graph', 'search_nodes', 'delete_entities'],
  })
  assert.equal(neo4j.id, 'neo4j-labs')
})
