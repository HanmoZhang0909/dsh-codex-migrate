import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import readline from 'node:readline'

const CLIENT_INFO = Object.freeze({ name: 'dsh-codex-bridge', title: 'DSH Codex Migration', version: '2.0.0' })

function executableCandidates() {
  const candidates = []
  for (const value of [process.env.DSH_CODEX_CLI, process.env.CODEX_CLI_PATH]) {
    if (typeof value === 'string' && value.trim() !== '') candidates.push(value.trim())
  }
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local')
    const binRoot = join(local, 'OpenAI', 'Codex', 'bin')
    try {
      const installed = []
      for (const entry of readdirSync(binRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const path = join(binRoot, entry.name, 'codex.exe')
        if (existsSync(path)) installed.push({ path, mtimeMs: statSync(path).mtimeMs })
      }
      installed.sort((left, right) => right.mtimeMs - left.mtimeMs)
      candidates.push(...installed.map((entry) => entry.path))
    } catch (error) { /* Fall through to PATH. */ }
    candidates.push('codex.exe')
  } else candidates.push('codex')
  return candidates
}

export function resolveCodexExecutable() {
  return executableCandidates().find((candidate) => !candidate.includes('/') && !candidate.includes('\\') || existsSync(candidate)) || 'codex'
}

function responseItems(turns) {
  return (Array.isArray(turns) ? turns : []).flatMap((turn) => {
    if (!turn || (turn.role !== 'user' && turn.role !== 'assistant')) return []
    const text = typeof turn.text === 'string' ? turn.text : typeof turn.content === 'string' ? turn.content : ''
    if (text.trim() === '') return []
    return [{
      type: 'message',
      role: turn.role,
      content: [{ type: turn.role === 'user' ? 'input_text' : 'output_text', text }],
    }]
  })
}

function claudeProjectDirectory(cwd) {
  return String(cwd || '').replace(/[:\\/]/g, '-') || 'home'
}

function claudeTranscript(seed) {
  if (Array.isArray(seed.transcript) && seed.transcript.length > 0) return seed.transcript
  return (Array.isArray(seed.turns) ? seed.turns : []).flatMap((turn) => {
    if (!turn || (turn.role !== 'user' && turn.role !== 'assistant')) return []
    const text = typeof turn.text === 'string' ? turn.text : typeof turn.content === 'string' ? turn.content : ''
    if (text.trim() === '') return []
    return [{ role: turn.role, content: [{ type: 'text', text }], createdAtMs: turn.createdAtMs }]
  })
}

function claudeMessageContent(entry) {
  const blocks = (Array.isArray(entry?.content) ? entry.content : []).flatMap((item) => {
    if (item?.type === 'text' && typeof item.text === 'string' && item.text !== '') return [{ type: 'text', text: item.text }]
    if (entry.role === 'assistant' && item?.type === 'tool_use' && typeof item.id === 'string' && item.id !== '') {
      return [{ type: 'tool_use', id: item.id, name: String(item.name || 'tool'), input: item.input && typeof item.input === 'object' ? item.input : {} }]
    }
    if (entry.role === 'user' && item?.type === 'tool_result' && typeof item.tool_use_id === 'string' && item.tool_use_id !== '') {
      return [{ type: 'tool_result', tool_use_id: item.tool_use_id, content: typeof item.content === 'string' ? item.content : '' }]
    }
    return []
  })
  if (entry.role === 'user' && blocks.length > 0 && blocks.every((item) => item.type === 'text')) {
    return blocks.map((item) => item.text).join('\n')
  }
  return blocks
}

function claudeSessionJsonl(seed = {}) {
  const sessionId = randomUUID()
  let parentUuid = null
  const cwd = typeof seed.workspace === 'string' && seed.workspace !== '' ? seed.workspace : os.homedir()
  const transcript = claudeTranscript(seed)
  const baseTime = Date.now() - Math.max(1, transcript.length) * 1000
  const lines = []
  for (const [index, entry] of transcript.entries()) {
    if (!entry || (entry.role !== 'user' && entry.role !== 'assistant')) continue
    const content = claudeMessageContent(entry)
    if (content === '' || Array.isArray(content) && content.length === 0) continue
    const uuid = randomUUID()
    lines.push(JSON.stringify({
      type: entry.role,
      uuid,
      parentUuid,
      sessionId,
      cwd,
      message: { role: entry.role, content },
      timestamp: new Date(baseTime + index * 1000).toISOString(),
    }))
    parentUuid = uuid
  }
  if (lines.length === 0) {
    lines.push(JSON.stringify({
      type: 'user', uuid: randomUUID(), parentUuid: null, sessionId, cwd,
      message: { role: 'user', content: '从 DSH 继续此对话。' }, timestamp: new Date().toISOString(),
    }))
  }
  return `${lines.join('\n')}\n`
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

class JsonRpcProcess {
  constructor(executable, timeoutMs, env) {
    this.timeoutMs = timeoutMs
    this.nextId = 1
    this.pending = new Map()
    this.stderr = ''
    this.child = spawn(executable, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env })
    this.lines = readline.createInterface({ input: this.child.stdout, crlfDelay: Infinity })
    this.lines.on('line', (line) => this.onLine(line))
    this.child.stderr.setEncoding('utf8')
    this.child.stderr.on('data', (chunk) => { this.stderr = (this.stderr + chunk).slice(-8000) })
    this.child.on('error', (error) => this.rejectAll(error))
    this.child.on('exit', (code) => this.rejectAll(new Error(`Codex app-server exited before replying (${code ?? 'unknown'}): ${this.stderr.trim()}`)))
  }

  onLine(line) {
    let message
    try { message = JSON.parse(line) } catch (error) { return }
    if (message.id === undefined || message.id === null) return
    const pending = this.pending.get(String(message.id))
    if (!pending) return
    this.pending.delete(String(message.id))
    clearTimeout(pending.timer)
    if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)))
    else pending.resolve(message.result)
  }

  request(method, params = {}) {
    const id = String(this.nextId++)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex app-server timed out while calling ${method}`))
      }, this.timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  }

  notify(method, params = {}) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }

  async close() {
    this.lines.close()
    if (this.child.exitCode !== null) return
    await new Promise((resolve) => {
      let settled = false
      const finish = () => { if (!settled) { settled = true; resolve() } }
      this.child.once('exit', finish)
      this.child.stdin.end()
      const timer = setTimeout(() => {
        if (this.child.exitCode === null) this.child.kill()
        finish()
      }, 2000)
      timer.unref?.()
    })
  }
}

async function withClient(options, callback) {
  const rpc = new JsonRpcProcess(options.executable || resolveCodexExecutable(), options.timeoutMs || 20000, options.env || process.env)
  try {
    await rpc.request('initialize', {
      clientInfo: options.clientInfo || CLIENT_INFO,
      capabilities: { experimentalApi: true, optOutNotificationMethods: [] },
    })
    rpc.notify('initialized')
    return await callback(rpc)
  } finally { await rpc.close() }
}

function normalizedPath(value) {
  return String(value || '').replace(/\\/g, '/').toLocaleLowerCase()
}

async function importThreads(options, seeds, workspace) {
  const preparedSeeds = (Array.isArray(seeds) ? seeds : []).filter((seed) => seed && typeof seed === 'object')
  if (preparedSeeds.length === 0) throw new Error('At least one DSH conversation is required for Codex import')
  const cwd = typeof workspace === 'string' && workspace.trim() !== ''
    ? workspace.trim()
    : typeof preparedSeeds[0].workspace === 'string' && preparedSeeds[0].workspace.trim() !== ''
      ? preparedSeeds[0].workspace.trim()
      : os.homedir()
  const realCodexHome = process.env.CODEX_HOME || join(os.homedir(), '.codex')
  const importHome = mkdtempSync(join(os.tmpdir(), 'dsh-codex-visible-import-'))
  const projectDir = join(importHome, '.claude', 'projects', claudeProjectDirectory(cwd))
  mkdirSync(projectDir, { recursive: true })
  const prepared = preparedSeeds.map((seed) => {
    const sessionPath = join(projectDir, `${randomUUID()}.jsonl`)
    writeFileSync(sessionPath, claudeSessionJsonl({ ...seed, workspace: cwd }), 'utf8')
    return { seed, sessionPath }
  })
  const requestedPaths = new Set(prepared.map((item) => normalizedPath(item.sessionPath)))
  const env = { ...process.env, HOME: importHome, USERPROFILE: importHome, CODEX_HOME: realCodexHome }
  try {
    return await withClient({ ...options, env, timeoutMs: Math.max(options.timeoutMs || 20000, 30000) }, async (rpc) => {
      const detected = await rpc.request('externalAgentConfig/detect', {
        cwds: [cwd], includeHome: true, maxSessions: Math.max(10, prepared.length + 5), maxSessionAgeDays: 1,
      })
      const migrationItems = (Array.isArray(detected?.items) ? detected.items : []).flatMap((item) => {
        if (item?.itemType !== 'SESSIONS' || !Array.isArray(item?.details?.sessions)) return []
        const sessions = item.details.sessions.filter((session) => requestedPaths.has(normalizedPath(session?.path)))
        return sessions.length > 0 ? [{ ...item, cwd, details: { ...item.details, sessions } }] : []
      })
      const detectedCount = migrationItems.reduce((sum, item) => sum + item.details.sessions.length, 0)
      if (detectedCount !== prepared.length) {
        throw new Error(`Codex detected ${detectedCount} of ${prepared.length} prepared DSH conversations`)
      }
      const started = await rpc.request('externalAgentConfig/import', {
        migrationItems, providerId: 'dsh-codex-bridge', source: 'dsh-codex-bridge',
      })
      const importId = String(started?.importId || '')
      if (!importId) throw new Error('Codex migration did not return an import ID')
      let completed = null
      const deadline = Date.now() + Math.max(options.timeoutMs || 20000, 30000)
      while (Date.now() < deadline) {
        const histories = await rpc.request('externalAgentConfig/import/readHistories')
        completed = (Array.isArray(histories?.data) ? histories.data : []).find((item) => item?.importId === importId) || null
        if (completed) break
        await delay(100)
      }
      if (!completed) throw new Error('Codex conversation import timed out')
      if (Array.isArray(completed.failures) && completed.failures.length > 0) {
        throw new Error(`Codex conversation import failed: ${completed.failures.map((item) => item?.error || item?.message || 'unknown').join('; ')}`)
      }
      const successes = (Array.isArray(completed.successes) ? completed.successes : [])
        .filter((item) => item?.itemType === 'SESSIONS' && typeof item?.target === 'string' && item.target !== '')
      if (successes.length !== prepared.length) {
        throw new Error(`Codex imported ${successes.length} of ${prepared.length} DSH conversations`)
      }
      const unused = [...prepared]
      const imported = []
      for (const success of successes) {
        let index = unused.findIndex((item) => normalizedPath(item.sessionPath) === normalizedPath(success.source))
        if (index < 0 && typeof success.title === 'string') {
          index = unused.findIndex((item) => item.seed.title === success.title)
        }
        if (index < 0) index = 0
        const [item] = unused.splice(index, 1)
        const id = String(success.target)
        if (typeof item.seed.title === 'string' && item.seed.title.trim() !== '') {
          await rpc.request('thread/name/set', { threadId: id, name: item.seed.title.trim().slice(0, 240) })
        }
        imported.push({
          id,
          projectId: null,
          openUrl: `codex://threads/${encodeURIComponent(id)}`,
          sourcePath: item.sessionPath,
          seed: item.seed,
        })
      }
      const bySeed = new Map(imported.map((item) => [item.seed, item]))
      return prepared.map((item) => bySeed.get(item.seed))
    })
  } finally {
    rmSync(importHome, { recursive: true, force: true })
  }
}

export function createCodexAppServer(options = {}) {
  return Object.freeze({
    async createThread(seed = {}) {
      const cwd = typeof seed.workspace === 'string' && seed.workspace !== '' ? seed.workspace : os.homedir()
      return (await importThreads(options, [seed], cwd))[0]
    },
    async createProjectThreads(seed = {}) {
      const workspace = typeof seed.workspace === 'string' ? seed.workspace.trim() : ''
      if (workspace === '') throw new Error('DSH project path is required for Codex project import')
      return importThreads(options, seed.sessions, workspace)
    },
    async appendTurns(threadId, turns) {
      const items = responseItems(turns)
      if (items.length === 0) return { appended: 0 }
      return withClient(options, async (rpc) => {
        await rpc.request('thread/inject_items', { threadId, items })
        return { appended: items.length }
      })
    },
    async readThread(threadId) {
      return withClient(options, (rpc) => rpc.request('thread/read', { threadId, includeTurns: true }))
    },
    async archiveThread(threadId) {
      return withClient(options, (rpc) => rpc.request('thread/archive', { threadId }))
    },
  })
}

export { responseItems as codexResponseItems }
export { claudeSessionJsonl as codexVisibleImportJsonl }
