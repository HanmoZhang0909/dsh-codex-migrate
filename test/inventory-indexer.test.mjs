import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createInventoryIndexer } from '../lib/inventory/indexer.js'

test('incremental inventory parses cold files, reuses unchanged files, updates one, removes deleted files, and keeps stable order', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'inventory-index-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const first = join(directory, 'b.jsonl')
  const second = join(directory, 'a.jsonl')
  writeFileSync(first, '{"id":"b"}\n', 'utf8')
  writeFileSync(second, '{"id":"a"}\n', 'utf8')
  let parses = 0
  const indexer = createInventoryIndexer({
    cachePath: join(directory, 'cache.json'),
    parse(path, text) { parses += 1; return JSON.parse(text.trim()) },
  })

  const cold = indexer.scan([first, second])
  assert.equal(cold.stats.parsed, 2)
  assert.deepEqual(cold.items.map((item) => item.path), [second, first])
  const warm = indexer.scan([first, second])
  assert.equal(warm.stats.parsed, 0)
  assert.equal(warm.stats.reused, 2)

  utimesSync(second, new Date(), new Date(Date.now() + 2000))
  const changed = indexer.scan([first, second])
  assert.equal(changed.stats.hashed, 1)
  assert.equal(changed.stats.parsed, 0)
  assert.equal(parses, 2)

  rmSync(first)
  const removed = indexer.scan([second])
  assert.equal(removed.stats.removed, 1)
  assert.deepEqual(removed.items.map((item) => item.value.id), ['a'])
})

test('isolates a corrupted JSONL file without discarding valid cached inventory', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'inventory-corrupt-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const good = join(directory, 'good.jsonl')
  const bad = join(directory, 'bad.jsonl')
  writeFileSync(good, '{"id":"good"}\n', 'utf8')
  writeFileSync(bad, '{broken', 'utf8')
  const indexer = createInventoryIndexer({ cachePath: join(directory, 'cache.json'), parse: (path, text) => JSON.parse(text.trim()) })
  const result = indexer.scan([bad, good])
  assert.deepEqual(result.items.map((item) => item.value.id), ['good'])
  assert.equal(result.errors.length, 1)
  assert.equal(result.errors[0].path, bad)
  assert.equal(result.stats.durationMs >= 0, true)
})
