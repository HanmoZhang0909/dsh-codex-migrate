import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../codex/dsh-codex-bridge/mcp/server.mjs', import.meta.url), 'utf8')

test('companion is a one-shot handoff without queued-message replay', () => {
  assert.match(source, /continue_in_dsh/)
  assert.match(source, /remember_memory/)
  assert.match(source, /search_memory/)
  assert.match(source, /forget_memory/)
  assert.match(source, /已同步对话到 DSH。/)
  assert.doesNotMatch(source, /send_to_dsh|get_dsh_status|pendingMessages|take_over_in_codex/)
})
