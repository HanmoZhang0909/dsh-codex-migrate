// Offline end-to-end smoke test for the migration logic (no DSH restart needed).
// Uses a mock context (no sessionPersistence/workspaceRegistry), so the DSH
// session import step is skipped; Markdown/MCP/memories artifacts are verified.
import { rmSync } from 'node:fs'
import { createLogic } from '../lib/logic.js'

const OUT = new URL('../.smoke-out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
try { rmSync(OUT, { recursive: true, force: true }) } catch (e) { /* ignore */ }

const ctx = {
  get: () => undefined,
  interval: () => () => {},
  timeout: () => {},
}

const logic = createLogic(ctx, {
  codexDir: 'C:\\Users\\26558\\.codex',
  outputDir: OUT,
  language: 'zh',
  includeSessions: true,
  includeArchived: true,
  includeMcp: true,
  includeMemories: true,
  includeAgentsMd: true,
  sessionMode: 'selected',
  selectedSessionIds: ['019fe47f-82c4-7bf1-866a-d24aad16f907::user'],
}, OUT)

await logic.init()
const s0 = logic.getState({ locale: 'zh' })
console.log('initLog.ok =', s0.initLog.ok, '| codexDirDetected =', s0.status.codexDirDetected)
if (!s0.initLog.ok) console.log('init error:', s0.initLog.error)

await logic.syncNow({ trigger: 'smoke' })
const s1 = logic.getState({ locale: 'zh' })
const r = s1.status.lastSyncResult
console.log('sync ok =', r.ok)
if (!r.ok) console.log('sync error:', JSON.stringify(r.error))
console.log('sessions:', JSON.stringify(r.sessions))
console.log('mcp:', JSON.stringify(r.mcp))
console.log('memories:', JSON.stringify(r.memories))
console.log('agentsMd:', JSON.stringify(r.agentsMd))
console.log('dsh:', JSON.stringify(r.dsh))

// verify a generated artifact exists
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
for (const f of ['index.md', 'config.json', 'state.json', 'diagnostics.json']) {
  console.log(f, '=>', existsSync(join(OUT, f)))
}
const prompt = join(OUT, 'mcp', 'register-prompt.md')
console.log('register-prompt.md =>', existsSync(prompt))
if (existsSync(prompt)) {
  const text = readFileSync(prompt, 'utf8')
  console.log('--- prompt head ---')
  console.log(text.split('\n').slice(0, 8).join('\n'))
}
