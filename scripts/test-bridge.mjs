import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
import { createLogic } from '../lib/logic.js'
import { startBridgeServer } from '../lib/bridge-server.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const temp = mkdtempSync(join(tmpdir(), 'dsh-one-way-bridge-'))
const tokenPath = join(temp, 'install-token')
const codexPath = join(temp, 'codex')
const hostPath = join(temp, 'host')
const memoryPath = join(hostPath, 'bridge', 'memory.jsonl')
mkdirSync(codexPath, { recursive: true })
const ctx = {
  get: (name) => name === 'dshConversationAdapter' ? {
    side: 'dsh',
    async createCounterpart() { return { conversationId: 'dsh-imported-smoke' } },
  } : undefined,
  interval: () => () => {}, timeout: () => {},
}
const logic = createLogic(ctx, {
  codexDir: codexPath, outputDir: hostPath, language: 'zh', bridgeEnabled: false,
  includeSessions: false, includeMcp: false, includeMemories: false,
  includeMcpMemories: true, includeMemorySkill: false, includeAgentsMd: false,
}, temp)
await logic.init()
const server = startBridgeServer({ enabled: true, port: 0, logic, tokenPath })
for (let index = 0; index < 100 && !server.address(); index += 1) await new Promise((resolve) => setTimeout(resolve, 5))
if (!server.address()) throw new Error('bridge server did not listen')

const serverPath = join(root, 'codex', 'dsh-codex-bridge', 'mcp', 'server.mjs')
const child = spawn(process.execPath, [serverPath, '--stdio'], {
  cwd: join(root, 'codex', 'dsh-codex-bridge'),
  env: {
    ...process.env,
    DSH_CODEX_BRIDGE_TOKEN_FILE: tokenPath,
    DSH_CODEX_BRIDGE_PORT: String(server.address().port),
    DSH_CODEX_BRIDGE_MEMORY_FILE: memoryPath,
  },
  stdio: ['pipe', 'pipe', 'inherit'],
})
const lines = readline.createInterface({ input: child.stdout })
const pending = new Map()
lines.on('line', (line) => {
  const message = JSON.parse(line)
  const waiter = pending.get(message.id)
  if (waiter) { pending.delete(message.id); waiter(message) }
})
let id = 0
function rpc(method, params = {}) {
  const requestId = ++id
  return new Promise((resolve, reject) => {
    pending.set(requestId, resolve)
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })}\n`)
    setTimeout(() => pending.delete(requestId) && reject(new Error(`timeout waiting for ${method}`)), 5000)
  })
}

try {
  const initialized = await rpc('initialize', { protocolVersion: '2024-11-05' })
  assert.deepEqual(Object.keys(initialized.result.capabilities), ['tools'])
  const listed = await rpc('tools/list')
  assert.deepEqual(listed.result.tools.map((tool) => tool.name), [
    'continue_in_dsh', 'remember_memory', 'search_memory', 'forget_memory',
  ])
  assert.equal(Object.hasOwn(listed.result.tools[0], '_meta'), false)
  const called = await rpc('tools/call', {
    name: 'continue_in_dsh',
    arguments: { codexConversationId: 'codex-one-way-smoke', title: '单向迁移测试', workspace: root },
  })
  assert.equal(called.result.content[0].text, '已同步对话到 DSH。')
  assert.equal(called.result.structuredContent.dshConversationId, 'dsh-imported-smoke')
  assert.equal(called.result.structuredContent.imported, true)
  assert.equal(Object.hasOwn(called.result, '_meta'), false)

  const remembered = await rpc('tools/call', {
    name: 'remember_memory',
    arguments: {
      id: 'memory-smoke', content: '快速验证记忆：测试代号是青柠-827',
      kind: 'fact', tags: ['quick-test'], scopeKind: 'global', scopeId: 'default',
    },
  })
  assert.equal(remembered.result.structuredContent.memory.id, 'memory-smoke')
  assert.match(remembered.result.content[0].text, /已保存记忆/)

  const found = await rpc('tools/call', {
    name: 'search_memory', arguments: { query: '青柠-827' },
  })
  assert.equal(found.result.structuredContent.memories.length, 1)
  assert.equal(found.result.structuredContent.memories[0].id, 'memory-smoke')

  await logic.syncNow()
  const materializedPath = join(hostPath, 'memories', 'mcp', 'memory.md')
  assert.match(readFileSync(materializedPath, 'utf8'), /青柠-827/)

  const forgotten = await rpc('tools/call', {
    name: 'forget_memory', arguments: { id: 'memory-smoke' },
  })
  assert.equal(forgotten.result.structuredContent.deleted, true)
  const missing = await rpc('tools/call', {
    name: 'search_memory', arguments: { query: '青柠-827' },
  })
  assert.equal(missing.result.structuredContent.memories.length, 0)
  await logic.syncNow()
  assert.equal(existsSync(materializedPath), false)
} finally {
  child.kill()
  server.dispose()
  rmSync(temp, { recursive: true, force: true })
}

console.log('one-way bridge and MCP memory tests passed')
