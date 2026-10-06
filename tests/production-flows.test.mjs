import { photo } from './fixtures.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabase } from '../server/db.js'
import { createApp } from '../server/app.js'
import { seedAdmin } from '../server/admin-seed.js'
import { pinDigest } from '../server/auth.js'

test('production API regression: report timezone, duplicate punches, expiry, password revocation and rate limit', async () => {
  const db = createDatabase(':memory:')
  let server
  try {
    await db.migrate.latest()
    await seedAdmin(db, { username: 'admin', password: 'initial-password' })
    const app = createApp(db, { analyzer: async () => ({ face_detected: true, divergence_status: 'ok' }), config: { terminalAuthProvider: 'local', photoProvider: 'database' } })
    server = app.listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
    const base = `http://127.0.0.1:${server.address().port}/api`
    const request = (path, body, token) => fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    for (const path of ['/employees', '/reports?from=2026-01-01&to=2026-01-31', '/ponto-users', '/terminal/me']) assert.equal((await request(path)).status, 401)
    const publicConfig = await request('/auth/config')
    assert.equal(publicConfig.headers.get('x-content-type-options'), 'nosniff')
    assert.ok(publicConfig.headers.get('content-security-policy'))
    const admin = await (await request('/auth/login', { username: 'admin', password: 'initial-password' })).json()
    const [{ id }] = await db('employees').insert({ name: 'Teste noturno', registration: 'NIGHT', department: 'Teste', workdays: '[1,2,3,4,5,6,0]', hourly_rate_cents: 1500, overtime_rate_cents: 2500, pin_digest: await pinDigest(db, '1234'), created_at: new Date().toISOString() }).returning('id')
    await db('entries').insert([
      { employee_id: id, kind: 'Entrada', occurred_at: '2026-01-31T23:00:00.000Z', request_id: randomUUID() },
      { employee_id: id, kind: 'Saída', occurred_at: '2026-02-01T01:00:00.000Z', request_id: randomUUID() },
    ])
    const report = await (await request('/reports?from=2026-01-31&to=2026-01-31', undefined, admin.token)).json()
    assert.equal(report.rows[0].work_seconds, 2 * 3600, 'must include punches from 21h to midnight in Brasília')
    assert.equal(report.rows[0].total_pay_cents, 3000)
    assert.equal((await request('/reports?from=2026-02-30&to=2026-03-01', undefined, admin.token)).status, 400)
    assert.equal((await request('/reports/close', { month: '2099-01' }, admin.token)).status, 400)
    const closed = await request('/reports/close', { month: '2026-01' }, admin.token)
    assert.equal(closed.status, 200)
    assert.ok((await closed.json()).closed_at)
    await db('employees').where({ id }).update({ hourly_rate_cents: 9000 })
    const frozen = await (await request('/reports?from=2026-01-01&to=2026-01-31', undefined, admin.token)).json()
    assert.equal(frozen.rows[0].total_pay_cents, 3000)
    assert.equal(frozen.rows[0].hourly_rate_cents, 1500)
    await request('/ponto-users', { username: 'ponto', password: 'ponto-password' }, admin.token)
    const ponto = await (await request('/auth/login', { username: 'ponto', password: 'ponto-password' })).json()
    const account = await db('ponto_users').where({ username: 'ponto' }).first()
    assert.equal((await request(`/ponto-users/${account.id}/password`, { password: 'replacement-password' }, ponto.token)).status, 401)
    assert.equal((await request(`/ponto-users/${account.id}/status`, { active: false }, admin.token)).status, 200)
    assert.equal((await request('/terminal/me', undefined, ponto.token)).status, 401)
    assert.equal((await request('/auth/login', { username: 'ponto', password: 'ponto-password' })).status, 401)
    await request(`/ponto-users/${account.id}/status`, { active: true }, admin.token)
    assert.equal((await request('/terminal/me', undefined, ponto.token)).status, 401)
    await request(`/ponto-users/${account.id}/password`, { password: 'replacement-password' }, admin.token)
    assert.equal((await request('/auth/login', { username: 'ponto', password: 'ponto-password' })).status, 401)
    Object.assign(ponto, await (await request('/auth/login', { username: 'ponto', password: 'replacement-password' })).json())
    const body = { photo, pin: '1234', kind: 'Entrada', request_id: randomUUID() }
    assert.equal((await request('/terminal/punch', { ...body, photo: null }, ponto.token)).status, 400)
    assert.equal((await request('/terminal/punch', { ...body, photo: 'not-an-image' }, ponto.token)).status, 400)
    const first = await request('/terminal/punch', body, ponto.token)
    assert.equal(first.status, 200)
    assert.deepEqual(await (await request('/terminal/punch', body, ponto.token)).json(), await first.json())
    assert.equal(Number((await db('entries').where({ request_id: body.request_id }).count('* as count').first()).count), 1)
    assert.equal((await request('/terminal/punch', { ...body, request_id: randomUUID() }, ponto.token)).status, 409)
    await db('employees').where({ id }).update({ active: false })
    assert.equal((await request('/terminal/punch', { ...body, request_id: randomUUID() }, ponto.token)).status, 403)
    await db('ponto_sessions').update({ expires_at: Date.now() - 1 })
    assert.equal((await request('/terminal/me', undefined, ponto.token)).status, 401)
    assert.equal((await request('/auth/change-password', { current_password: 'wrong', password: 'updated-password' }, admin.token)).status, 400)
    assert.equal((await request('/auth/change-password', { current_password: 'initial-password', password: 'updated-password' }, admin.token)).status, 200)
    assert.equal((await request('/auth/me', undefined, admin.token)).status, 401)
    assert.equal((await request('/auth/login', { username: 'admin', password: 'initial-password' })).status, 401)
    assert.equal((await request('/auth/login', { username: 'admin', password: 'updated-password' })).status, 200)
    await db('attempts').where('key', 'like', 'login:%').update({ count: 10 })
    const limited = await request('/auth/login', { username: 'admin', password: 'updated-password' })
    assert.equal(limited.status, 429)
    assert.ok(limited.headers.get('retry-after'))
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve))
    await db.destroy()
  }
})
