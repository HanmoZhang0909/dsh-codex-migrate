import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/client/index.js', import.meta.url), 'utf8')

test('DSH client uses native slots and one-way conversation import', () => {
  assert.match(source, /conversation\.chat\.assistant-actions/)
  assert.match(source, /importDshConversationToCodex/)
  assert.match(source, /importDshProjectToCodex/)
  assert.match(source, /importedConversations/)
  assert.doesNotMatch(source, /registerBridgeScope|resolveBridgeConflict|CloudIcon/)
  assert.doesNotMatch(source, /MutationObserver|querySelector\(|getBoundingClientRect/)
  assert.match(source, /dshProjects: '按照项目批量迁移'/)
  assert.match(source, /dshProjects: 'Batch Migration by Project'/)
})

test('Continue in Codex uses a single clean filled knot icon', () => {
  assert.match(source, /const CODEX_ICON_PATH = 'M22\.2819 9\.8211/)
  assert.match(source, /fill: currentColor/)
})

test('Codex to DSH handoff still uses native navigation without inline UI', () => {
  assert.match(source, /navigationRequestId/)
  assert.match(source, /ctx\.sessions\.open\(target\.dshConversationId\)/)
  assert.match(source, /acknowledgeBridgeNavigation/)
  assert.doesNotMatch(source, /cxs-modal|cxs-cloud|monitor_dsh_task/)
})

test('memory import exposes the three supported sources', () => {
  assert.match(source, /includeMemories/)
  assert.match(source, /includeMcpMemories/)
  assert.match(source, /includeMemorySkill/)
  assert.match(source, /t\('memoryMcp'\)[\s\S]*?'Beta'/)
})
