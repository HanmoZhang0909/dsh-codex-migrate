import assert from 'node:assert/strict'
import test from 'node:test'
import { codexResponseItems, codexVisibleImportJsonl } from '../lib/bridge/codex-app-server.js'

test('Codex app-server history injection preserves user and assistant roles', () => {
  const items = codexResponseItems([
    { role: 'user', text: '问题' },
    { role: 'assistant', content: '回答' },
    { role: 'tool', text: 'ignored' },
  ])
  assert.deepEqual(items, [
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: '问题' }] },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '回答' }] },
  ])
})

test('Codex visible import artifact preserves a normal user/assistant conversation', () => {
  const lines = codexVisibleImportJsonl({
    workspace: 'D:\\deepseek-work',
    turns: [{ role: 'user', text: '问题' }, { role: 'assistant', content: '回答' }],
  }).trim().split('\n').map(JSON.parse)
  assert.equal(lines.length, 2)
  assert.deepEqual(lines.map((item) => item.type), ['user', 'assistant'])
  assert.equal(lines[0].message.content, '问题')
  assert.equal(lines[1].message.content[0].text, '回答')
  assert.equal(lines[1].parentUuid, lines[0].uuid)
})

test('Codex visible import artifact uses native Claude tool blocks for structured DSH history', () => {
  const lines = codexVisibleImportJsonl({
    workspace: 'D:\\deepseek-work',
    transcript: [
      { role: 'user', content: [{ type: 'text', text: '检查项目' }], createdAtMs: 10 },
      { role: 'assistant', content: [
        { type: 'text', text: '正在读取。' },
        { type: 'tool_use', id: 'call-1', name: 'read_file', input: { path: 'README.md' } },
      ], createdAtMs: 20 },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call-1', content: '# Project' }], createdAtMs: 30 },
    ],
  }).trim().split('\n').map(JSON.parse)
  assert.equal(lines.length, 3)
  assert.equal(lines[1].message.content[1].type, 'tool_use')
  assert.deepEqual(lines[1].message.content[1].input, { path: 'README.md' })
  assert.deepEqual(lines[2].message.content, [{ type: 'tool_result', tool_use_id: 'call-1', content: '# Project' }])
  assert.equal(lines[2].parentUuid, lines[1].uuid)
})
