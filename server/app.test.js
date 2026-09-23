import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabase } from './db.js'
import { createApp } from './app.js'
import { createAdmin, hashToken } from './auth.js'
import { reportFor } from './reports.js'

test('permissões, PIN exclusivo, batidas, relatório e sessões', async () => {
  const db = createDatabase(':memory:')
  let server
  try {
    await db.migrate.latest()
    await createAdmin(db, 'admin', 'senha-segura-123')
    server = createApp(db).listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
    const base = `http://127.0.0.1:${server.address().port}/api`
    async function request(path, body, token) {
      const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      return { status: response.status, data: response.status === 204 ? null : await response.json() }
    }
    for (const path of ['/employees', '/reports?from=2026-09-01&to=2026-09-18', '/employees/1/entries']) assert.equal((await request(path)).status, 401)
    assert.equal((await request('/employees', { name: 'intruso' })).status, 401)
    assert.equal((await request('/auth/login', { username: 'admin', password: 'errada' })).status, 401)
    const login = await request('/auth/login', { username: 'ADMIN', password: 'senha-segura-123' })
    assert.equal(login.status, 200)
    const token = login.data.token
    assert.equal((await request('/auth/me', undefined, token)).data.username, 'admin')
    const igor = await request('/employees', { name: 'Igor', registration: '001', pin: '1234' }, token)
    assert.equal(igor.status, 201)
    const yasmim = await request('/employees', { name: 'Yasmim', registration: '002', pin: '2344' }, token)
    assert.equal(yasmim.status, 201)
    const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
    assert.equal((await request(`/employees/${igor.data.id}/photo`, { photo })).status, 401)
    assert.equal((await request(`/employees/${igor.data.id}/photo`, { photo: 'data:image/svg+xml;base64,PHN2Zz4=' }, token)).status, 400)
    assert.equal((await request(`/employees/${igor.data.id}/photo`, { photo }, token)).status, 204)
    assert.equal((await request('/employees', undefined, token)).data.find(e => e.id === igor.data.id).photo, photo)
    assert.equal((await request(`/employees/${igor.data.id}/photo`, { photo: null }, token)).status, 204)
    assert.equal((await request('/employees', undefined, token)).data.find(e => e.id === igor.data.id).photo, null)

    assert.equal((await request(`/employees/${igor.data.id}/job-title`, { job_title: 'Atendente' })).status, 401)
    assert.equal((await request(`/employees/${igor.data.id}/job-title`, { job_title: 'Atendente' }, token)).status, 204)
    assert.equal((await request(`/employees/${igor.data.id}/job-title`, { job_title: 123 }, token)).status, 400)
    assert.equal((await request('/employees', undefined, token)).data.find(e => e.id === igor.data.id).job_title, 'Atendente')

    assert.equal((await request('/employees', { name: 'Outro', registration: '003', pin: '1234' }, token)).status, 409)
    assert.equal((await request('/employees', { name: 'Outro', registration: '003', pin: '123' }, token)).status, 400)
    const list = await request('/employees', undefined, token)
    assert.ok(list.data.every(e => e.has_pin && !('pin_digest' in e) && !('pin' in e)))
    assert.equal((await request(`/employees/${igor.data.id}/entries`, { kind: 'Entrada' })).status, 401)
    assert.equal((await request(`/employees/${igor.data.id}/entries`, { kind: 'Entrada' }, token)).status, 404)
    const punch = (pin, rest = {}) => request('/terminal/punch', { pin, request_id: randomUUID(), ...rest })
    assert.equal((await punch('9999')).status, 401)
    const id = randomUUID()
    const first = await punch('1234', { request_id: id, employee_id: yasmim.data.id, occurred_at: '2000-01-01' })
    assert.equal(first.status, 200); assert.equal(first.data.employee_name, 'Igor'); assert.equal(first.data.kind, 'Entrada')
    assert.ok(Date.now() - Date.parse(first.data.occurred_at) < 10000)
    assert.deepEqual((await punch('1234', { request_id: id })).data, first.data)
    assert.equal((await punch('1234')).status, 409)
    assert.equal((await punch('2344')).data.employee_name, 'Yasmim')
    assert.equal((await request(`/employees/${igor.data.id}/entries`, undefined, token)).data.length, 1)
    async function ageLast() { const last = await db('entries').where({ employee_id: igor.data.id }).orderBy('id', 'desc').first(); await db('entries').where({ id: last.id }).update({ occurred_at: new Date(Date.now() - 10000).toISOString() }) }
    await ageLast(); assert.equal((await punch('1234', { kind: 'Início do intervalo' })).data.kind, 'Início do intervalo')
    await ageLast(); assert.equal((await punch('1234')).data.kind, 'Fim do intervalo')
    await ageLast()
    const simultaneous = await Promise.all([punch('1234'), punch('1234')])
    assert.deepEqual(simultaneous.map(r => r.status).sort(), [200, 409])
    assert.equal((await request(`/employees/${igor.data.id}/pin`, { pin: '2344' }, token)).status, 409)
    assert.equal((await request(`/employees/${igor.data.id}/pin`, { pin: '0123' }, token)).status, 204)
    assert.equal((await punch('1234')).status, 401)
    await ageLast(); assert.equal((await punch('0123')).status, 200)
    const date = new Date().toISOString().slice(0, 10)
    assert.equal((await request(`/reports?from=${date}&to=${date}`, undefined, token)).data.rows.length, 2)
    assert.equal((await request('/reports?from=2026-02-30&to=2026-03-01', undefined, token)).status, 400)
    assert.equal((await request('/reports?from=2026-09-20&to=2026-09-01', undefined, token)).status, 400)
    assert.equal(igor.data.active, true)
    const employeePath = `/employees/${igor.data.id}`
    assert.equal((await request(`${employeePath}/status`, { active: false })).status, 401)
    assert.equal((await request(`${employeePath}/delete`, {})).status, 401)
    assert.equal((await request(`${employeePath}/status`, { active: 'false' }, token)).status, 400)
    assert.equal((await request('/employees/999999/status', { active: false }, token)).status, 404)
    const history = (await request(`${employeePath}/entries`, undefined, token)).data
    assert.equal((await request(`${employeePath}/status`, { active: false }, token)).status, 204)
    assert.equal((await punch('0123')).status, 403)
    assert.equal((await request('/employees', undefined, token)).data.find(e => e.id === igor.data.id).active, false)
    assert.deepEqual((await request(`${employeePath}/entries`, undefined, token)).data, history)
    assert.equal((await request(`/reports?from=${date}&to=${date}`, undefined, token)).data.rows.length, 2)
    assert.equal((await request(`${employeePath}/status`, { active: true }, token)).status, 204)
    await ageLast(); assert.equal((await punch('0123')).status, 200)
    const unused = await request('/employees', { name: 'Sem batidas', pin: '6789' }, token)
    assert.equal((await request(`/employees/${unused.data.id}/delete`, {}, token)).status, 204)
    assert.equal((await request(`/employees/${unused.data.id}/entries`, undefined, token)).status, 404)
    assert.equal((await punch('6789')).status, 401)
    assert.equal((await request(`${employeePath}/delete`, {}, token)).status, 204)
    assert.equal((await request(`${employeePath}/entries`, undefined, token)).status, 404)
    assert.equal((await request('/employees', undefined, token)).data.some(e => e.id === igor.data.id), false)
    assert.equal((await punch('0123')).status, 401)
    assert.equal((await request(`/reports?from=${date}&to=${date}`, undefined, token)).data.rows.length, 1)
    await db('sessions').where({ token_hash: hashToken(token) }).update({ expires_at: Date.now() - 1 })
    assert.equal((await request('/employees', undefined, token)).status, 401)
    const fresh = (await request('/auth/login', { username: 'admin', password: 'senha-segura-123' })).data.token
    assert.equal((await request('/auth/logout', {}, fresh)).status, 204)
    assert.equal((await request('/employees', undefined, fresh)).status, 401)
    await db('attempts').where({ key: 'pin:127.0.0.1' }).update({ count: 30 })
    assert.equal((await punch('9999')).status, 429)
  } finally { if (server?.listening) await new Promise(resolve => server.close(resolve)); await db.destroy() }
})

test('horas descontam intervalo, dividem meia-noite e incluem jornada aberta', () => {
  const people = [{ id: 1, name: 'Igor' }, { id: 2, name: 'Yasmim' }]
  const entry = (kind, occurred_at) => ({ employee_id: 1, kind, occurred_at })
  const rows = reportFor(people, [entry('Entrada', '2026-09-17T23:00:00-03:00'), entry('Início do intervalo', '2026-09-18T01:00:00-03:00'), entry('Fim do intervalo', '2026-09-18T02:00:00-03:00')], '2026-09-18', '2026-09-18', Date.parse('2026-09-18T04:00:00-03:00'))
  assert.equal(rows[0].minutes, 180); assert.equal(rows[0].punches, 2); assert.equal(rows[0].status, 'Em expediente'); assert.equal(rows[1].minutes, 0)
})

test('migração preserva funcionários antigos sem atribuir PIN automaticamente', async () => {
  const db = createDatabase(':memory:')
  try {
    await db.migrate.up()
    const [id] = await db('employees').insert({ name: 'Antigo', registration: '01', created_at: new Date().toISOString() })
    await db('entries').insert({ employee_id: id, kind: 'Entrada', occurred_at: new Date().toISOString() })
    await db.migrate.latest()
    assert.equal((await db('employees').first()).pin_digest, null)
    assert.equal(Boolean((await db('employees').first()).active), true)
    assert.equal((await db('entries')).length, 1)
  } finally { await db.destroy() }
})
