import { photo } from './fixtures.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase } from '../server/db.js'
import { createApp } from '../server/app.js'
import { randomUUID } from 'node:crypto'
import { pinDigest } from '../server/auth.js'
import { seedAdmin } from '../server/admin-seed.js'

for (const provider of ['local', 'supabase']) test(`admin seed, Ponto registration and isolated punch access (${provider})`, async () => {
  const db = createDatabase(':memory:')
  let server
  try {
    await db.migrate.latest()
    assert.equal(await seedAdmin(db, { username: 'admin', password: 'admin-password' }), true)
    assert.equal(await seedAdmin(db, { username: 'admin', password: 'another-password' }), false)
    await db('terminal_users').insert({ username: 'worker@example.com', supabase_user_id: 'worker-id', active: true })
    const user = { id: 'worker-id', email_confirmed_at: new Date().toISOString() }
    const fetcher = async (_url, options) => {
      const body = options.body && JSON.parse(options.body)
      if (body && body.password !== 'worker-password') return new Response('{}', { status: 400 })
      return Response.json(body ? { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user } : user)
    }
    const app = createApp(db, { analyzer: async () => ({ face_detected: true, divergence_status: 'ok' }), config: { terminalAuthProvider: provider, photoProvider: 'database', encryptionKey: 'a'.repeat(64), url: 'https://example.com', publicKey: 'public' }, fetcher })
    server = app.listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
    const base = `http://127.0.0.1:${server.address().port}/api`
    const login = (username, password) => fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, role: 'admin' }) })
    const admin = await (await login('admin', 'admin-password')).json()
    assert.equal(admin.role, 'admin')
    assert.equal((await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${admin.token}` } })).status, 200)
    const createAccount = (body, token = admin.token) => fetch(`${base}/ponto-users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    assert.equal((await createAccount({ username: 'ponto', password: 'short' })).status, 400)
    assert.equal((await createAccount({ username: ' ADMIN ', password: 'ponto-password' })).status, 409)
    const created = await createAccount({ username: ' Ponto ', password: 'ponto-password' })
    assert.equal(created.status, 201)
    assert.deepEqual(Object.keys(await created.json()).sort(), ['active', 'id', 'role', 'username'])
    assert.equal((await createAccount({ username: 'ponto', password: 'ponto-password' })).status, 409)
    const ponto = await (await login('PONTO', 'ponto-password')).json()
    assert.equal(ponto.role, 'ponto')
    const pontoHeaders = { Authorization: `Bearer ${ponto.token}` }
    assert.equal((await fetch(`${base}/terminal/me`, { headers: pontoHeaders })).status, 200)
    assert.equal((await fetch(`${base}/employees`, { headers: pontoHeaders })).status, 401)
    assert.equal((await createAccount({ username: 'blocked', password: 'ponto-password' }, ponto.token)).status, 401)
    assert.equal((await fetch(`${base}/ponto-users`, { headers: pontoHeaders })).status, 401)
    await db('employees').insert({ name: 'Funcionário', registration: 'TEST-001', department: 'Operações', target_hours: 8, pin_digest: await pinDigest(db, '1234'), created_at: new Date().toISOString() })
    const punch = await fetch(`${base}/terminal/punch`, { method: 'POST', headers: { ...pontoHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ photo, pin: '1234', request_id: randomUUID() }) })
    assert.equal(punch.status, 200)
    assert.equal((await punch.json()).kind, 'Entrada')
    assert.equal((await fetch(`${base}/terminal/logout`, { method: 'POST', headers: pontoHeaders })).status, 204)
    assert.equal((await fetch(`${base}/terminal/me`, { headers: pontoHeaders })).status, 401)
    assert.equal((await login('admin', 'wrong')).status, 401)
    if (provider === 'local') return
    const employee = await (await login('worker@example.com', 'worker-password')).json()
    assert.equal(employee.role, 'ponto')
    const headers = { Authorization: `Bearer ${employee.token}` }
    assert.equal((await fetch(`${base}/terminal/me`, { headers })).status, 200)
    assert.equal((await fetch(`${base}/auth/me`, { headers })).status, 401)
    await db('terminal_users').update({ active: false })
    assert.equal((await fetch(`${base}/terminal/me`, { headers })).status, 401)
    assert.equal((await login('worker@example.com', 'worker-password')).status, 401)
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve))
    await db.destroy()
  }
})
