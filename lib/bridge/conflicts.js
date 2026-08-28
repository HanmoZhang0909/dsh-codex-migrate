function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

function turnIdentity(turn) {
  return turn?.hash || turn?.turnId || ''
}

function startIndex(turns, lastCommonTurnId) {
  if (!lastCommonTurnId) return 0
  const index = turns.findIndex((turn) => turn?.turnId === lastCommonTurnId)
  return index < 0 ? 0 : index + 1
}

export function findFirstDivergence(codexTurns = [], dshTurns = [], lastCommonTurnId = '') {
  const codexStart = startIndex(codexTurns, lastCommonTurnId)
  const dshStart = startIndex(dshTurns, lastCommonTurnId)
  const length = Math.max(codexTurns.length - codexStart, dshTurns.length - dshStart)
  for (let offset = 0; offset < length; offset += 1) {
    const codexTurn = codexTurns[codexStart + offset]
    const dshTurn = dshTurns[dshStart + offset]
    if (!codexTurn || !dshTurn || turnIdentity(codexTurn) !== turnIdentity(dshTurn)) {
      return {
        index: Math.min(codexStart, dshStart) + offset,
        codexTurn: codexTurn ? copy(codexTurn) : null,
        dshTurn: dshTurn ? copy(dshTurn) : null,
      }
    }
  }
  return null
}

export function detectConflict(conversation, details = {}) {
  if (!conversation || typeof conversation !== 'object') throw new Error('conversation must be an object')
  const codexTurns = Array.isArray(details.codexTurns) ? details.codexTurns : []
  const dshTurns = Array.isArray(details.dshTurns) ? details.dshTurns : []
  const lastCommonTurnId = typeof details.lastCommonTurnId === 'string'
    ? details.lastCommonTurnId
    : conversation.lastCommonTurnId || ''
  const divergence = findFirstDivergence(codexTurns, dshTurns, lastCommonTurnId)
  if (!divergence) return copy(conversation)

  return {
    ...copy(conversation),
    status: 'conflict',
    activeSide: 'none',
    lease: null,
    conflict: {
      firstDivergenceIndex: divergence.index,
      codexTurn: divergence.codexTurn,
      dshTurn: divergence.dshTurn,
      codexTurns: copy(codexTurns),
      dshTurns: copy(dshTurns),
      lastCommonTurnId,
      detectedAtMs: Number.isFinite(details.detectedAtMs) ? Number(details.detectedAtMs) : Date.now(),
      resolution: null,
    },
  }
}

export function resolveConflict(conversation, selectedSide, resolvedAtMs = Date.now()) {
  if (!conversation?.conflict) throw new Error('CONFLICT_NOT_FOUND')
  if (selectedSide !== 'codex' && selectedSide !== 'dsh') throw new Error(`CONFLICT_SIDE_INVALID: ${selectedSide}`)
  const current = copy(conversation)
  const codexTurns = current.conflict.codexTurns || []
  const dshTurns = current.conflict.dshTurns || []
  const selectedTurns = selectedSide === 'codex' ? codexTurns : dshTurns
  current.turns = copy(selectedTurns)
  current.lastCommonTurnId = selectedTurns.at(-1)?.turnId || current.lastCommonTurnId || ''
  current.status = 'paused'
  current.activeSide = 'none'
  current.lease = null
  current.conflict = {
    ...current.conflict,
    recovery: { codexTurns: copy(codexTurns), dshTurns: copy(dshTurns) },
    resolution: {
      selectedSide,
      resolvedAtMs: Number.isFinite(resolvedAtMs) ? Number(resolvedAtMs) : Date.now(),
    },
  }
  return current
}
