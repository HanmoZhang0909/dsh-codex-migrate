import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true })
}

function atomicJson(path, value) {
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`
  const body = JSON.stringify(value, null, 2)
  const handle = openSync(temp, 'w')
  try {
    writeSync(handle, body, undefined, 'utf8')
    fsyncSync(handle)
  } finally {
    closeSync(handle)
  }
  renameSync(temp, path)
}

function appendDurable(path, value) {
  const handle = openSync(path, 'a')
  try {
    writeSync(handle, `${JSON.stringify(value)}\n`, undefined, 'utf8')
    fsyncSync(handle)
  } finally {
    closeSync(handle)
  }
}

function readJournal(path) {
  if (!existsSync(path)) return []
  const body = readFileSync(path, 'utf8')
  if (body === '') return []
  const lines = body.split(/\r?\n/)
  const events = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line.trim() === '') continue
    try {
      events.push(JSON.parse(line))
    } catch (error) {
      const hasValidContentAfter = lines.slice(index + 1).some((candidate) => candidate.trim() !== '')
      if (!hasValidContentAfter) break
      throw new Error(`EVENT_LOG_CORRUPT at line ${index + 1}: ${error.message}`)
    }
  }
  return events
}

export function createEventStore(options) {
  if (!options || typeof options !== 'object') throw new Error('event store options are required')
  if (typeof options.directory !== 'string' || options.directory === '') throw new Error('event store directory is required')
  if (typeof options.reducer !== 'function') throw new Error('event store reducer is required')
  if (typeof options.initialState !== 'function') throw new Error('event store initialState is required')

  const directory = options.directory
  const eventsPath = join(directory, 'events.jsonl')
  const statePath = join(directory, 'state.json')
  const pendingPath = join(directory, 'pending.jsonl')
  const snapshotsPath = join(directory, 'snapshots')
  const hooks = options.hooks || {}
  let state = null

  function materialize(next) {
    ensureDirectory(directory)
    atomicJson(statePath, next)
  }

  function initialize() {
    if (state !== null) return state
    ensureDirectory(directory)
    let current = options.initialState()
    let materializedRevision = null
    if (existsSync(statePath)) {
      try {
        current = JSON.parse(readFileSync(statePath, 'utf8'))
        materializedRevision = current.revision
      } catch (error) {
        current = options.initialState()
      }
    }
    for (const event of readJournal(eventsPath)) current = options.reducer(current, event)
    state = current
    if (materializedRevision !== state.revision) materialize(state)
    return state
  }

  return {
    paths: Object.freeze({ directory, eventsPath, statePath, snapshotsPath, pendingPath }),
    load() {
      return clone(initialize())
    },
    append(event) {
      const current = initialize()
      if (Array.isArray(current.appliedEventIds) && current.appliedEventIds.includes(event.eventId)) return clone(current)
      const next = options.reducer(current, event)
      ensureDirectory(directory)
      appendDurable(eventsPath, event)
      if (typeof hooks.beforeMaterialize === 'function') hooks.beforeMaterialize(clone(next), clone(event))
      materialize(next)
      state = next
      if (typeof hooks.afterMaterialize === 'function') hooks.afterMaterialize(clone(next), clone(event))
      return clone(next)
    },
    compact() {
      const current = initialize()
      ensureDirectory(snapshotsPath)
      const path = join(snapshotsPath, `${current.revision}.json`)
      atomicJson(path, current)
      return path
    },
    pending() {
      const queued = new Map()
      for (const entry of readJournal(pendingPath)) {
        if (entry?.op === 'enqueue' && entry.event?.eventId) queued.set(entry.event.eventId, entry.event)
        if (entry?.op === 'ack' && typeof entry.eventId === 'string') queued.delete(entry.eventId)
      }
      return [...queued.values()].map(clone)
    },
    enqueue(event) {
      if (!event?.eventId) throw new Error('pending eventId is required')
      if (this.pending().some((item) => item.eventId === event.eventId)) return false
      ensureDirectory(directory)
      appendDurable(pendingPath, { op: 'enqueue', queuedAtMs: Date.now(), event: clone(event) })
      return true
    },
    ackPending(eventId) {
      if (typeof eventId !== 'string' || eventId === '') throw new Error('pending eventId is required')
      if (!this.pending().some((item) => item.eventId === eventId)) return false
      appendDurable(pendingPath, { op: 'ack', acknowledgedAtMs: Date.now(), eventId })
      return true
    },
  }
}
