import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { startBridgeServer } from '../lib/bridge-server.js'

function request(address, { method = 'GET', path = '/health', token = '', body = null } = {}) {
  return new Promise((resolve, reject) => {
    const encoded = body === null ? null : JSON.stringify(body)
    const req = http.request({
      host: '127.0.0.1', port: address.port, method, path,
      headers: {
        ...(encoded === null ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(encoded) }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }))
    })
    req.on('error', reject)
    if (encoded !== null) req.write(encoded)
    req.end()
  })
}

async function listening(server) {
  for (let index = 0; index < 100; index += 1) {
    const address = server.address()
    if (address) return address
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error('server did not listen')
}

test('bridge binds loopback, creates a private install token, and authenticates mutations', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'bridge-server-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const tokenPath = join(directory, 'install-token')
  const calls = []
  const logic = {
    registerBridgeConversation: async (args) => { calls.push(args); return { bridgeId: 'b1' } },
  }
  const server = startBridgeServer({ enabled: true, port: 0, logic, tokenPath })
  t.after(() => server.dispose())
  const address = await listening(server)
  assert.equal(address.address, '127.0.0.1')
  assert.equal(existsSync(tokenPath), true)
  const token = readFileSync(tokenPath, 'utf8').trim()
  assert.match(token, /^[a-f0-9]{64}$/)
  if (process.platform !== 'win32') assert.equal(statSync(tokenPath).mode & 0o077, 0)

  assert.equal((await request(address)).status, 200)
  const denied = await request(address, { method: 'POST', path: '/rpc', body: { method: 'registerBridgeConversation', args: {} } })
  assert.equal(denied.status, 401)
  const allowed = await request(address, { method: 'POST', path: '/rpc', token, body: { method: 'registerBridgeConversation', args: { title: 'ok' } } })
  assert.equal(allowed.status, 200)
  assert.equal(calls.length, 1)
})

test('bridge rejects unknown methods and oversized bodies without invoking logic', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'bridge-server-limits-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const server = startBridgeServer({ enabled: true, port: 0, logic: { registerBridgeConversation: async () => null }, tokenPath: join(directory, 'token'), maxBodyBytes: 256 })
  t.after(() => server.dispose())
  const address = await listening(server)
  assert.equal((await request(address, { method: 'POST', path: '/rpc', body: { method: 'nope', args: {} } })).status, 400)
  const large = await request(address, { method: 'POST', path: '/rpc', body: { method: 'registerBridgeConversation', args: { text: 'x'.repeat(1000) } } })
  assert.equal(large.status, 413)
})
