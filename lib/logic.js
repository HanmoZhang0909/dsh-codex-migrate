// Migration logic core, shared by the remote service methods.
// Static host plugins run as ordinary Node ESM in the deployment process:
// local filesystem access uses node:fs directly (no per-session sandbox).
// Safety boundary (documented in README): this plugin only WRITES inside
// `outputDir` (default <DSH_HOME>/codex-sync) and only READS the Codex dir.
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import os from 'node:os'
import { hostZh, hostEn } from './i18n.js'

const IGNORE_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next', '.cache', '.idea', '.vscode', 'codex-sync', '.codex-sync'])

export const DEFAULTS = {
  codexDir: '',
  outputDir: '',
  language: 'en',
  syncIntervalMinutes: 0,
  autoSync: false,
  includeSessions: true,
  includeArchived: true,
  includeMcp: true,
  includeMemories: true,
  includeAgentsMd: true,
  includeProjectFiles: false,
  importAsDshSessions: true,
  includeUserSessions: true,
  includeSubagentSessions: false,
  includeUnknownSessions: true,
  sessionMode: 'new',
  selectedSessionIds: [],
  excludedSessionIds: [],
  projectMode: 'all',
  selectedProjects: [],
  mcpMode: 'all',
  selectedMcpNames: [],
  maxMessagesPerSession: 600,
  maxToolOutputChars: 6000,
  maxProjectFileBytes: 524288,
  maxProjectFilesPerSync: 2000,
  dshMessageMaxChars: 20000,
  maxDshTurns: 200,
}

const ARRAY_KEYS = ['selectedSessionIds', 'selectedMcpNames', 'selectedProjects', 'excludedSessionIds']
const STRING_KEYS = ['codexDir', 'outputDir', 'language', 'sessionMode', 'projectMode', 'mcpMode']
const BOOL_KEYS = ['autoSync', 'includeSessions', 'includeArchived', 'includeMcp', 'includeMemories', 'includeAgentsMd', 'includeProjectFiles', 'importAsDshSessions', 'includeUserSessions', 'includeSubagentSessions', 'includeUnknownSessions']
const NUMBER_KEYS = ['syncIntervalMinutes', 'maxMessagesPerSession', 'maxToolOutputChars', 'maxProjectFileBytes', 'maxProjectFilesPerSync', 'dshMessageMaxChars', 'maxDshTurns']

function errCode(err) { return err && typeof err === 'object' && typeof err.code === 'string' ? err.code : 'UNKNOWN' }
function errMsg(err) { return err && typeof err === 'object' && typeof err.message === 'string' ? err.message : String(err) }

export function createLogic(ctx, rowConfig, home) {
  const config = Object.assign({}, DEFAULTS)
  for (const key of Object.keys(rowConfig || {})) {
    if (!Object.hasOwn(DEFAULTS, key)) continue
    config[key] = rowConfig[key]
  }
  let runtimeLang = 'en'
  const persistence = ctx.get('sessionPersistence')
  const workspaceRegistry = ctx.get('workspaceRegistry')

  function lang() {
    if (config.language === 'zh') return 'zh'
    if (config.language === 'en') return 'en'
    return runtimeLang === 'zh' ? 'zh' : 'en'
  }
  function L(key, params) {
    const dict = lang() === 'zh' ? hostZh : hostEn
    let template = dict[key]
    if (template === undefined) template = key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m))
  }

  const state = { sessions: {}, memories: {}, agentsMd: null, dshPrefix: 'cx3' }
  const status = {
    syncing: false,
    codexDirDetected: null,
    lastSyncAtMs: null,
    lastSyncDurationMs: null,
    lastSyncResult: null,
    nextSyncAtMs: null,
  }
  const initLog = { ran: false, ok: false, error: null, steps: [] }
  const lastErrors = []
  let intervalDisposer = null
  let activeSync = null

  function pushError(where, err) {
    const entry = { at: Date.now(), path: where, code: errCode(err), message: errMsg(err) }
    lastErrors.push(entry)
    if (lastErrors.length > 20) lastErrors.shift()
  }

  function computeOutRoot() {
    if (typeof config.outputDir === 'string' && config.outputDir.trim() !== '') return config.outputDir.trim()
    return join(home, 'codex-sync')
  }
  let outRoot = computeOutRoot()

  // ---------- fs helpers (node:fs) ----------
  function statOf(path) {
    try {
      const s = statSync(path)
      if (!s.isFile() && !s.isDirectory()) return undefined
      return { type: s.isDirectory() ? 'directory' : 'file', size: s.size, version: String(s.mtimeMs) }
    } catch (err) { return undefined }
  }
  function readTextOf(path) { return readFileSync(path, 'utf8') }
  function writeTextOf(path, content) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, 'utf8')
  }
  function deleteFileOf(path) {
    try { rmSync(path, { force: true }) } catch (err) {
      throw new Error(L('errDelete', { v: errMsg(err) }))
    }
  }
  async function loadJson(path) {
    try {
      const parsed = JSON.parse(readTextOf(path))
      return parsed && typeof parsed === 'object' ? parsed : undefined
    } catch (err) { return undefined }
  }
  async function persistConfig() {
    try { writeTextOf(join(outRoot, 'config.json'), JSON.stringify(config, null, 2)) } catch (err) { pushError(join(outRoot, 'config.json'), err) }
  }
  async function persistState() {
    try { writeTextOf(join(outRoot, 'state.json'), JSON.stringify(state, null, 2)) } catch (err) { pushError(join(outRoot, 'state.json'), err) }
  }
  function markExcluded(groupKey) {
    if (config.excludedSessionIds.indexOf(groupKey) < 0) config.excludedSessionIds.push(groupKey)
  }
  function clearExcluded(groupKey) {
    const i = config.excludedSessionIds.indexOf(groupKey)
    if (i >= 0) config.excludedSessionIds.splice(i, 1)
  }

  // ---------- Codex directory detection (cross-platform) ----------
  function probeCodex(preferred) {
    const steps = []
    const candidates = []
    if (typeof preferred === 'string' && preferred.trim() !== '') candidates.push(preferred.trim())
    const homeDir = os.homedir()
    candidates.push(join(homeDir, '.codex'))
    if (process.platform === 'win32') {
      const usersRoot = join(homeDir, '..')
      try {
        const entries = readdirSync(usersRoot, { withFileTypes: true })
        steps.push({ path: usersRoot, ok: true, count: entries.length })
        const skip = new Set(['public', 'default', 'default user', 'all users', 'defaultuser0', 'administrator', 'guest'])
        for (const entry of entries) {
          if (entry.isDirectory() && typeof entry.name === 'string' && !skip.has(entry.name.toLowerCase())) {
            candidates.push(join(usersRoot, entry.name, '.codex'))
          }
        }
      } catch (err) {
        steps.push({ path: usersRoot, ok: false, code: errCode(err), message: errMsg(err) })
      }
    }
    for (const candidate of candidates) {
      const st = statOf(candidate)
      steps.push({ path: candidate, ok: st !== undefined, type: st ? st.type : 'absent' })
      if (st !== undefined && st.type === 'directory') return { found: candidate, steps }
    }
    return { found: '', steps }
  }
  async function detectCodexDir(preferred) {
    return probeCodex(preferred).found
  }

  // ---------- session_index.jsonl ----------
  async function loadSessionIndex(codexDir) {
    const indexPath = join(codexDir, 'session_index.jsonl')
    const st = statOf(indexPath)
    if (st === undefined) return { ok: false, entries: {} }
    try {
      const text = readTextOf(indexPath)
      const entries = {}
      for (const raw of text.split(/\r?\n/)) {
        if (raw.trim() === '') continue
        try {
          const line = JSON.parse(raw)
          if (line && typeof line === 'object' && typeof line.id === 'string') {
            entries[line.id] = {
              id: line.id,
              title: typeof line.thread_name === 'string' ? line.thread_name : '',
              updatedAt: typeof line.updated_at === 'string' ? line.updated_at : '',
            }
          }
        } catch (err) { /* skip */ }
      }
      return { ok: true, entries }
    } catch (err) {
      return { ok: false, entries: {} }
    }
  }

  // ---------- session JSONL parsing ----------
  function extractText(content) {
    if (!Array.isArray(content)) return ''
    let out = ''
    for (const block of content) {
      if (block && typeof block === 'object' && typeof block.text === 'string') {
        out += (out === '' ? '' : '\n') + block.text
      }
    }
    return out
  }
  function extractOutput(output) {
    if (!output) return ''
    if (typeof output === 'string') return output
    if (typeof output.text === 'string') return output.text
    if (Array.isArray(output)) {
      let out = ''
      for (const block of output) {
        if (block && typeof block === 'object' && typeof block.text === 'string') {
          out += (out === '' ? '' : '\n') + block.text
        }
      }
      return out
    }
    return ''
  }
  function stripTranscriptDeltas(text) {
    if (typeof text !== 'string' || text.indexOf('TRANSCRIPT DELTA') < 0) return { main: text, deltas: [] }
    const deltas = []
    let main = text
    main = main.replace(/>>>\s*TRANSCRIPT DELTA\s*START([\s\S]*?)>>>\s*TRANSCRIPT DELTA\s*END/g, (m, body) => {
      deltas.push(body)
      return '\n'
    })
    const openIdx = main.indexOf('>>> TRANSCRIPT DELTA START')
    if (openIdx >= 0) main = main.slice(0, openIdx)
    main = main.replace(/\n{3,}/g, '\n\n').trim()
    return { main, deltas }
  }
  function foldDeltas(deltas, maxChars) {
    if (!Array.isArray(deltas) || deltas.length === 0) return ''
    const kept = deltas.slice(0, 5).map((d) => truncate(String(d).trim(), maxChars))
    return '\n\n<details><summary>📜 ' + L('mdToolOut') + ' (' + deltas.length + ')</summary>\n\n```\n' + kept.join('\n\n---\n\n') + '\n```\n</details>'
  }
  function cleanToolOutput(s) {
    let out = String(s)
    out = out.replace(/^Script failed[\s\S]*?\nOutput:\s*/i, '[execution failed]\n')
    out = out.replace(/^Script (?:completed|running)[\s\S]*?\nOutput:\s*/i, '')
    return out.trim()
  }
  function extractExecCmd(script) {
    const m = String(script).match(/exec_command\(\{\s*cmd:\s*"((?:[^"\\]|\\.)*)"/)
    if (!m) return ''
    return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
  }
  const INJECT_TAGS = ['environment_context', 'recommended_plugins', 'subagent_notification', 'turn_aborted', 'app-context', 'app_context', 'skills_instructions', 'system_context', 'instructions', 'user_instructions', 'developer_context', 'context', 'codex_internal_context', 'permissions']
  function cleanUserText(content) {
    if (!Array.isArray(content)) return { text: '', deltas: [] }
    const parts = []
    const allDeltas = []
    for (const block of content) {
      if (!block || typeof block !== 'object' || typeof block.text !== 'string') continue
      const tagM = String(block.text).match(/^\s*<([a-z][a-z0-9_-]*)(?:\s[^>]*)?>/)
      if (tagM && INJECT_TAGS.indexOf(tagM[1].toLowerCase()) >= 0) continue
      const cleaned = stripTranscriptDeltas(block.text)
      if (cleaned.main.trim() !== '') parts.push(cleaned.main.trim())
      for (const d of cleaned.deltas) allDeltas.push(d)
    }
    return { text: parts.join('\n').trim(), deltas: allDeltas }
  }
  function cleanUserTextStr(text) {
    if (typeof text !== 'string') return { text: '', deltas: [] }
    const tagM = text.match(/^\s*<([a-z][a-z0-9_-]*)(?:\s[^>]*)?>/)
    if (tagM && INJECT_TAGS.indexOf(tagM[1].toLowerCase()) >= 0) return { text: '', deltas: [] }
    return stripTranscriptDeltas(text)
  }
  function truncate(value, max) {
    if (value.length <= max) return value
    return value.slice(0, max) + '\n…(' + (value.length - max) + ' chars truncated)'
  }
  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function idFromFileName(fileName) {
    const m = String(fileName).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    return m ? m[0] : 'x'
  }
  function projectNameOf(key) {
    if (key === '' || key === '(no project)') return '(no project)'
    const parts = String(key).split(/[\\/]/).filter((p) => p !== '')
    return parts.length > 0 ? parts[parts.length - 1] : key
  }
  function safeDirName(name, key) {
    let s = String(name).replace(/[^A-Za-z0-9_\u4e00-\u9fa5-]/g, '_').slice(0, 40)
    if (s === '') s = 'project'
    let hash = 0
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
    return s + '--' + hash.toString(16).slice(0, 6)
  }
  function kindOf(threadSource) {
    if (threadSource === 'user') return 'user'
    if (threadSource === 'subagent') return 'subagent'
    return 'unknown'
  }
  function kindAllowed(kind) {
    if (kind === 'user') return config.includeUserSessions
    if (kind === 'subagent') return config.includeSubagentSessions
    return config.includeUnknownSessions
  }
  function kindLabel(kind) {
    if (kind === 'user') return L('kindUser')
    if (kind === 'subagent') return L('kindSubagent')
    return L('kindOther')
  }

  function parseSession(text, cfg, fileName) {
    const maxTool = Number.isFinite(cfg.maxToolOutputChars) && cfg.maxToolOutputChars > 0 ? cfg.maxToolOutputChars : 2000
    const meta = { sessionId: '', cwd: '', originator: '', source: '', cliVersion: '', date: '', threadSource: '' }
    const blocks = []
    let skipped = 0
    let firstRoot = ''
    const seenUser = {}
    const seenAssist = {}
    const userQueue = []
    const assistQueue = []
    const skipWaitCalls = {}
    function pushDedup(set, queue, key, cap) {
      if (set[key]) return false
      set[key] = true
      queue.push(key)
      if (queue.length > cap) delete set[queue.shift()]
      return true
    }
    function dedupKey(t) {
      const s = String(t)
      return s.length + ':' + s.slice(0, 240)
    }
    function pushUser(text, deltas) {
      const t = String(text).trim()
      if (t === '') return
      const withFold = t + foldDeltas(deltas, maxTool)
      if (!pushDedup(seenUser, userQueue, dedupKey(t), 6)) return
      blocks.push({ kind: 'user', text: withFold })
    }
    function pushAssist(text, deltas) {
      const t = String(text).trim()
      if (t === '') return
      const withFold = t + foldDeltas(deltas, maxTool)
      if (!pushDedup(seenAssist, assistQueue, dedupKey(t), 12)) return
      blocks.push({ kind: 'assistant', text: withFold })
    }
    const lines = String(text).split(/\r?\n/)
    for (const raw of lines) {
      if (raw.trim() === '') continue
      let line
      try { line = JSON.parse(raw) } catch (err) { skipped++; continue }
      if (!line || typeof line !== 'object') { skipped++; continue }
      const p = line.payload && typeof line.payload === 'object' ? line.payload : null
      if (line.type === 'session_meta' && p) {
        meta.sessionId = String(p.session_id || p.id || '')
        meta.cwd = String(p.cwd || '')
        meta.originator = String(p.originator || '')
        meta.source = String(p.source || '')
        meta.cliVersion = String(p.cli_version || '')
        meta.threadSource = String(p.thread_source || '')
        const ts = typeof p.timestamp === 'string' ? p.timestamp : (typeof line.timestamp === 'string' ? line.timestamp : '')
        meta.date = ts.slice(0, 10)
      } else if (line.type === 'turn_context' && p && firstRoot === '') {
        if (Array.isArray(p.workspace_roots) && typeof p.workspace_roots[0] === 'string') firstRoot = p.workspace_roots[0]
      } else if (line.type === 'response_item' && p) {
        if (p.type === 'message') {
          if (p.role === 'user') {
            const cleaned = cleanUserText(p.content)
            pushUser(cleaned.text, cleaned.deltas)
          } else if (p.role === 'assistant') {
            const cleaned = stripTranscriptDeltas(extractText(p.content))
            pushAssist(cleaned.main, cleaned.deltas)
          }
        } else if (p.type === 'function_call') {
          const callId = String(p.call_id || '')
          const name = String(p.name || '')
          if (name === 'wait') { skipWaitCalls[callId] = true; continue }
          const args = typeof p.arguments === 'string' ? p.arguments : JSON.stringify(p.arguments || {})
          blocks.push({ kind: 'tool', name, callId, args: truncate(args, maxTool) })
        } else if (p.type === 'custom_tool_call') {
          const callId = String(p.call_id || '')
          const name = String(p.name || '')
          const script = typeof p.input === 'string' ? p.input : JSON.stringify(p.input || {})
          const argsObj = { script: truncate(script, maxTool) }
          const cmd = extractExecCmd(script)
          if (cmd !== '') argsObj.command = cmd.slice(0, 2000)
          blocks.push({ kind: 'tool', name, callId, args: JSON.stringify(argsObj) })
        } else if (p.type === 'function_call_output') {
          const callId = String(p.call_id || '')
          if (skipWaitCalls[callId]) continue
          const out = cleanToolOutput(extractOutput(p.output))
          if (out !== '') blocks.push({ kind: 'toolOut', name: '', callId, text: truncate(out, maxTool) })
        } else if (p.type === 'custom_tool_call_output') {
          const callId = String(p.call_id || '')
          if (skipWaitCalls[callId]) continue
          const out = cleanToolOutput(extractOutput(p.output))
          if (out !== '') blocks.push({ kind: 'toolOut', name: '', callId, text: truncate(out, maxTool) })
        }
      } else if (line.type === 'event_msg' && p) {
        if (p.type === 'user_message') {
          const cleaned = cleanUserTextStr(p.message)
          pushUser(cleaned.text, cleaned.deltas)
        } else if (p.type === 'agent_message') {
          const cleaned = stripTranscriptDeltas(String(p.message || ''))
          pushAssist(cleaned.main, cleaned.deltas)
        }
      } else if (line.type === 'message' && p) {
        const role = p.role || (p.type === 'user_message' ? 'user' : (p.type === 'assistant_message' ? 'assistant' : ''))
        if (role === 'user') {
          const cleaned = cleanUserText(p.content)
          pushUser(cleaned.text, cleaned.deltas)
        } else if (role === 'assistant') {
          const cleaned = stripTranscriptDeltas(extractText(p.content))
          pushAssist(cleaned.main, cleaned.deltas)
        }
      }
    }
    const sessionId = meta.sessionId !== '' ? meta.sessionId : idFromFileName(fileName)
    const date = meta.date !== '' ? meta.date : 'unknown'
    const project = firstRoot !== '' ? firstRoot : meta.cwd
    const kind = kindOf(meta.threadSource)
    return { meta, blocks, skipped, sessionId, date, project, kind }
  }

  function renderMarkdown(meta, sessionId, blocks, truncatedMsg, skipped, project, title, kind) {
    const lines = []
    lines.push('# ' + (title && title !== '' ? title : L('mdSession') + ' ' + sessionId.slice(0, 8)))
    lines.push('')
    lines.push(L('mdAttrs'))
    lines.push('| --- | --- |')
    if (meta.date !== '') lines.push(L('mdDate', { v: meta.date }))
    lines.push(L('mdId', { v: sessionId }))
    lines.push(L('mdKind', { v: kindLabel(kind) }))
    if (project !== '') lines.push(L('mdProject', { v: project }))
    if (meta.cwd !== '') lines.push(L('mdCwd', { v: meta.cwd }))
    if (meta.originator !== '') lines.push(L('mdOriginator', { v: meta.originator }))
    if (meta.source !== '') lines.push(L('mdSource', { v: meta.source }))
    if (meta.cliVersion !== '') lines.push(L('mdVersion', { v: meta.cliVersion }))
    lines.push(L('mdBlocks', { v: blocks.length + (truncatedMsg ? ' (truncated)' : '') }))
    lines.push('')
    if (truncatedMsg) lines.push(L('mdTruncated'))
    if (skipped > 0) lines.push(L('mdSkipped', { n: skipped }))
    lines.push('')
    lines.push('---')
    lines.push('')
    for (const block of blocks) {
      if (block.kind === 'divider') {
        lines.push('---')
        lines.push('**' + L('mdContinue') + ': `' + String(block.name || '') + '`**')
      } else if (block.kind === 'user') {
        lines.push(L('mdUser'))
        lines.push('')
        lines.push(block.text)
      } else if (block.kind === 'assistant') {
        lines.push(L('mdAssistant'))
        lines.push('')
        lines.push(block.text)
      } else if (block.kind === 'tool') {
        lines.push('<details>')
        lines.push('<summary>' + L('mdToolCall') + ': <code>' + escapeHtml(block.name) + '</code></summary>')
        lines.push('')
        lines.push('```')
        lines.push(typeof block.args === 'string' ? block.args : block.text || '')
        lines.push('```')
        lines.push('</details>')
      } else if (block.kind === 'toolOut') {
        const outLabel = block.name && block.name !== '' ? block.name : (block.callId ? block.callId.slice(0, 12) : 'output')
        lines.push('<details>')
        lines.push('<summary>' + L('mdToolOut') + ': <code>' + escapeHtml(outLabel) + '</code></summary>')
        lines.push('')
        lines.push('```')
        lines.push(block.text)
        lines.push('```')
        lines.push('</details>')
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  function buildIndex(meta) {
    const entries = Object.keys(meta).map((file) => {
      const m = meta[file]
      return m && typeof m === 'object' ? Object.assign({ outFile: file }, m) : null
    }).filter((m) => m !== null)
    entries.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    const lines = []
    lines.push(L('indexTitle'))
    lines.push('')
    lines.push(L('indexGenerated', { n: entries.length }))
    lines.push('')
    lines.push(L('indexCols'))
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const e of entries) {
      lines.push('| ' + (e.date || '') + ' | `' + String(e.sessionId || 'unknown').slice(0, 12) + '` | ' + (e.kindLabel || '') + ' | ' + (e.projectName || '') + ' | ' + (e.title || '') + ' | ' + (e.originator || '') + ' | ' + (e.source || '') + ' | ' + (e.blocks || 0) + ' | [view](sessions/' + e.outFile + ') |')
    }
    return lines.join('\n')
  }

  // ---------- TOML subset (config.toml) ----------
  function stripComment(s) {
    let sq = false, dq = false, esc = false, out = ''
    for (const ch of s) {
      if (esc) { out += ch; esc = false; continue }
      if (ch === '\\' && dq) { out += ch; esc = true; continue }
      if (ch === "'" && !dq) { sq = !sq; out += ch; continue }
      if (ch === '"' && !sq) { dq = !dq; out += ch; continue }
      if (ch === '#' && !sq && !dq) break
      out += ch
    }
    return out
  }
  function bracketBalance(s) {
    let sq = false, dq = false, esc = false, depth = 0
    for (const ch of s) {
      if (esc) { esc = false; continue }
      if (ch === '\\' && dq) { esc = true; continue }
      if (ch === "'" && !dq) sq = !sq
      if (ch === '"' && !sq) dq = !dq
      if (!sq && !dq) {
        if (ch === '[' || ch === '{') depth++
        else if (ch === ']' || ch === '}') depth--
      }
    }
    return depth
  }
  function splitTopLevel(s) {
    const parts = []
    let depth = 0, sq = false, dq = false, esc = false, cur = ''
    for (const ch of s) {
      if (esc) { cur += ch; esc = false; continue }
      if (ch === '\\' && dq) { cur += ch; esc = true; continue }
      if (ch === "'" && !dq) { sq = !sq; cur += ch; continue }
      if (ch === '"' && !sq) { dq = !dq; cur += ch; continue }
      if (!sq && !dq) {
        if (ch === '[' || ch === '{') depth++
        else if (ch === ']' || ch === '}') depth--
        if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue }
      }
      cur += ch
    }
    if (cur.trim() !== '') parts.push(cur.trim())
    return parts
  }
  function decodeBasic(s) {
    return s.replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r')
      .replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  function parseTomlValue(v) {
    v = v.trim()
    if (v === '') return ''
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1)
    if (v.startsWith('"') && v.endsWith('"')) return decodeBasic(v.slice(1, -1))
    if (v.startsWith('[') && v.endsWith(']')) {
      return splitTopLevel(v.slice(1, -1)).map((part) => parseTomlValue(part))
    }
    if (v.startsWith('{') && v.endsWith('}')) {
      const obj = {}
      for (const part of splitTopLevel(v.slice(1, -1))) {
        const eq = part.indexOf('=')
        if (eq < 0) continue
        const key = part.slice(0, eq).trim()
        obj[key] = parseTomlValue(part.slice(eq + 1))
      }
      return obj
    }
    if (v === 'true') return true
    if (v === 'false') return false
    const n = Number(v)
    if (v !== '' && Number.isFinite(n)) return n
    return v
  }
  function parseToml(text) {
    const raw = String(text).split(/\r?\n/)
    const tables = {}
    let current = ''
    let i = 0
    while (i < raw.length) {
      let line = stripComment(raw[i]).trim()
      if (line === '') { i++; continue }
      const sec = line.match(/^\[([^\]]+)\]\s*$/)
      if (sec) {
        current = sec[1].trim()
        if (tables[current] === undefined) tables[current] = {}
        i++
        continue
      }
      const kv = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/)
      if (kv && current !== '') {
        const key = kv[1]
        let rest = kv[2]
        let depth = bracketBalance(rest)
        while (depth !== 0 && i + 1 < raw.length) {
          i++
          rest += '\n' + stripComment(raw[i]).trim()
          depth = bracketBalance(rest)
        }
        tables[current][key] = parseTomlValue(rest)
      }
      i++
    }
    return tables
  }
  function collectMcpServers(tables) {
    const servers = {}
    for (const sec of Object.keys(tables)) {
      const m = sec.match(/^mcp_servers\.(.+)$/)
      if (!m) continue
      const full = m[1]
      if (full.endsWith('.env') || full.endsWith('.headers')) continue
      const t = tables[sec] || {}
      const env = {}
      if (t.env && typeof t.env === 'object' && !Array.isArray(t.env)) Object.assign(env, t.env)
      const envSec = tables['mcp_servers.' + full + '.env']
      if (envSec && typeof envSec === 'object') {
        for (const k of Object.keys(envSec)) env[k] = String(envSec[k])
      }
      const headers = {}
      const headerSec = tables['mcp_servers.' + full + '.headers']
      if (headerSec && typeof headerSec === 'object') {
        for (const k of Object.keys(headerSec)) headers[k] = String(headerSec[k])
      }
      servers[full] = {
        name: full,
        command: t.command != null ? String(t.command) : '',
        args: Array.isArray(t.args) ? t.args.map(String) : [],
        env,
        headers,
        url: t.url != null ? String(t.url) : '',
        type: t.type != null ? String(t.type) : '',
      }
    }
    return Object.keys(servers).map((k) => servers[k])
  }
  function sanitizeServerName(name) {
    let s = String(name).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32)
    if (s === '') s = 'mcp'
    if (/^[0-9]/.test(s)) s = 'm_' + s
    return s
  }

  // ---------- DSH session events (v28 format: assistant tool-call blocks) ----------
  function buildDshEvents(codexId, blocks, title, result) {
    const events = []
    let seq = -1
    const baseTime = Date.now()
    let turn = 0
    let step = 0
    let open = false
    let firstUserSeq = -1
    let firstUserText = ''
    let msgN = 0
    const maxChars = config.dshMessageMaxChars
    const pendingCalls = {}
    let lastToolLoc = null
    function push(type, data, surface) {
      seq++
      const event = { type, seq, time: baseTime + seq + 1, data }
      if (surface) event.surfaceOp = 'append'
      events.push(event)
      return seq
    }
    function nextStep() { step++; return step }
    function ensureTurn() {
      if (open) return
      turn++
      open = true
      step = 0
      push('turn/start', { turn })
      msgN++
      const userSeq = push('user/message', {
        id: 'msg-u' + msgN,
        role: 'user',
        content: [{ type: 'text', text: L('continuation') }],
        source: { kind: 'user' },
      }, true)
      if (firstUserSeq < 0) firstUserSeq = userSeq
    }
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      if (block.kind !== 'user' && block.kind !== 'assistant' && block.kind !== 'tool' && block.kind !== 'toolOut') continue
      if (turn >= config.maxDshTurns) { result.dsh.truncated = true; break }
      if (block.kind === 'user') {
        if (firstUserText === '') firstUserText = String(block.text || '').trim().slice(0, 60)
        if (open) { push('turn/end', { turn, reason: { kind: 'completed' } }); open = false }
        turn++
        open = true
        step = 0
        push('turn/start', { turn })
        msgN++
        const userSeq = push('user/message', {
          id: 'msg-u' + msgN,
          role: 'user',
          content: [{ type: 'text', text: truncate(block.text, maxChars) }],
          source: { kind: 'user' },
        }, true)
        if (firstUserSeq < 0) firstUserSeq = userSeq
      } else if (block.kind === 'assistant') {
        ensureTurn()
        msgN++
        push('assistant/message', {
          turn,
          step: nextStep(),
          message: {
            id: 'msg-a' + msgN,
            role: 'assistant',
            content: [{ type: 'text', text: truncate(block.text, maxChars) }],
            source: { kind: 'model', provider: 'codex-sync', model: 'codex-import' },
          },
        }, true)
      } else if (block.kind === 'tool') {
        ensureTurn()
        const group = []
        let j = i
        while (j < blocks.length && (blocks[j].kind === 'tool' || blocks[j].kind === 'toolOut')) {
          if (blocks[j].kind === 'tool') group.push(blocks[j])
          j++
        }
        msgN++
        push('assistant/message', {
          turn,
          step: nextStep(),
          message: {
            id: 'msg-a' + msgN,
            role: 'assistant',
            content: group.map((tb, gi) => {
              const tcid = typeof tb.callId === 'string' && tb.callId !== '' ? tb.callId : ('cxcall-' + String(seq + 1 + gi))
              return { type: 'tool-call', id: tcid, name: tb.name || 'tool', arguments: typeof tb.args === 'string' ? tb.args : '{}' }
            }),
            source: { kind: 'model', provider: 'codex-sync', model: 'codex-import' },
          },
        }, true)
        for (let k = i; k < j; k++) {
          const b = blocks[k]
          if (b.kind === 'tool') {
            const callId = typeof b.callId === 'string' && b.callId !== '' ? b.callId : ('cxcall-' + String(seq + 1 + (k - i)))
            const st = nextStep()
            pendingCalls[callId] = { turn, step: st }
            lastToolLoc = { turn, step: st }
            push('tool/call', { turn, step: st, callId, name: b.name || 'tool', arguments: typeof b.args === 'string' ? b.args : '{}' })
          } else if (b.kind === 'toolOut') {
            const callId = typeof b.callId === 'string' && b.callId !== '' ? b.callId : ''
            let loc = lastToolLoc
            if (callId !== '' && pendingCalls[callId]) loc = pendingCalls[callId]
            if (loc === null) continue
            const resultCallId = callId !== '' ? callId : ('cxcall-' + String(seq + 1 + (k - i)))
            msgN++
            push('tool/result', {
              turn: loc.turn,
              step: loc.step,
              message: {
                id: 'msg-t' + msgN,
                role: 'user',
                content: [{ type: 'tool-result', toolCallId: resultCallId, content: [{ type: 'text', text: truncate(b.text, maxChars) }] }],
                source: { kind: 'tool', callId: resultCallId },
              },
            }, true)
            if (callId !== '') delete pendingCalls[callId]
          }
        }
        i = j - 1
      } else if (block.kind === 'toolOut') {
        continue
      }
    }
    if (open) push('turn/end', { turn, reason: { kind: 'completed' } })
    const finalTitle = title && title !== '' ? title : firstUserText
    if (firstUserSeq >= 0 && finalTitle !== '') {
      push('session/title', { title: truncate(finalTitle, 200), messageSeqs: [firstUserSeq], source: { kind: 'fallback' } })
    }
    return events
  }

  async function attachToWorkspace(dshSessionId, cwd, result) {
    if (!workspaceRegistry || typeof workspaceRegistry.resolveByPath !== 'function') return
    try {
      let workspace = await workspaceRegistry.resolveByPath(cwd)
      if (workspace === undefined && typeof workspaceRegistry.create === 'function') {
        try {
          workspace = await workspaceRegistry.create(cwd, projectNameOf(cwd))
        } catch (createErr) {
          workspace = undefined
          try { workspace = await workspaceRegistry.resolveByPath(cwd) } catch (err2) { workspace = undefined }
          if (workspace === undefined && result && result.dsh && result.dsh.notes.length < 10) {
            result.dsh.notes.push(L('noteCreateWs', { p: cwd, err: errMsg(createErr) }))
          }
        }
      }
      if (workspace && typeof workspace.attachSession === 'function') {
        await workspace.attachSession(dshSessionId)
        if (result) result.dsh.attached++
      }
    } catch (err) {
      if (result && result.dsh && result.dsh.notes.length < 10) {
        result.dsh.notes.push(L('noteAttach', { id: dshSessionId, cwd, err: errMsg(err) }))
      }
    }
  }

  async function importDshSession(groupKey, codexId, kind, blocks, title, project, result) {
    if (!config.importAsDshSessions) return
    if (config.excludedSessionIds.indexOf(groupKey) >= 0) return
    if (!persistence || typeof persistence.create !== 'function' || typeof persistence.append !== 'function') {
      if (result.dsh.notes.length === 0) result.dsh.notes.push(L('errNoPersist'))
      return
    }
    const prev = state.sessions[groupKey]
    if (prev && prev.dshSessionId) { result.dsh.skipped++; return }
    let cwd = ''
    if (typeof project === 'string' && project !== '' && project !== '(no project)') {
      const st2 = statOf(project)
      if (st2 !== undefined && st2.type === 'directory') cwd = project
    }
    if (cwd === '') cwd = home
    const dshSessionId = 'session-' + (state.dshPrefix || 'cx3') + '-' + codexId + (kind !== 'user' ? '-' + kind : '')
    const events = buildDshEvents(codexId, blocks, title, result)
    try {
      await persistence.create({ version: 0, id: dshSessionId, createdAt: Date.now(), cwd })
      await persistence.append(dshSessionId, events)
      if (!state.sessions[groupKey]) state.sessions[groupKey] = { files: {}, outFile: '', project, kind, syncedAtMs: Date.now() }
      state.sessions[groupKey].dshSessionId = dshSessionId
      state.sessions[groupKey].dshVerified = true
      result.dsh.imported++
      await attachToWorkspace(dshSessionId, cwd, result)
    } catch (err) {
      const message = errMsg(err)
      if (message.indexOf('already exists') >= 0) {
        let loaded = null
        try { loaded = await persistence.load(dshSessionId) } catch (errL) { loaded = null }
        const hasContent = loaded && loaded.state && typeof loaded.state.cursor === 'number' && loaded.state.cursor > 0
        if (loaded && hasContent) {
          if (!state.sessions[groupKey]) state.sessions[groupKey] = { files: {}, outFile: '', project, kind, syncedAtMs: Date.now() }
          state.sessions[groupKey].dshSessionId = dshSessionId
          state.sessions[groupKey].dshVerified = true
          result.dsh.recovered++
          await attachToWorkspace(dshSessionId, cwd, result)
        } else {
          try {
            await persistence.append(dshSessionId, events)
            if (!state.sessions[groupKey]) state.sessions[groupKey] = { files: {}, outFile: '', project, kind, syncedAtMs: Date.now() }
            state.sessions[groupKey].dshSessionId = dshSessionId
            state.sessions[groupKey].dshVerified = true
            result.dsh.imported++
            await attachToWorkspace(dshSessionId, cwd, result)
          } catch (err2) {
            if (!state.sessions[groupKey]) state.sessions[groupKey] = { files: {}, outFile: '', project, kind, syncedAtMs: Date.now() }
            state.sessions[groupKey].dshSessionId = dshSessionId
            state.sessions[groupKey].dshVerified = true
            result.dsh.imported++
            await attachToWorkspace(dshSessionId, cwd, result)
          }
        }
      } else {
        result.dsh.failed++
        if (result.dsh.notes.length < 10) result.dsh.notes.push(groupKey + ': ' + message)
      }
    }
  }

  // ---------- session migration (grouped by sessionId+kind) ----------
  async function walkJsonl(dirPath, acc, source) {
    const st = statOf(dirPath)
    if (st === undefined || st.type !== 'directory') return
    let entries
    try { entries = readdirSync(dirPath, { withFileTypes: true }) } catch (err) { return }
    for (const entry of entries) {
      if (entry.isDirectory()) await walkJsonl(join(dirPath, entry.name), acc, source)
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) acc.push({ path: join(dirPath, entry.name), name: entry.name, source })
    }
  }
  function sessionAllowed(groupKey) {
    if (config.excludedSessionIds.indexOf(groupKey) >= 0) return false
    if (config.sessionMode === 'all') return true
    if (config.sessionMode === 'new') {
      const entry = state.sessions[groupKey]
      if (!entry) return true
      const fp = entry.files
      if (!fp || typeof fp !== 'object' || Object.keys(fp).length === 0) return true
      return false
    }
    if (config.sessionMode === 'selected') return config.selectedSessionIds.indexOf(groupKey) >= 0
    return true
  }
  function projectAllowed(projectKey) {
    if (config.projectMode === 'all') return true
    return config.selectedProjects.indexOf(projectKey) >= 0
  }
  function mergeGroupFiles(g) {
    g.files.sort((a, b) => String(a.file.name).localeCompare(String(b.file.name)))
    const merged = []
    let totalSkipped = 0
    for (let i = 0; i < g.files.length; i++) {
      const p = g.files[i].parsed
      if (i > 0) merged.push({ kind: 'divider', name: g.files[i].file.name })
      totalSkipped += p.skipped
      for (const b of p.blocks) merged.push(b)
    }
    return { merged, totalSkipped, first: g.files[0].parsed }
  }

  async function verifyDshImports(result) {
    if (!persistence || typeof persistence.load !== 'function') return
    if (!config.importAsDshSessions) return
    for (const key of Object.keys(state.sessions)) {
      const entry = state.sessions[key]
      if (!entry || typeof entry.dshSessionId !== 'string') continue
      if (entry.dshVerified !== true) {
        try {
          await persistence.load(entry.dshSessionId)
          entry.dshVerified = true
        } catch (err) {
          delete entry.dshSessionId
          delete entry.dshVerified
          result.dsh.ghostCleared++
        }
      }
      if (entry.dshSessionId) {
        const attachCwd = typeof entry.project === 'string' && entry.project !== '' && entry.project !== '(no project)' ? entry.project : home
        if (attachCwd !== '') await attachToWorkspace(entry.dshSessionId, attachCwd, result)
      }
    }
  }

  async function syncSessions(codexDir, result) {
    const index = await loadSessionIndex(codexDir)
    const files = []
    await walkJsonl(join(codexDir, 'sessions'), files, 'live')
    if (config.includeArchived) await walkJsonl(join(codexDir, 'archived_sessions'), files, 'archived')
    result.sessions.scanned = files.length
    if (files.length === 0) {
      result.sessions.errors.push({ path: codexDir, code: 'FS_NOT_FOUND', message: L('noteNoSessions') })
      return
    }
    let meta = await loadJson(join(outRoot, 'sessions', 'meta.json'))
    if (!meta || typeof meta !== 'object') meta = {}
    const nextMeta = {}
    for (const key of Object.keys(meta)) nextMeta[key] = meta[key]
    for (const key of Object.keys(state.sessions)) {
      const entry = state.sessions[key]
      if (!entry || typeof entry.outFile !== 'string' || entry.outFile === '') continue
      const st = statOf(join(outRoot, 'sessions', entry.outFile))
      if (st === undefined) {
        delete state.sessions[key]
        delete nextMeta[entry.outFile]
        markExcluded(key)
        result.sessions.deleted++
      }
    }
    await verifyDshImports(result)
    const groups = {}
    const order = []
    for (const file of files) {
      try {
        const info = statOf(file.path)
        const size = info && info.size !== undefined ? info.size : -1
        const version = info ? String(info.version) : ''
        const text = readTextOf(file.path)
        const parsed = parseSession(text, config, file.name)
        const groupKey = parsed.sessionId + '::' + parsed.kind
        if (!groups[groupKey]) {
          groups[groupKey] = { files: [], changed: false, project: parsed.project, kind: parsed.kind, codexId: parsed.sessionId }
          order.push(groupKey)
        }
        const g = groups[groupKey]
        const prev = state.sessions[groupKey]
        const filePrev = prev && prev.files && typeof prev.files === 'object' ? prev.files[file.path] : undefined
        const changed = !filePrev || filePrev.size !== size || filePrev.version !== version
        if (changed) g.changed = true
        g.files.push({ file, parsed, size, version })
      } catch (err) {
        result.sessions.failed++
        if (result.sessions.errors.length < 20) result.sessions.errors.push({ path: file.path, code: errCode(err), message: errMsg(err) })
      }
    }
    if (result.sessions.failed === 0) {
      const scanKeys = {}
      for (const k of Object.keys(groups)) scanKeys[k] = true
      for (const key of Object.keys(state.sessions)) {
        if (scanKeys[key]) continue
        const entry = state.sessions[key]
        if (!entry) { delete state.sessions[key]; continue }
        if (typeof entry.outFile === 'string' && entry.outFile !== '') {
          try { deleteFileOf(join(outRoot, 'sessions', entry.outFile)) } catch (err) { pushError(join(outRoot, 'sessions', entry.outFile), err) }
          delete nextMeta[entry.outFile]
        }
        if (typeof entry.dshSessionId === 'string' && workspaceRegistry && typeof workspaceRegistry.archiveSession === 'function') {
          try { await workspaceRegistry.archiveSession(entry.dshSessionId) } catch (err) { /* ignore */ }
        }
        delete state.sessions[key]
        markExcluded(key)
        result.sessions.deleted++
      }
    }
    for (const groupKey of order) {
      const g = groups[groupKey]
      const indexEntry = index.ok ? index.entries[g.codexId] : undefined
      const title = indexEntry && indexEntry.title ? indexEntry.title : ''
      const excluded = config.excludedSessionIds.indexOf(groupKey) >= 0
      const kindOk = kindAllowed(g.kind)
      if (g.changed) {
        if (kindOk && sessionAllowed(groupKey) && projectAllowed(g.project)) {
          const { merged, totalSkipped, first } = mergeGroupFiles(g)
          let kept = merged
          let truncatedMsg = false
          const maxMessages = config.maxMessagesPerSession
          if (merged.length > maxMessages) {
            const head = Math.ceil(maxMessages / 2)
            kept = merged.slice(0, head).concat(merged.slice(merged.length - (maxMessages - head)))
            truncatedMsg = true
          }
          const safeDate = first.date.replace(/[^0-9-]/g, '_')
          const safeId = g.codexId.replace(/[^A-Za-z0-9_-]/g, '_')
          const kindSuffix = g.kind !== 'user' ? '--' + g.kind : ''
          const outFile = safeDate + '--' + safeId + kindSuffix + '.md'
          const finalMd = renderMarkdown(first.meta, g.codexId, kept, truncatedMsg, totalSkipped, g.project, title, g.kind)
          writeTextOf(join(outRoot, 'sessions', outFile), finalMd)
          const fileFingerprints = {}
          for (const f of g.files) fileFingerprints[f.file.path] = { size: f.size, version: f.version }
          const prevDsh = state.sessions[groupKey] && state.sessions[groupKey].dshSessionId ? state.sessions[groupKey].dshSessionId : undefined
          state.sessions[groupKey] = { files: fileFingerprints, outFile, project: g.project, kind: g.kind, syncedAtMs: Date.now() }
          if (prevDsh) state.sessions[groupKey].dshSessionId = prevDsh
          nextMeta[outFile] = {
            date: first.date, sessionId: g.codexId, kind: g.kind,
            kindLabel: kindLabel(g.kind),
            title, project: g.project,
            projectName: projectNameOf(g.project),
            cwd: first.meta.cwd, originator: first.meta.originator, source: g.files[0].file.source, blocks: kept.length,
            sourcePath: g.files[0].file.path, fileCount: g.files.length, syncedAtMs: Date.now(),
          }
          result.sessions.imported++
        } else {
          result.sessions.skipped++
        }
      } else {
        result.sessions.unchanged++
      }
      const inState = groupKey in state.sessions
      const eligible = !excluded && (inState || (kindOk && sessionAllowed(groupKey) && projectAllowed(g.project)))
      if (eligible && (!inState || !state.sessions[groupKey].dshSessionId)) {
        const { merged } = mergeGroupFiles(g)
        await importDshSession(groupKey, g.codexId, g.kind, merged, title, g.project, result)
      }
    }
    const sessionsDir = join(outRoot, 'sessions')
    if (statOf(sessionsDir) !== undefined) {
      try {
        const entries = readdirSync(sessionsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.md')) continue
          if (Object.hasOwn(nextMeta, entry.name)) continue
          try { deleteFileOf(join(sessionsDir, entry.name)); result.sessions.deleted++ } catch (err) { pushError(join(sessionsDir, entry.name), err) }
        }
      } catch (err) { /* ignore */ }
    }
    writeTextOf(join(outRoot, 'sessions', 'meta.json'), JSON.stringify(nextMeta, null, 2))
    writeTextOf(join(outRoot, 'index.md'), buildIndex(nextMeta))
    result.index.rebuilt = true
  }

  // ---------- clear all imports ----------
  async function clearAllImports() {
    const stats = { archived: 0, detached: 0, mdDeleted: 0 }
    for (const key of Object.keys(state.sessions)) {
      const entry = state.sessions[key]
      if (entry && typeof entry.dshSessionId === 'string' && workspaceRegistry && typeof workspaceRegistry.archiveSession === 'function') {
        try { await workspaceRegistry.archiveSession(entry.dshSessionId); stats.archived++ } catch (err) { /* ignore */ }
      }
    }
    if (workspaceRegistry && typeof workspaceRegistry.list === 'function') {
      try {
        const wss = workspaceRegistry.list()
        for (const ws of wss) {
          if (!ws || typeof ws.detachSession !== 'function') continue
          const ids = ws.record && Array.isArray(ws.record.sessionIds) ? ws.record.sessionIds.slice() : []
          for (const id of ids) {
            if (/^session-cx/.test(id)) {
              try { await ws.detachSession(id); stats.detached++ } catch (err) { /* ignore */ }
            }
          }
        }
      } catch (err) { /* ignore */ }
    }
    const sessionsDir = join(outRoot, 'sessions')
    if (statOf(sessionsDir) !== undefined) {
      try {
        const entries = readdirSync(sessionsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.md')) continue
          try { deleteFileOf(join(sessionsDir, entry.name)); stats.mdDeleted++ } catch (err) { pushError(join(sessionsDir, entry.name), err) }
        }
      } catch (err) { /* ignore */ }
    }
    writeTextOf(join(outRoot, 'sessions', 'meta.json'), '{}')
    writeTextOf(join(outRoot, 'index.md'), L('indexWait'))
    state.sessions = {}
    state.dshPrefix = 'cx' + Date.now().toString(36)
    await persistState()
    return { ok: true, archived: stats.archived, detached: stats.detached, mdDeleted: stats.mdDeleted }
  }

  // ---------- project files ----------
  async function copyProjectTree(srcDir, outDir, budget, result) {
    const st = statOf(srcDir)
    if (st === undefined || st.type !== 'directory') return
    let entries
    try { entries = readdirSync(srcDir, { withFileTypes: true }) } catch (err) { return }
    for (const entry of entries) {
      if (budget.remaining <= 0) return
      const name = entry.name
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(name)) continue
        if (budget.depth > 14) continue
        const prevDepth = budget.depth
        budget.depth = budget.depth + 1
        await copyProjectTree(join(srcDir, name), join(outDir, name), budget, result)
        budget.depth = prevDepth
      } else if (entry.isFile()) {
        const full = join(srcDir, name)
        const info = statOf(full)
        const size = info !== undefined ? info.size : -1
        if (size > config.maxProjectFileBytes) { result.projects.skippedLarge++; continue }
        try {
          const text = readTextOf(full)
          writeTextOf(join(outDir, name), text)
          budget.remaining--
          result.projects.copiedFiles++
        } catch (err) {
          result.projects.skippedBinary++
        }
      }
    }
  }
  async function scanProjects(codexDir) {
    const files = []
    await walkJsonl(join(codexDir, 'sessions'), files, 'live')
    if (config.includeArchived) await walkJsonl(join(codexDir, 'archived_sessions'), files, 'archived')
    const groups = {}
    const projects = {}
    for (const file of files) {
      try {
        const text = readTextOf(file.path)
        const parsed = parseSession(text, config, file.name)
        const groupKey = parsed.sessionId + '::' + parsed.kind
        const projKey = parsed.project !== '' ? parsed.project : '(no project)'
        if (!groups[groupKey]) {
          groups[groupKey] = { groupKey, codexId: parsed.sessionId, kind: parsed.kind, project: projKey, date: parsed.date, fileCount: 0 }
        }
        groups[groupKey].fileCount++
        if (!projects[projKey]) projects[projKey] = { key: projKey, sessionIds: {} }
        projects[projKey].sessionIds[groupKey] = true
      } catch (err) { /* skip */ }
    }
    return { groups, projects }
  }
  async function syncProjectFiles(codexDir, result) {
    if (!config.includeProjectFiles) return
    const { projects } = await scanProjects(codexDir)
    const keys = Object.keys(projects).filter((key) => projectAllowed(key))
    if (keys.length === 0) { result.projects.notes.push(L('noteNoProjectFiles')); return }
    const budget = { remaining: config.maxProjectFilesPerSync, depth: 0 }
    const lines = []
    for (const key of keys) {
      if (budget.remaining <= 0) { result.projects.notes.push(L('noteBudget')); break }
      const proj = projects[key]
      const name = projectNameOf(key)
      const safe = safeDirName(name, key)
      await copyProjectTree(key, join(outRoot, 'projects', safe), budget, result)
      lines.push('| ' + name + ' | `' + key + '` | [view](projects/' + safe + ') |')
    }
    lines.unshift('# Project Files Index', '', '| Project | Original path | Files |', '| --- | --- | --- |')
    writeTextOf(join(outRoot, 'projects', 'README.md'), lines.join('\n'))
  }

  // ---------- MCP / memories / AGENTS.md ----------
  function buildMcpYaml(servers) {
    const lines = []
    lines.push('# Generated by codex-sync — Codex MCP servers → dsh cordis rows')
    lines.push('# Merge the insert block below into the deployment cordis.patch.yml (e.g. profiles/web/cordis.patch.yml), then restart dsh.')
    lines.push('# NOTE: env may contain secrets; keep this file safe.')
    lines.push('- insert:')
    for (const server of servers) {
      lines.push('    - id: mcp-' + sanitizeServerName(server.name))
      lines.push('      name: \'@deepseek-ai/dsh-mcp-client\'')
      lines.push('      config:')
      if (server.url !== '') {
        lines.push('        transport: streamable-http')
        lines.push('        serverName: ' + sanitizeServerName(server.name))
        lines.push('        url: ' + JSON.stringify(server.url))
        lines.push('        headers: ' + JSON.stringify(server.headers || {}))
      } else {
        lines.push('        transport: stdio')
        lines.push('        serverName: ' + sanitizeServerName(server.name))
        lines.push('        command: ' + JSON.stringify(server.command))
        lines.push('        args: ' + JSON.stringify(server.args || []))
        lines.push('        env: ' + JSON.stringify(server.env || {}))
      }
    }
    return lines.join('\n') + '\n'
  }
  function buildMcpReport(servers) {
    const lines = []
    lines.push(L('mcpReportTitle'))
    lines.push('')
    lines.push(L('mcpReportFound', { n: servers.length }))
    lines.push('')
    for (const server of servers) {
      lines.push('## ' + server.name)
      lines.push('')
      if (server.url !== '') {
        lines.push(L('mcpHttp'))
        lines.push(L('mcpUrl', { v: server.url }))
        const hk = Object.keys(server.headers || {})
        lines.push(L('mcpHeaders', { v: hk.length > 0 ? hk.join(', ') : '(none)' }))
      } else {
        lines.push(L('mcpStdio'))
        lines.push(L('mcpCmd', { v: server.command }))
        lines.push(L('mcpArgs', { v: JSON.stringify(server.args || []) }))
      }
      const envKeys = Object.keys(server.env || {})
      lines.push(L('mcpEnv', { v: envKeys.length > 0 ? envKeys.join(', ') : '(none)' }))
      if (sanitizeServerName(server.name) !== server.name) lines.push(L('mcpRenamed', { v: sanitizeServerName(server.name) }))
      lines.push('')
    }
    lines.push(L('mcpReportTail'))
    return lines.join('\n')
  }
  function buildMcpPrompt(servers) {
    const lines = []
    lines.push(L('promptTask'))
    lines.push('')
    lines.push(L('promptYou'))
    lines.push('')
    lines.push(L('promptBackground'))
    lines.push(L('promptBackgroundText'))
    lines.push('')
    lines.push(L('promptSnippet'))
    lines.push(L('promptSnippetText', { p: join(outRoot, 'mcp', 'cordis-mcp-rows.yml') }))
    lines.push('')
    lines.push(L('promptTarget'))
    lines.push(L('promptTargetText', { p: home + '/profiles/web/cordis.patch.yml' }))
    lines.push('')
    lines.push(L('promptSteps'))
    lines.push(L('promptStep1'))
    lines.push(L('promptStep2'))
    lines.push(L('promptStep3'))
    lines.push(L('promptStep4'))
    lines.push(L('promptStep5'))
    lines.push('')
    lines.push(L('promptServers'))
    for (const s of servers) {
      lines.push('- `' + s.name + '` ' + (s.url !== '' ? '(http: ' + s.url + ')' : '(stdio: ' + s.command + ')'))
    }
    lines.push('')
    lines.push(L('promptSafety'))
    lines.push(L('promptSafetyText'))
    return lines.join('\n')
  }
  async function syncMcp(codexDir, result) {
    const cfgPath = join(codexDir, 'config.toml')
    const st = statOf(cfgPath)
    if (st === undefined) {
      result.mcp.notes.push(L('noteNoMcpCfg', { p: cfgPath }))
      return
    }
    const text = readTextOf(cfgPath)
    const tables = parseToml(text)
    let servers = collectMcpServers(tables)
    if (config.mcpMode === 'selected') servers = servers.filter((s) => config.selectedMcpNames.indexOf(s.name) >= 0)
    result.mcp.found = true
    result.mcp.servers = servers.length
    if (servers.length === 0) {
      result.mcp.notes.push(L('noteNoMcpServers'))
      return
    }
    writeTextOf(join(outRoot, 'mcp', 'cordis-mcp-rows.yml'), buildMcpYaml(servers))
    writeTextOf(join(outRoot, 'mcp', 'report.md'), buildMcpReport(servers))
    writeTextOf(join(outRoot, 'mcp', 'register-prompt.md'), buildMcpPrompt(servers))
  }

  async function syncMemories(codexDir, result) {
    const dir = join(codexDir, 'memories')
    const st = statOf(dir)
    if (st === undefined) { result.memories.notes.push(L('noteNoMemoriesDir')); return }
    if (st.type !== 'directory') { result.memories.notes.push(L('noteMemoriesNotDir')); return }
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch (err) { entries = [] }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const info = statOf(join(dir, entry.name))
      const size = info !== undefined ? info.size : -1
      const version = info !== undefined ? info.version : ''
      const prev = state.memories[entry.name]
      if (prev && prev.size === size && prev.version === version) continue
      const text = readTextOf(join(dir, entry.name))
      writeTextOf(join(outRoot, 'memories', entry.name), text)
      state.memories[entry.name] = { size, version, syncedAtMs: Date.now() }
      result.memories.copied++
    }
  }

  async function syncAgentsMd(codexDir, result) {
    const p = join(codexDir, 'AGENTS.md')
    const st = statOf(p)
    if (st === undefined) { result.agentsMd.notes.push(L('noteNoAgentsMd')); return }
    const size = st.size !== undefined ? st.size : -1
    const version = st.version !== undefined ? st.version : ''
    const prev = state.agentsMd
    if (prev && prev.size === size && prev.version === version) { result.agentsMd.copied = true; return }
    const text = readTextOf(p)
    writeTextOf(join(outRoot, 'AGENTS.md'), text)
    state.agentsMd = { size, version, syncedAtMs: Date.now() }
    result.agentsMd.copied = true
  }

  // ---------- inventory for the picker UI ----------
  async function buildInventory(codexDir) {
    const index = await loadSessionIndex(codexDir)
    const { groups, projects } = await scanProjects(codexDir)
    const selectedIds = config.selectedSessionIds
    const excludedIds = config.excludedSessionIds
    const sessions2 = Object.keys(groups).map((key) => {
      const g = groups[key]
      const e = index.ok ? index.entries[g.codexId] : undefined
      return {
        id: key,
        codexId: g.codexId,
        kind: g.kind,
        date: g.date,
        project: g.project,
        title: truncate(e && e.title ? e.title : '', 60),
        projectName: projectNameOf(g.project),
        imported: key in state.sessions,
        dshImported: !!(state.sessions[key] && state.sessions[key].dshSessionId),
        excluded: excludedIds.indexOf(key) >= 0,
        included: kindAllowed(g.kind),
        selected: selectedIds.indexOf(key) >= 0,
      }
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    const projectList = Object.keys(projects).map((key) => ({
      key,
      name: projectNameOf(key),
      path: key,
      sessionCount: Object.keys(projects[key].sessionIds).length,
      selected: config.selectedProjects.indexOf(key) >= 0,
    })).sort((a, b) => b.sessionCount - a.sessionCount)
    const cfgPath = join(codexDir, 'config.toml')
    let mcp = []
    if (statOf(cfgPath) !== undefined) {
      try {
        const text = readTextOf(cfgPath)
        const servers = collectMcpServers(parseToml(text))
        mcp = servers.map((s) => ({
          name: s.name,
          detail: s.url !== '' ? s.url : s.command + ' ' + (s.args || []).join(' '),
          selected: config.selectedMcpNames.indexOf(s.name) >= 0,
        }))
      } catch (err) { /* ignore */ }
    }
    return { ok: true, sessions: sessions2, mcp, projects: projectList }
  }

  // ---------- delete / restore ----------
  async function deleteSessionLocal(groupKey) {
    const entry = state.sessions[groupKey]
    if (entry && typeof entry.outFile === 'string' && entry.outFile !== '') {
      const filePath = join(outRoot, 'sessions', entry.outFile)
      try { deleteFileOf(filePath) } catch (err) {
        pushError(filePath, err)
      }
      delete state.sessions[groupKey]
      const meta = await loadJson(join(outRoot, 'sessions', 'meta.json'))
      if (meta && typeof meta === 'object') {
        delete meta[entry.outFile]
        writeTextOf(join(outRoot, 'sessions', 'meta.json'), JSON.stringify(meta, null, 2))
        writeTextOf(join(outRoot, 'index.md'), buildIndex(meta))
      }
      if (entry.dshSessionId && workspaceRegistry && typeof workspaceRegistry.archiveSession === 'function') {
        try { await workspaceRegistry.archiveSession(entry.dshSessionId) } catch (err) { /* ignore */ }
      }
    }
    markExcluded(groupKey)
    await persistState()
    await persistConfig()
    return { ok: true, codexId: groupKey }
  }

  // ---------- sync main flow ----------
  async function doSync(trigger) {
    status.syncing = true
    const startedAt = Date.now()
    const result = {
      ok: false, trigger, startedAt, finishedAt: null,
      codexDir: config.codexDir || '',
      sessions: { scanned: 0, imported: 0, unchanged: 0, skipped: 0, deleted: 0, failed: 0, errors: [] },
      dsh: { imported: 0, skipped: 0, recovered: 0, ghostCleared: 0, attached: 0, failed: 0, truncated: false, notes: [] },
      mcp: { found: false, servers: 0, notes: [] },
      memories: { copied: 0, notes: [] },
      agentsMd: { copied: false, notes: [] },
      projects: { copiedFiles: 0, skippedBinary: 0, skippedLarge: 0, failedFiles: 0, notes: [] },
      index: { rebuilt: false },
      error: null,
    }
    try {
      const codexDir = config.codexDir !== '' ? config.codexDir : await detectCodexDir('')
      if (codexDir === '') throw new Error(L('errNoCodexDir'))
      status.codexDirDetected = codexDir
      result.codexDir = codexDir
      outRoot = computeOutRoot()
      if (config.includeSessions) await syncSessions(codexDir, result)
      if (config.includeProjectFiles) await syncProjectFiles(codexDir, result)
      if (config.includeMcp) await syncMcp(codexDir, result)
      if (config.includeMemories) await syncMemories(codexDir, result)
      if (config.includeAgentsMd) await syncAgentsMd(codexDir, result)
      result.ok = true
    } catch (err) {
      result.ok = false
      result.error = { code: errCode(err), message: errMsg(err) }
    } finally {
      result.finishedAt = Date.now()
      status.lastSyncAtMs = result.finishedAt
      status.lastSyncDurationMs = result.finishedAt - startedAt
      status.lastSyncResult = result
      status.syncing = false
      await persistState()
      await persistConfig()
      try { writeTextOf(join(outRoot, 'last-sync-result.json'), JSON.stringify(result, null, 2)) } catch (err) { /* ignore */ }
      if (intervalDisposer !== null) status.nextSyncAtMs = Date.now() + config.syncIntervalMinutes * 60000
    }
    return result
  }
  function runSync(trigger) {
    if (activeSync !== null) return activeSync
    const promise = doSync(trigger)
    activeSync = promise
    void promise.finally(() => { activeSync = null })
    return promise
  }

  function schedule() {
    if (intervalDisposer !== null) { intervalDisposer(); intervalDisposer = null }
    status.nextSyncAtMs = null
    if (config.autoSync && config.syncIntervalMinutes > 0) {
      const ms = config.syncIntervalMinutes * 60000
      intervalDisposer = ctx.interval(() => { void runSync('scheduled') }, ms)
      status.nextSyncAtMs = Date.now() + ms
    }
  }

  // ---------- public state & summary ----------
  function publicState() {
    return {
      config: Object.assign({}, config, {
        selectedSessionIds: config.selectedSessionIds.slice(),
        selectedMcpNames: config.selectedMcpNames.slice(),
        selectedProjects: config.selectedProjects.slice(),
        excludedSessionIds: config.excludedSessionIds.slice(),
      }),
      status: {
        syncing: status.syncing,
        codexDirDetected: status.codexDirDetected,
        lastSyncAtMs: status.lastSyncAtMs,
        lastSyncDurationMs: status.lastSyncDurationMs,
        lastSyncResult: status.lastSyncResult,
        nextSyncAtMs: status.nextSyncAtMs,
      },
      outRoot,
      initLog: Object.assign({}, initLog, { steps: initLog.steps.slice() }),
      lastErrors: lastErrors.slice(),
    }
  }
  function summarize(s) {
    const st = s.status
    if (st.syncing) return L('summarySyncing')
    const r = st.lastSyncResult
    if (!r) return L('summaryNever')
    if (!r.ok) return L('summaryFail', { err: r.error ? r.error.message : 'unknown error' })
    const parts = []
    if (s.config.includeSessions) parts.push(L('summarySessions', r.sessions))
    if (r.dsh) {
      parts.push(L('summaryDsh', {
        imported: r.dsh.imported,
        recovered: r.dsh.recovered > 0 ? L('summaryRecovered', { n: r.dsh.recovered }) : '',
        ghost: r.dsh.ghostCleared > 0 ? L('summaryGhost', { n: r.dsh.ghostCleared }) : '',
        attached: r.dsh.attached > 0 ? L('summaryAttached', { n: r.dsh.attached }) : '',
        failed: r.dsh.failed,
      }))
      if (r.dsh.notes.length > 0) parts.push(L('summaryNote', { v: r.dsh.notes[0] }))
    }
    if (s.config.includeProjectFiles) parts.push(L('summaryProjects', { n: r.projects.copiedFiles }))
    if (s.config.includeMcp) parts.push(L('summaryMcp', { n: r.mcp.servers }))
    if (s.config.includeMemories) parts.push(L('summaryMemories', { n: r.memories.copied }))
    return L('summaryOk', { parts: parts.join(', ') })
  }

  // ---------- config validation ----------
  function validateConfigPatch(args) {
    if (!args || typeof args !== 'object') throw new Error('saveConfig: parameter must be an object')
    for (const key of Object.keys(args)) {
      if (!Object.hasOwn(DEFAULTS, key)) throw new Error('saveConfig: unknown config key ' + key)
      const value = args[key]
      if (ARRAY_KEYS.includes(key)) {
        if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) throw new Error('saveConfig: ' + key + ' must be a string array')
      } else if (STRING_KEYS.includes(key)) {
        if (typeof value !== 'string') throw new Error('saveConfig: ' + key + ' must be a string')
        if (key === 'sessionMode' && value !== 'all' && value !== 'new' && value !== 'selected') throw new Error('saveConfig: sessionMode must be all/new/selected')
        if (key === 'projectMode' && value !== 'all' && value !== 'selected') throw new Error('saveConfig: projectMode must be all/selected')
        if (key === 'mcpMode' && value !== 'all' && value !== 'selected') throw new Error('saveConfig: mcpMode must be all/selected')
        if (key === 'language' && value !== 'en' && value !== 'zh' && value !== 'auto') throw new Error('saveConfig: language must be en/zh/auto')
      } else if (BOOL_KEYS.includes(key)) {
        if (typeof value !== 'boolean') throw new Error('saveConfig: ' + key + ' must be a boolean')
      } else if (NUMBER_KEYS.includes(key)) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('saveConfig: ' + key + ' must be a non-negative number')
        if (key === 'syncIntervalMinutes' && !Number.isInteger(value)) throw new Error('saveConfig: syncIntervalMinutes must be an integer')
      }
    }
  }

  // ---------- init ----------
  async function init() {
    initLog.ran = true
    initLog.steps.push({ path: 'outRoot', ok: true, value: outRoot })
    try {
      const saved = await loadJson(join(outRoot, 'config.json'))
      if (saved && typeof saved === 'object') {
        for (const key of Object.keys(DEFAULTS)) {
          if (ARRAY_KEYS.includes(key)) {
            if (Array.isArray(saved[key])) config[key] = saved[key].filter((v) => typeof v === 'string')
          } else if (typeof saved[key] === typeof DEFAULTS[key]) {
            config[key] = saved[key]
          }
        }
      }
      const savedState = await loadJson(join(outRoot, 'state.json'))
      if (savedState && typeof savedState === 'object') {
        if (savedState.sessions && typeof savedState.sessions === 'object') {
          const norm = {}
          for (const id of Object.keys(savedState.sessions)) {
            const entry = savedState.sessions[id]
            if (entry && entry.files && typeof entry.files === 'object') norm[id] = entry
          }
          state.sessions = norm
        }
        if (savedState.memories && typeof savedState.memories === 'object') state.memories = savedState.memories
        if (savedState.agentsMd) state.agentsMd = savedState.agentsMd
        if (savedState.dshPrefix && typeof savedState.dshPrefix === 'string' && /^cx[0-9a-z]+$/i.test(savedState.dshPrefix)) state.dshPrefix = savedState.dshPrefix
      }
      // prefix / archive hygiene (same rules as the dynamic v29 build)
      let legacy = false
      for (const key of Object.keys(state.sessions)) {
        if (!state.sessions[key].kind) { legacy = true; break }
      }
      if (legacy) {
        let wiped = 0
        for (const key of Object.keys(state.sessions)) {
          const entry = state.sessions[key]
          if (entry && typeof entry.dshSessionId === 'string' && workspaceRegistry && typeof workspaceRegistry.archiveSession === 'function') {
            try { await workspaceRegistry.archiveSession(entry.dshSessionId); wiped++ } catch (err) { /* ignore */ }
          }
        }
        state.sessions = {}
        config.excludedSessionIds = []
        config.selectedSessionIds = []
        writeTextOf(join(outRoot, 'sessions', 'meta.json'), '{}')
        writeTextOf(join(outRoot, 'index.md'), L('indexWaitShort'))
        initLog.steps.push({ path: 'legacyWipe', ok: true, value: L('legacyWipe', { n: wiped }) })
      }
      let upgraded = 0
      for (const key of Object.keys(state.sessions)) {
        const entry = state.sessions[key]
        if (entry && typeof entry.dshSessionId === 'string' && entry.dshSessionId.indexOf('session-' + state.dshPrefix + '-') !== 0) {
          if (workspaceRegistry && typeof workspaceRegistry.archiveSession === 'function') {
            try { await workspaceRegistry.archiveSession(entry.dshSessionId); upgraded++ } catch (err) { /* ignore */ }
          }
          delete entry.dshSessionId
          delete entry.dshVerified
          entry.files = {}
        }
      }
      if (upgraded > 0) initLog.steps.push({ path: 'contentUpgrade', ok: true, value: L('contentUpgrade', { n: upgraded, p: state.dshPrefix }) })
      let revived = 0
      if (workspaceRegistry && Array.isArray(workspaceRegistry.archivedSessionIds)) {
        const archSet2 = {}
        for (const a of workspaceRegistry.archivedSessionIds) archSet2[a] = true
        for (const key of Object.keys(state.sessions)) {
          const entry = state.sessions[key]
          if (entry && typeof entry.dshSessionId === 'string' && archSet2[entry.dshSessionId]) {
            delete entry.dshSessionId
            delete entry.dshVerified
            entry.files = {}
            revived++
          }
        }
      }
      if (revived > 0) {
        state.dshPrefix = 'cx' + Date.now().toString(36)
        initLog.steps.push({ path: 'revivePrefix', ok: true, value: L('revivePrefix', { n: revived, p: state.dshPrefix }) })
      }
      try {
        if (workspaceRegistry && typeof workspaceRegistry.resolveByPath === 'function' && typeof workspaceRegistry.archivedSessionIds !== 'undefined') {
          const ws = await workspaceRegistry.resolveByPath(home)
          if (ws && typeof ws.detachSession === 'function') {
            const archived = Array.isArray(workspaceRegistry.archivedSessionIds) ? workspaceRegistry.archivedSessionIds : []
            const archSet = {}
            for (const a of archived) archSet[a] = true
            const ids = ws.record && Array.isArray(ws.record.sessionIds) ? ws.record.sessionIds.slice() : []
            let detached = 0
            for (const id of ids) {
              if (id.indexOf('session-' + state.dshPrefix + '-') === 0) continue
              if (!archSet[id]) continue
              try { await ws.detachSession(id); detached++ } catch (err) { /* ignore */ }
            }
            if (detached > 0) initLog.steps.push({ path: 'detachLegacy', ok: true, value: L('detachLegacy', { n: detached }) })
          }
        }
      } catch (err) { /* ignore */ }
      outRoot = computeOutRoot()
      const probe = probeCodex('')
      initLog.steps = initLog.steps.concat(probe.steps)
      status.codexDirDetected = probe.found
      if (config.codexDir === '' && probe.found !== '') {
        config.codexDir = probe.found
        await persistConfig()
      } else if (config.codexDir !== '') {
        status.codexDirDetected = config.codexDir
      }
      initLog.ok = true
    } catch (err) {
      initLog.ok = false
      initLog.error = errMsg(err)
      pushError('init', err)
    }
    try {
      const diag = {
        at: new Date().toISOString(),
        outRoot,
        initLog: Object.assign({}, initLog, { steps: initLog.steps.slice() }),
        lastErrors: lastErrors.slice(),
        config: publicState().config,
      }
      writeTextOf(join(outRoot, 'diagnostics.json'), JSON.stringify(diag, null, 2))
    } catch (err) {
      pushError(join(outRoot, 'diagnostics.json'), err)
    }
    schedule()
    if (config.autoSync) void ctx.timeout(() => { void runSync('startup') }, 1500)
  }

  function dispose() {
    if (intervalDisposer !== null) intervalDisposer()
  }

  // ---------- public API ----------
  return {
    reportLocale(locale) {
      if (locale === 'zh' || locale === 'en') runtimeLang = locale
    },
    getState(args) {
      if (args && typeof args.locale === 'string') runtimeLang = args.locale === 'zh' ? 'zh' : 'en'
      return publicState()
    },
    async detectCodexDir(args) {
      const preferred = args && typeof args.codexDir === 'string' ? args.codexDir : config.codexDir
      const probe = probeCodex(preferred)
      return { found: probe.found, steps: probe.steps }
    },
    async listInventory() {
      const codexDir = config.codexDir !== '' ? config.codexDir : await detectCodexDir('')
      if (codexDir === '') return { ok: false, error: { code: 'NO_CODEX', message: L('errNoCodexDir') }, sessions: [], mcp: [], projects: [] }
      return buildInventory(codexDir)
    },
    async getMcpPrompt() {
      const p = join(outRoot, 'mcp', 'register-prompt.md')
      if (statOf(p) === undefined) return { ok: false, error: { code: 'NO_PROMPT', message: L('errNoPrompt') }, prompt: '' }
      return { ok: true, path: p, prompt: readTextOf(p) }
    },
    async deleteSession(args) {
      const codexId = args && typeof args.codexId === 'string' ? args.codexId : ''
      if (codexId === '') throw new Error('deleteSession: codexId required')
      return deleteSessionLocal(codexId)
    },
    async restoreSession(args) {
      const codexId = args && typeof args.codexId === 'string' ? args.codexId : ''
      if (codexId === '') throw new Error('restoreSession: codexId required')
      clearExcluded(codexId)
      await persistConfig()
      return { ok: true, codexId }
    },
    async clearAllSessions() {
      return clearAllImports()
    },
    async saveConfig(args) {
      validateConfigPatch(args)
      for (const key of Object.keys(args)) config[key] = args[key]
      if (config.syncIntervalMinutes > 10080) config.syncIntervalMinutes = 10080
      outRoot = computeOutRoot()
      await persistConfig()
      schedule()
      return publicState()
    },
    async syncNow(args) {
      const trigger = args && typeof args.trigger === 'string' ? args.trigger : 'manual'
      await runSync(trigger)
      return publicState()
    },
    async toolExecute(args) {
      if (args.action === 'sync') await runSync('tool')
      if (args.action === 'clear') {
        const cleared = await clearAllImports()
        const s2 = publicState()
        return { summary: L('clearSummary', cleared), config: s2.config, status: s2.status }
      }
      const s = publicState()
      return { summary: summarize(s), config: s.config, status: s.status }
    },
    init,
    dispose,
  }
}
