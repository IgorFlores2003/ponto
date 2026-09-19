import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { matchingBreak, localDateTime, validRule } from './breaks.js'
import { reportFor } from './reports.js'
import { createDatabase } from './db.js'
import { createAdmin, pinDigest } from './auth.js'
import { createApp } from './app.js'

test('faixa de pausa usa Brasília, inclui início, exclui fim e respeita vigência', () => {
  const rule = { name: 'Café', starts_at: '08:00', ends_at: '09:00', effective_from: '2026-09-19', active: true }
  assert.ok(validRule(rule))
  assert.equal(matchingBreak([rule], new Date('2026-09-19T11:00:00Z')).name, 'Café')
  assert.equal(matchingBreak([rule], new Date('2026-09-19T12:00:00Z')), null)
  assert.equal(matchingBreak([rule], new Date('2026-09-18T11:00:00Z')), null)
  assert.equal(matchingBreak([{ ...rule, active: false }], new Date('2026-09-19T11:00:00Z')), null)
  assert.equal(validRule({ ...rule, ends_at: '07:00' }), false)
})

test('relatório preserva os nomes gravados e separa almoço e café', () => {
  const e = (kind, time, break_name) => ({ employee_id: 1, kind, occurred_at: `2026-09-19T${time}:00-03:00`, break_name })
  const entries = [e('Entrada', '08:00'), e('Início do intervalo', '12:00', 'Almoço'), e('Fim do intervalo', '13:00', 'Almoço'), e('Início do intervalo', '15:00', 'Café da tarde')]
  const [row] = reportFor([{ id: 1 }], entries, '2026-09-19', '2026-09-19', Date.parse('2026-09-19T15:15:00-03:00'))
  assert.equal(row.current_break_name, 'Café da tarde')
  assert.equal(row.work_seconds, 21600)
  assert.deepEqual(row.break_totals, [{ name: 'Almoço', seconds: 3600 }, { name: 'Café da tarde', seconds: 900 }])
})

test('admin cadastra pausas; PIN inicia e retorna; repetição não inicia a mesma pausa novamente', async () => {
  const db = createDatabase(':memory:')
  let server
  const date = localDateTime().date
  let now = new Date(`${date}T12:00:00-03:00`)
  try {
    await db.migrate.latest(); await createAdmin(db, 'admin', 'senha-segura-123')
    const [{ id }] = await db('employees').insert({ name: 'Teste', registration: '1', pin_digest: await pinDigest(db, '1234'), created_at: now.toISOString() }).returning('id')
    await db('entries').insert({ employee_id: id, kind: 'Entrada', occurred_at: new Date(`${date}T08:00:00-03:00`).toISOString() })
    server = createApp(db, { clock: () => now }).listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
    const base = `http://127.0.0.1:${server.address().port}/api`
    async function post(path, body, token) {
      const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
      return { status: r.status, data: r.status === 204 ? null : await r.json() }
    }
    const rule = { name: 'Almoço', starts_at: '11:00', ends_at: '14:00', effective_from: date }
    assert.equal((await post('/break-rules', rule)).status, 401)
    const token = (await post('/auth/login', { username: 'admin', password: 'senha-segura-123' })).data.token
    const created = await post('/break-rules', rule, token)
    assert.equal(created.status, 201)
    assert.equal((await post('/break-rules', { ...rule, name: 'Conflito' }, token)).status, 409)
    const punch = () => post('/terminal/punch', { pin: '1234', request_id: randomUUID() })
    const start = await punch(); assert.equal(start.data.kind, 'Início do intervalo'); assert.equal(start.data.break_name, 'Almoço')
    now = new Date(`${date}T12:30:00-03:00`)
    const returned = await punch(); assert.equal(returned.data.kind, 'Fim do intervalo'); assert.equal(returned.data.break_name, 'Almoço')
    now = new Date(`${date}T12:31:00-03:00`)
    assert.equal((await punch()).data.kind, 'Saída')
    assert.equal((await post(`/break-rules/${created.data.id}/deactivate`, {}, token)).status, 204)
    assert.equal((await db('entries').where({ kind: 'Início do intervalo' }).first()).break_name, 'Almoço')
  } finally { if (server?.listening) await new Promise(resolve => server.close(resolve)); await db.destroy() }
})
