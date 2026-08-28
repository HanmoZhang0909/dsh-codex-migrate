import assert from 'node:assert/strict'
import test from 'node:test'
import { dshEventsToCodexTranscript } from '../lib/bridge/dsh-to-codex.js'

test('DSH conversion preserves visible messages, tool calls and tool results without importing runtime snapshots', () => {
  const events = [
    { type: 'turn/start', seq: 0, time: 10, data: { turn: 1 } },
    { type: 'user/message', seq: 1, time: 11, data: { id: 'u1', source: { kind: 'user' }, content: [{ type: 'text', text: '检查项目' }] } },
    { type: 'user/message', seq: 2, time: 12, data: { id: 'ctx', source: { kind: 'plugin' }, content: [{ type: 'text', text: 'runtime context' }] } },
    { type: 'assistant/message', seq: 3, time: 13, data: { message: { id: 'a1', content: [
      { type: 'reasoning', text: 'hidden reasoning' },
      { type: 'text', text: '我先读取文件。' },
      { type: 'tool-call', id: 'call-1', name: 'read_file', arguments: '{"path":"README.md"}' },
    ] } } },
    { type: 'tool/call', seq: 4, time: 14, data: { callId: 'call-1', name: 'read_file', arguments: '{"path":"README.md"}' } },
    { type: 'tool/result', seq: 5, time: 15, data: { message: { id: 'r1', content: [
      { type: 'tool-result', toolCallId: 'call-1', content: [{ type: 'text', text: '# Project' }] },
    ] } } },
    { type: 'assistant/message', seq: 6, time: 16, data: { message: { id: 'a2', content: [{ type: 'text', text: '读取完成。' }] } } },
    { type: 'turn/end', seq: 7, time: 17, data: { turn: 1, reason: { kind: 'completed' } } },
  ]

  const transcript = dshEventsToCodexTranscript(events)
  assert.deepEqual(transcript.map((entry) => entry.role), ['user', 'assistant', 'user', 'assistant'])
  assert.equal(transcript.some((entry) => JSON.stringify(entry).includes('runtime context')), false)
  assert.equal(transcript.some((entry) => JSON.stringify(entry).includes('hidden reasoning')), false)
  assert.deepEqual(transcript[1].content, [
    { type: 'text', text: '我先读取文件。' },
    { type: 'tool_use', id: 'call-1', name: 'read_file', input: { path: 'README.md' } },
  ])
  assert.deepEqual(transcript[2].content, [{ type: 'tool_result', tool_use_id: 'call-1', content: '# Project' }])
  assert.equal(transcript.filter((entry) => entry.content.some((item) => item.type === 'tool_use')).length, 1)
})

test('DSH conversion synthesizes a tool call when only the canonical tool event exists', () => {
  const transcript = dshEventsToCodexTranscript([
    { type: 'tool/call', seq: 1, time: 10, data: { callId: 'call-2', name: 'search', arguments: 'not-json' } },
  ])
  assert.deepEqual(transcript[0].content, [
    { type: 'tool_use', id: 'call-2', name: 'search', input: { raw: 'not-json' } },
  ])
})
