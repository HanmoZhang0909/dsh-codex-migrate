// Rollout files grow for the entire life of a Codex thread: a month-old thread
// can hold hundreds of MB in a single JSONL file, and a busy machine keeps
// several of them. Reading such a file whole — as the session scan and the
// inventory indexer used to do — costs more memory than a harness process
// reserves, which is enough to abort it with a JavaScript heap OOM.
//
// The parts a migration needs are the head (the `session_meta` record that
// identifies the thread) and the newest tail (the turns a "latest" import
// resolves to), so anything past the head window is read from the end.
import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs'

/** Files at or below this size are read whole. */
export const HUGE_ROLLOUT_BYTES = 48 * 1024 * 1024
/** Head window: keeps the session metadata and the first records. */
const HEAD_BYTES = 512 * 1024
/** Tail window: keeps the newest turns of the thread. */
const TAIL_BYTES = 32 * 1024 * 1024

function readRange(path, position, length) {
  const fd = openSync(path, 'r')
  try {
    const buffer = Buffer.allocUnsafe(length)
    const read = readSync(fd, buffer, 0, length, position)
    return buffer.toString('utf8', 0, read)
  } finally {
    closeSync(fd)
  }
}

/**
 * Read a rollout file, bounding memory for very large ones.
 *
 * The returned text is not the whole file for huge inputs: it is the head
 * window followed by the tail window. Line-oriented callers already tolerate a
 * torn first line (they skip unparsable lines), and a bounded read keeps the
 * thread's identity, its newest turns, and the process alive.
 *
 * @param path - rollout JSONL path.
 * @returns the file text, bounded for huge files.
 */
export function readRolloutText(path) {
  const stat = statSync(path)
  if (stat.size <= HUGE_ROLLOUT_BYTES) return readFileSync(path, 'utf8')
  const head = readRange(path, 0, HEAD_BYTES)
  const tail = readRange(path, Math.max(0, stat.size - TAIL_BYTES), TAIL_BYTES)
  return `${head}\n${tail}`
}
