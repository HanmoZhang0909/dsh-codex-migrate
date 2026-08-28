import { randomUUID } from 'node:crypto'

const SIDES = new Set(['codex', 'dsh'])

function copyConversation(conversation) {
  if (!conversation || typeof conversation !== 'object') throw new Error('conversation must be an object')
  return JSON.parse(JSON.stringify(conversation))
}

function validTime(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number`)
  return Number(value)
}

function validTtl(value) {
  if (!Number.isFinite(value) || value <= 0) throw new Error('ttlMs must be a positive number')
  return Number(value)
}

function requireToken(conversation, token) {
  if (!conversation.lease || conversation.lease.token !== token) throw new Error('LEASE_TOKEN_INVALID')
}

export function isLeaseLive(lease, nowMs = Date.now()) {
  return Boolean(
    lease
      && typeof lease.token === 'string'
      && lease.token !== ''
      && SIDES.has(lease.owner)
      && Number.isFinite(lease.expiresAtMs)
      && Number(nowMs) < lease.expiresAtMs,
  )
}

export function acquireLease(conversation, side, nowMs = Date.now(), ttlMs = 30_000, token = randomUUID()) {
  if (!SIDES.has(side)) throw new Error(`LEASE_SIDE_INVALID: ${side}`)
  const now = validTime(nowMs, 'nowMs')
  const ttl = validTtl(ttlMs)
  const next = copyConversation(conversation)
  if (isLeaseLive(next.lease, now) && next.lease.owner !== side) throw new Error(`LEASE_HELD: ${next.lease.owner}`)

  const acquiredAtMs = isLeaseLive(next.lease, now) && next.lease.owner === side
    ? next.lease.acquiredAtMs
    : now
  next.lease = {
    owner: side,
    token: String(token || randomUUID()),
    acquiredAtMs,
    heartbeatAtMs: now,
    expiresAtMs: now + ttl,
  }
  next.activeSide = side
  next.status = 'running'
  return next
}

export function heartbeatLease(conversation, token, nowMs = Date.now(), ttlMs = 30_000) {
  const now = validTime(nowMs, 'nowMs')
  const ttl = validTtl(ttlMs)
  const next = copyConversation(conversation)
  requireToken(next, token)
  next.lease.heartbeatAtMs = now
  next.lease.expiresAtMs = now + ttl
  return next
}

export function releaseLease(conversation, token, releasedAtMs = Date.now()) {
  const next = copyConversation(conversation)
  requireToken(next, token)
  next.lease = null
  next.activeSide = 'none'
  next.status = 'paused'
  next.updatedAtMs = validTime(releasedAtMs, 'releasedAtMs')
  return next
}
