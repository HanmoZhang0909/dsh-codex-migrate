function textFromContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((item) => item && typeof item.text === 'string' ? item.text : '')
    .filter(Boolean)
    .join('\n')
}

function toolInput(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string' || value.trim() === '') return {}
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    return { value: parsed }
  } catch (error) {
    return { raw: value }
  }
}

function eventTime(event) {
  return Number.isFinite(event?.time) ? Number(event.time) : 0
}

function eventId(prefix, event, fallback = '') {
  const id = event?.data?.message?.id || event?.data?.id || fallback
  return String(id || `${prefix}-${event?.seq ?? 0}`)
}

function assistantBlocks(content) {
  const blocks = []
  for (const item of Array.isArray(content) ? content : []) {
    if (item?.type === 'text' && typeof item.text === 'string' && item.text !== '') {
      blocks.push({ type: 'text', text: item.text })
    }
    if (item?.type === 'tool-call') {
      const id = String(item.id || item.callId || '')
      if (id === '') continue
      blocks.push({
        type: 'tool_use',
        id,
        name: String(item.name || 'tool'),
        input: toolInput(item.arguments),
      })
    }
  }
  return blocks
}

function toolResultBlocks(content) {
  const blocks = []
  for (const item of Array.isArray(content) ? content : []) {
    if (item?.type !== 'tool-result') continue
    const toolUseId = String(item.toolCallId || item.tool_use_id || '')
    if (toolUseId === '') continue
    blocks.push({ type: 'tool_result', tool_use_id: toolUseId, content: textFromContent(item.content) })
  }
  return blocks
}

export function dshEventsToCodexTranscript(events) {
  const transcript = []
  const visibleToolCalls = new Set()
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || !event.data) continue
    if (event.type === 'user/message') {
      if (event.data?.source?.kind !== 'user') continue
      const content = (Array.isArray(event.data.content) ? event.data.content : [])
        .filter((item) => item?.type === 'text' && typeof item.text === 'string' && item.text !== '')
        .map((item) => ({ type: 'text', text: item.text }))
      if (content.length === 0) continue
      transcript.push({ id: eventId('user', event), role: 'user', content, createdAtMs: eventTime(event) })
      continue
    }
    if (event.type === 'assistant/message') {
      const content = assistantBlocks(event.data?.message?.content)
      if (content.length === 0) continue
      for (const item of content) if (item.type === 'tool_use') visibleToolCalls.add(item.id)
      transcript.push({ id: eventId('assistant', event), role: 'assistant', content, createdAtMs: eventTime(event) })
      continue
    }
    if (event.type === 'tool/call') {
      const callId = String(event.data.callId || '')
      if (callId === '' || visibleToolCalls.has(callId)) continue
      visibleToolCalls.add(callId)
      transcript.push({
        id: eventId('tool-call', event, callId),
        role: 'assistant',
        content: [{ type: 'tool_use', id: callId, name: String(event.data.name || 'tool'), input: toolInput(event.data.arguments) }],
        createdAtMs: eventTime(event),
      })
      continue
    }
    if (event.type === 'tool/result') {
      const content = toolResultBlocks(event.data?.message?.content)
      if (content.length === 0) continue
      transcript.push({ id: eventId('tool-result', event), role: 'user', content, createdAtMs: eventTime(event) })
    }
  }
  return transcript
}

export function dshTranscriptToNormalizedTurns(transcript, normalizeTurn) {
  const turns = []
  for (const entry of Array.isArray(transcript) ? transcript : []) {
    if (!entry || typeof normalizeTurn !== 'function') continue
    if (entry.role === 'user') {
      const text = entry.content
        .filter((item) => item?.type === 'text')
        .map((item) => item.text)
        .join('\n')
        .trim()
      if (text !== '') turns.push(normalizeTurn({ id: entry.id, role: 'user', content: text, createdAtMs: entry.createdAtMs }))
      continue
    }
    if (entry.role === 'assistant') {
      const text = entry.content
        .filter((item) => item?.type === 'text')
        .map((item) => item.text)
        .join('\n')
        .trim()
      const toolCalls = entry.content
        .filter((item) => item?.type === 'tool_use')
        .map((item) => ({ callId: item.id, name: item.name, arguments: item.input }))
      if (text !== '' || toolCalls.length > 0) {
        turns.push(normalizeTurn({ id: entry.id, role: 'assistant', content: text, toolCalls, createdAtMs: entry.createdAtMs }))
      }
    }
  }
  return turns
}

export const dshToolInput = toolInput
