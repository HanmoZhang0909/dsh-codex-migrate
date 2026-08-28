import assert from 'node:assert/strict'
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createEventStore } from '../lib/bridge/event-store.js'
import { createBridgeEvent, createBridgeState, reduceBridgeEvent } from '../lib/bridge/protocol.js'

function tempStore(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-bridge-store-'))
  const store = createEventStore({ directory, reducer: reduceBridgeEvent, initialState: createBridgeState, ...options })
  return { directory, store }
}

function registration(key = 'registration') {
  return createBridgeEvent({
    bridgeId: 'bridge-store',
    type: 'conversation.registered',
    baseRevision: 0,
    side: 'codex',
    idempotencyKey: key,
    createdAtMs: 1000,
    payload: { codexConversationId: 'codex-store' },
  })
}

test('appends and fsyncs the event before materializing state', () => {
  let failOnce = true
  const { directory, store } = tempStore({
    hooks: {
      beforeMaterialize() {
        if (failOnce) { failOnce = false; throw new Error('simulated materialize crash') }
      },
    },
  })

  try {
    assert.throws(() => store.append(registration()), /simulated materialize crash/)
    assert.equal(existsSync(join(directory, 'events.jsonl')), true)
    assert.equal(JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8')).revision, 0)

    const recovered = createEventStore({ directory, reducer: reduceBridgeEvent, initialState: createBridgeState }).load()
    assert.equal(recovered.conversations['bridge-store'].codexConversationId, 'codex-store')
    assert.equal(recovered.revision, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('does not append an already applied event twice', () => {
  const { directory, store } = tempStore()
  try {
    const event = registration()
    store.append(event)
    store.append(event)
    const lines = readFileSync(join(directory, 'events.jsonl'), 'utf8').trim().split(/\r?\n/)
    assert.equal(lines.length, 1)
    assert.equal(store.load().revision, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('replays valid events and ignores a truncated final JSONL record', () => {
  const { directory, store } = tempStore()
  try {
    store.append(registration())
    appendFileSync(join(directory, 'events.jsonl'), '{"eventId":"truncated"', 'utf8')
    rmSync(join(directory, 'state.json'), { force: true })

    const replayed = createEventStore({ directory, reducer: reduceBridgeEvent, initialState: createBridgeState }).load()
    assert.equal(replayed.conversations['bridge-store'].revision, 1)
    assert.equal(replayed.appliedEventIds.length, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('writes a revisioned snapshot without pruning the journal', () => {
  const { directory, store } = tempStore()
  try {
    store.append(registration())
    const snapshot = store.compact()
    assert.equal(snapshot.endsWith(join('snapshots', '1.json')), true)
    assert.equal(existsSync(snapshot), true)
    assert.equal(readFileSync(join(directory, 'events.jsonl'), 'utf8').trim().length > 0, true)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('returns defensive state copies from the public seam', () => {
  const { directory, store } = tempStore()
  try {
    store.append(registration())
    const first = store.load()
    first.conversations['bridge-store'].status = 'mutated-outside'
    assert.equal(store.load().conversations['bridge-store'].status, 'ready')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('persists offline pending events and acknowledgements across restarts', () => {
  const { directory, store } = tempStore()
  try {
    const event = registration('pending-registration')
    store.enqueue(event)
    store.enqueue(event)
    assert.deepEqual(store.pending().map((item) => item.eventId), [event.eventId])

    const restarted = createEventStore({ directory, reducer: reduceBridgeEvent, initialState: createBridgeState })
    assert.deepEqual(restarted.pending().map((item) => item.eventId), [event.eventId])
    restarted.ackPending(event.eventId)
    assert.deepEqual(restarted.pending(), [])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
