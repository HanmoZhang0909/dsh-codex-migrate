import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { readRolloutText } from '../read-rollout.js'

function loadCache(path) {
  if (!existsSync(path)) return { schemaVersion: 1, entries: {} }
  try {
    // The cache document itself is read whole: it must round-trip losslessly.
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return parsed?.schemaVersion === 1 && parsed.entries && typeof parsed.entries === 'object'
      ? parsed
      : { schemaVersion: 1, entries: {} }
  } catch (error) { return { schemaVersion: 1, entries: {} } }
}

function saveCache(path, cache) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(temp, JSON.stringify(cache), 'utf8')
  renameSync(temp, path)
}

function hashText(text) {
  return createHash('sha256').update(text).digest('hex')
}

export function createInventoryIndexer({ cachePath, parse }) {
  if (typeof cachePath !== 'string' || cachePath === '') throw new Error('inventory cachePath is required')
  if (typeof parse !== 'function') throw new Error('inventory parse function is required')

  return Object.freeze({
    scan(paths) {
      const startedAt = Date.now()
      const cache = loadCache(cachePath)
      const next = { schemaVersion: 1, entries: {} }
      const stats = { parsed: 0, reused: 0, hashed: 0, removed: 0, durationMs: 0 }
      const items = []
      const errors = []
      const ordered = [...new Set((Array.isArray(paths) ? paths : []).filter((path) => typeof path === 'string'))]
        .sort((a, b) => a.localeCompare(b))

      for (const path of ordered) {
        try {
          const stat = statSync(path)
          if (!stat.isFile()) continue
          const previous = cache.entries[path]
          const sameFingerprint = previous && previous.size === stat.size && previous.mtimeMs === stat.mtimeMs
          let entry
          if (sameFingerprint) {
            entry = previous
            stats.reused += 1
          } else {
            const text = readRolloutText(path)
            const hash = hashText(text)
            stats.hashed += 1
            if (previous && previous.hash === hash) {
              entry = { ...previous, size: stat.size, mtimeMs: stat.mtimeMs }
              stats.reused += 1
            } else {
              try {
                entry = { size: stat.size, mtimeMs: stat.mtimeMs, hash, value: parse(path, text), error: null }
                stats.parsed += 1
              } catch (error) {
                entry = { size: stat.size, mtimeMs: stat.mtimeMs, hash, value: null, error: error?.message || String(error) }
                stats.parsed += 1
              }
            }
          }
          next.entries[path] = entry
          if (entry.error) errors.push({ path, message: entry.error })
          else items.push({ path, value: entry.value, size: entry.size, mtimeMs: entry.mtimeMs, hash: entry.hash })
        } catch (error) {
          errors.push({ path, message: error?.message || String(error) })
        }
      }
      stats.removed = Object.keys(cache.entries).filter((path) => !Object.hasOwn(next.entries, path)).length
      stats.durationMs = Date.now() - startedAt
      saveCache(cachePath, next)
      return { items, errors, stats }
    },
  })
}
