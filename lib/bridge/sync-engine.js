import { createHash } from 'node:crypto'

function identity(turn) {
  return turn?.hash || turn?.turnId || ''
}

function uniqueTurns(turns) {
  const seen = new Set()
  return (Array.isArray(turns) ? turns : []).filter((turn) => {
    const key = identity(turn)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function keyFor(bridgeId, side) {
  return `${bridgeId}:${side}`
}

function deliveryKey(bridgeId, turns) {
  const body = turns.map(identity).join(':')
  return `sync-${createHash('sha256').update(`${bridgeId}:${body}`).digest('hex').slice(0, 24)}`
}

export function shouldFlushBatch(policy, batch) {
  if (policy === 'agent_message') {
    return batch?.boundary === 'agent_message'
      && Array.isArray(batch.turns)
      && batch.turns.some((turn) => turn?.role === 'assistant')
  }
  return batch?.boundary === 'task_completed' || batch?.boundary === 'round_completed'
}

export function createSyncEngine() {
  const cursors = new Map()
  const pending = new Map()
  return Object.freeze({
    async syncOnce({ conversation, source, target, memoryCoordinator = null }) {
      if (!conversation?.bridgeId) throw new Error('syncOnce requires conversation.bridgeId')
      if (!source?.side || !target?.side || source.side === target.side) throw new Error('syncOnce requires distinct source and target adapters')
      const sourceId = conversation[`${source.side}ConversationId`]
      if (!sourceId) throw new Error(`SOURCE_CONVERSATION_MISSING: ${source.side}`)
      let counterpartId = conversation[`${target.side}ConversationId`]
      if (!counterpartId) {
        const created = await target.createCounterpart({
          bridgeId: conversation.bridgeId,
          title: conversation.title || '',
          projectKey: conversation.projectKey || '',
          sourceSide: source.side,
        })
        counterpartId = created?.conversationId || ''
        if (!counterpartId) throw new Error(`COUNTERPART_CREATE_FAILED: ${target.side}`)
      }

      const sourceKey = keyFor(conversation.bridgeId, source.side)
      const batch = await source.readSince(sourceId, cursors.get(sourceKey) || { offset: 0 })
      cursors.set(sourceKey, batch.cursor)
      let memoryResult = null
      if (memoryCoordinator) {
        const mutations = batch.memoryMutations || {}
        if (Array.isArray(mutations.upserts) && mutations.upserts.length > 0) memoryCoordinator.stageUpserts(mutations.upserts)
        if (Array.isArray(mutations.deletes) && mutations.deletes.length > 0) memoryCoordinator.stageDeletes(mutations.deletes)
        memoryResult = await memoryCoordinator.flush(batch.boundary)
      }
      const accumulated = uniqueTurns([...(pending.get(sourceKey) || []), ...(batch.turns || [])])
      pending.set(sourceKey, accumulated)

      if (!shouldFlushBatch(conversation.syncPolicy || 'task_turn', { ...batch, turns: accumulated })) {
        return { counterpartId, flushed: false, appended: 0, cursor: batch.cursor, pending: accumulated.length, memory: memoryResult }
      }

      const targetBatch = await target.readSince(counterpartId, { offset: 0 })
      const existing = new Set((targetBatch.turns || []).map(identity))
      const additions = accumulated.filter((turn) => !existing.has(identity(turn)))
      if (additions.length > 0) {
        await target.appendTurns(counterpartId, additions, {
          bridgeId: conversation.bridgeId,
          sourceSide: source.side,
          idempotencyKey: deliveryKey(conversation.bridgeId, additions),
        })
      }
      pending.set(sourceKey, [])
      return {
        counterpartId,
        flushed: true,
        appended: additions.length,
        cursor: batch.cursor,
        pending: 0,
        idempotencyKey: deliveryKey(conversation.bridgeId, additions),
        memory: memoryResult,
      }
    },
    inspect(bridgeId, side) {
      const key = keyFor(bridgeId, side)
      return { cursor: cursors.get(key) || { offset: 0 }, pending: [...(pending.get(key) || [])] }
    },
  })
}
