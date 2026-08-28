import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const statusUrl = new URL('../codex/dsh-codex-bridge/assets/status.html', import.meta.url)
const server = readFileSync(new URL('../codex/dsh-codex-bridge/mcp/server.mjs', import.meta.url), 'utf8')

test('the deprecated inline status panel is absent from the companion MCP', () => {
  assert.equal(existsSync(statusUrl), false)
  assert.doesNotMatch(server, /resources\/list|outputTemplate|WIDGET_URI|status\.html/)
})
