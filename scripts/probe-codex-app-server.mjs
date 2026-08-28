import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCodexAppServer } from '../lib/bridge/codex-app-server.js'

const isolatedHome = mkdtempSync(join(tmpdir(), 'dsh-codex-app-server-'))
process.env.CODEX_HOME = isolatedHome
try {
  const client = createCodexAppServer({ timeoutMs: 30000 })
  const created = await client.createThread({
    workspace: process.cwd(),
    title: 'DSH bridge protocol probe',
    transcript: [
      { role: 'user', content: [{ type: 'text', text: 'Protocol probe only.' }] },
      { role: 'assistant', content: [
        { type: 'text', text: 'Reading the probe.' },
        { type: 'tool_use', id: 'probe-call', name: 'read_file', input: { path: 'README.md' } },
      ] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'probe-call', content: '# Probe' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Ready.' }] },
    ],
  })
  if (!created.id || created.openUrl !== `codex://threads/${encodeURIComponent(created.id)}`) throw new Error('Invalid createThread response')
  const read = await client.readThread(created.id)
  const turns = Array.isArray(read?.thread?.turns) ? read.thread.turns : []
  if (turns.length === 0) throw new Error('Imported Codex task has no visible turns')
  const itemTypes = turns.flatMap((turn) => Array.isArray(turn?.items) ? turn.items.map((item) => item?.type) : [])
  const items = turns.flatMap((turn) => Array.isArray(turn?.items) ? turn.items : []).map((item) => ({
    type: item?.type,
    text: item?.text,
    name: item?.name,
    callId: item?.callId,
  }))
  const renderedText = items.map((item) => item.text || '').join('\n')
  if (!renderedText.includes('[external_agent_tool_call: read_file]')) throw new Error('Codex external-agent import lost the DSH tool call')
  if (!renderedText.includes('[external_agent_tool_result]')) throw new Error('Codex external-agent import lost the DSH tool result')
  console.log(JSON.stringify({ ok: true, threadId: created.id, visibleTurns: turns.length, itemTypes, items }))
} finally {
  rmSync(isolatedHome, { recursive: true, force: true })
}
