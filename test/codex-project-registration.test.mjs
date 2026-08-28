import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../lib/bridge/codex-app-server.js', import.meta.url), 'utf8')

test('whole-project import stays a native batch without sidebar project registration', () => {
  assert.match(source, /importThreads\(options, seed\.sessions, workspace\)/)
  assert.doesNotMatch(source, /project\/list/)
  assert.doesNotMatch(source, /project\/create/)
  assert.doesNotMatch(source, /thread\/metadata\/update/)
})
