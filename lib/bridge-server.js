import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const METHODS = new Set([
  'registerBridgeConversation',
  'continueBridgeConversation',
])
const READ_METHODS = new Set()

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function readBody(req, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > maxBodyBytes) {
        settled = true
        const error = new Error('request body too large')
        error.statusCode = 413
        reject(error)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        settled = true
        resolve(text === '' ? {} : JSON.parse(text))
      } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function installToken(path) {
  if (typeof path !== 'string' || path === '') throw new Error('bridge tokenPath is required')
  try {
    const existing = readFileSync(path, 'utf8').trim()
    if (/^[a-f0-9]{64}$/.test(existing)) return existing
  } catch (error) { /* create below */ }
  mkdirSync(dirname(path), { recursive: true })
  const token = randomBytes(32).toString('hex')
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, `${token}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(temp, path)
  try { chmodSync(path, 0o600) } catch (error) { /* Windows ACLs are managed by the profile */ }
  return token
}

function authorized(req, token) {
  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const candidate = header.startsWith('Bearer ') ? header.slice(7) : String(req.headers['x-dsh-bridge-token'] || '')
  const left = Buffer.from(candidate)
  const right = Buffer.from(token)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function startBridgeServer(options = {}) {
  const enabled = options.enabled !== false
  const port = Number.isInteger(options.port) ? options.port : 46371
  const logic = options.logic
  const onError = typeof options.onError === 'function' ? options.onError : () => {}
  if (!enabled) return { dispose() {}, address: () => null }
  if (!logic || port < 0 || port > 65535) throw new Error('invalid bridge server configuration')
  const maxBodyBytes = Number.isInteger(options.maxBodyBytes) && options.maxBodyBytes > 0 ? options.maxBodyBytes : 128 * 1024
  const tokenPath = options.tokenPath
  const token = installToken(tokenPath)

  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      json(res, 200, { ok: true, service: 'dsh-codex-bridge' })
      return
    }
    if (req.method !== 'POST' || req.url !== '/rpc') {
      json(res, 404, { ok: false, error: 'not found' })
      return
    }
    try {
      const body = await readBody(req, maxBodyBytes)
      if (!body || !METHODS.has(body.method) || typeof logic[body.method] !== 'function') {
        json(res, 400, { ok: false, error: 'unknown bridge method' })
        return
      }
      if (!READ_METHODS.has(body.method) && !authorized(req, token)) {
        json(res, 401, { ok: false, error: 'bridge authentication required' })
        return
      }
      const result = await logic[body.method](body.args && typeof body.args === 'object' ? body.args : {})
      json(res, 200, { ok: true, result })
    } catch (error) {
      json(res, error?.statusCode === 413 ? 413 : 400, { ok: false, error: error && error.message ? error.message : String(error) })
    }
  })

  server.on('error', onError)
  server.listen(port, '127.0.0.1')
  return {
    tokenPath,
    address: () => server.address(),
    dispose() {
      try { server.close() } catch (error) { /* already closed */ }
    },
  }
}
