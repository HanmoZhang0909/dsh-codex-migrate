import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { createMemoryStore } from './memory-store.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, '.codex-plugin', 'plugin.json'), 'utf8'))
const SERVER_NAME = 'dsh-codex-bridge'
const SERVER_VERSION = MANIFEST.version || '2.0.0'
const TOKEN_PATH = process.env.DSH_CODEX_BRIDGE_TOKEN_FILE || path.join(os.homedir(), '.codex', 'dsh-codex-bridge', 'install-token')
const MEMORY_PATH = process.env.DSH_CODEX_BRIDGE_MEMORY_FILE || path.join(os.homedir(), '.codex', 'dsh-codex-bridge', 'memory.jsonl')
const BRIDGE_PORT = Number.parseInt(process.env.DSH_CODEX_BRIDGE_PORT || '46371', 10)
const memoryStore = createMemoryStore(MEMORY_PATH)
const iconSvg = fs.readFileSync(path.join(ROOT, 'assets', 'dsh.svg'), 'utf8')
const ICON = { src: `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`, mimeType: 'image/svg+xml', sizes: ['64x64'] }

const SERVER_INSTRUCTIONS = [
  'When the user explicitly asks “在 DSH 继续” or “Continue in DSH”, call continue_in_dsh with the current Codex task ID.',
  'The tool performs a one-way structured import and asks the DSH client to open the imported conversation.',
  'After a successful call, reply with exactly: 已同步对话到 DSH。',
  'Do not render an inline panel, register a shared conversation, monitor DSH, or route later messages.',
  'When the user explicitly asks to remember persistent information, call remember_memory.',
  'When the user asks to recall or search saved information, call search_memory.',
  'When the user explicitly asks to forget a saved item, call forget_memory.',
  'Memory tools are local and independent from conversation migration.',
].join(' ')

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }

function remoteCall(method, args = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ method, args })
    let token = ''
    try { token = fs.readFileSync(TOKEN_PATH, 'utf8').trim() } catch (error) { /* Host availability is reported below. */ }
    const req = http.request({
      host: '127.0.0.1', port: Number.isInteger(BRIDGE_PORT) ? BRIDGE_PORT : 46371,
      path: '/rpc', method: 'POST', timeout: 30000,
      headers: {
        'content-type': 'application/json', 'content-length': Buffer.byteLength(body),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (res.statusCode !== 200 || payload?.ok === false) reject(new Error(payload?.error?.message || `DSH bridge returned HTTP ${res.statusCode}`))
          else resolve(payload.result ?? payload.value)
        } catch (error) { reject(error) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('DSH bridge timed out.')))
    req.on('error', (error) => reject(new Error(`DSH bridge is not active: ${error.message}`)))
    req.end(body)
  })
}

function objectSchema(properties, required = []) {
  return { type: 'object', properties, required, additionalProperties: false }
}

function toolDefinitions() {
  const scopeProperties = {
    scopeKind: {
      type: 'string', enum: ['global', 'project', 'conversation'], default: 'global',
      description: 'Memory scope. Use global unless the user explicitly requests project- or conversation-local memory.',
    },
    scopeId: {
      type: 'string', default: 'default',
      description: 'Stable scope identifier. For project scope use its absolute workspace path; for conversation scope use the task ID.',
    },
  }
  return [
    {
      name: 'continue_in_dsh',
      title: 'Continue in DSH',
      description: 'Import the current Codex task into DSH once and open the new DSH conversation.',
      inputSchema: objectSchema({
        codexConversationId: { type: 'string', description: 'The current Codex task ID.' },
        title: { type: 'string' },
        workspace: { type: 'string' },
        message: { type: 'string' },
      }, ['codexConversationId']),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    {
      name: 'remember_memory',
      title: 'Remember Memory',
      description: 'Persist a fact, preference, or instruction in the local DSH Codex bridge memory store.',
      inputSchema: objectSchema({
        content: { type: 'string', minLength: 1, description: 'The concise information to remember.' },
        kind: { type: 'string', default: 'fact', description: 'Memory kind, such as fact, preference, or instruction.' },
        tags: { type: 'array', items: { type: 'string' }, maxItems: 20, default: [] },
        id: { type: 'string', description: 'Optional stable ID when intentionally updating an existing memory.' },
        ...scopeProperties,
      }, ['content']),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'search_memory',
      title: 'Search Memory',
      description: 'Search persistent local bridge memories in one scope.',
      inputSchema: objectSchema({
        query: { type: 'string', default: '', description: 'Case-insensitive text query. Leave empty to list recent memories in the scope.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        ...scopeProperties,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: 'forget_memory',
      title: 'Forget Memory',
      description: 'Delete one persistent local bridge memory by its ID.',
      inputSchema: objectSchema({
        id: { type: 'string', minLength: 1, description: 'The memory ID returned by remember_memory or search_memory.' },
        ...scopeProperties,
      }, ['id']),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
  ]
}

function textResult(payload, message) {
  return { content: [{ type: 'text', text: message }], structuredContent: payload }
}

async function callTool(name, args) {
  const scopeKind = typeof args.scopeKind === 'string' && args.scopeKind ? args.scopeKind : 'global'
  const scopeId = typeof args.scopeId === 'string' && args.scopeId.trim() ? args.scopeId.trim() : 'default'
  if (name === 'remember_memory') {
    const result = memoryStore.remember({ ...args, scopeKind, scopeId })
    return textResult({ ...result, scopeKind, scopeId }, result.unchanged ? `记忆已存在：${result.memory.id}` : `已保存记忆：${result.memory.id}`)
  }
  if (name === 'search_memory') {
    const limit = Number.isInteger(args.limit) ? Math.min(50, Math.max(1, args.limit)) : 20
    const result = memoryStore.search({ scopeKind, scopeId, query: typeof args.query === 'string' ? args.query : '' })
    const memories = result.memories.slice(0, limit)
    const message = memories.length === 0
      ? '未找到匹配的记忆。'
      : memories.map((memory) => `- ${memory.id}: ${memory.content}`).join('\n')
    return textResult({ memories, cursor: result.cursor, scopeKind, scopeId }, message)
  }
  if (name === 'forget_memory') {
    if (typeof args.id !== 'string' || args.id.trim() === '') throw new Error('Memory ID is required.')
    const result = memoryStore.forget({ scopeKind, scopeId, id: args.id.trim() })
    return textResult({ ...result, id: args.id.trim(), scopeKind, scopeId }, result.deleted ? `已删除记忆：${args.id.trim()}` : `未找到记忆：${args.id.trim()}`)
  }
  if (name !== 'continue_in_dsh') throw new Error(`Unknown tool: ${name}`)
  if (typeof args.codexConversationId !== 'string' || args.codexConversationId.trim() === '') throw new Error('The current Codex task ID is required.')
  const bridgeId = `import-${Date.now()}-${args.codexConversationId.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 80)}`
  const registered = await remoteCall('registerBridgeConversation', { ...args, bridgeId })
  const imported = await remoteCall('continueBridgeConversation', {
    bridgeId: registered.bridgeId,
    message: typeof args.message === 'string' ? args.message : '',
  })
  return textResult({
    codexConversationId: imported.codexConversationId,
    dshConversationId: imported.dshConversationId,
    imported: true,
  }, '已同步对话到 DSH。')
}

function rpcResponse(id, result) { return { jsonrpc: '2.0', id, result } }
function rpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } } }

async function handleRpc(message) {
  if (!isObject(message)) return rpcError(null, -32600, 'Invalid Request')
  const id = message.id
  const method = message.method
  const params = isObject(message.params) ? message.params : {}
  if (typeof method !== 'string') return id != null ? rpcError(id, -32600, 'Invalid Request') : null
  if (method.startsWith('notifications/') || method === '$/cancelRequest') return null
  if (method === 'initialize') return rpcResponse(id, {
    protocolVersion: params.protocolVersion || '2024-11-05',
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: SERVER_NAME, title: 'DSH Codex Migration', version: SERVER_VERSION, description: MANIFEST.description, icons: [ICON] },
    instructions: SERVER_INSTRUCTIONS,
  })
  if (method === 'ping') return rpcResponse(id, {})
  if (method === 'tools/list') return rpcResponse(id, { tools: toolDefinitions() })
  if (method === 'tools/call') {
    if (typeof params.name !== 'string') return rpcError(id, -32602, 'tools/call requires a tool name')
    try { return rpcResponse(id, await callTool(params.name, isObject(params.arguments) ? params.arguments : {})) }
    catch (error) {
      const messageText = error?.message || String(error)
      return rpcResponse(id, { ...textResult({ ok: false, error: messageText }, messageText), isError: true })
    }
  }
  if (method === 'prompts/list') return rpcResponse(id, { prompts: [] })
  return rpcError(id, -32601, `Method not found: ${method}`)
}

function runStdio() {
  const lines = readline.createInterface({ input: process.stdin })
  lines.on('line', async (line) => {
    if (!line.trim()) return
    try {
      const response = await handleRpc(JSON.parse(line))
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`)
    } catch (error) { process.stdout.write(`${JSON.stringify(rpcError(null, -32700, `Parse error: ${error.message}`))}\n`) }
  })
}

export { SERVER_NAME, SERVER_VERSION, toolDefinitions, callTool, handleRpc }

if (process.argv.includes('--stdio')) runStdio()
