import express from 'express'
import { createApp } from '../../server/app.js'
import { createDatabase } from '../../server/db.js'
import { seedAdmin } from '../../server/admin-seed.js'
import { pinDigest } from '../../server/auth.js'
import { photo } from '../fixtures.mjs'

process.env.GEMINI_API_KEY = ''
const db = createDatabase(':memory:')
await db.migrate.latest()
await seedAdmin(db, { username: 'admin', password: 'AdminE2E12345' })
for (const [name, pin] of [['Teste Desktop', '1234'], ['Teste Mobile', '5678']]) {
  const [{ id }] = await db('employees').insert({ name, registration: pin, department: 'Teste', workdays: '[1,2,3,4,5]', hourly_rate_cents: 1500, overtime_rate_cents: 2500, pin_digest: await pinDigest(db, pin), created_at: new Date().toISOString() }).returning('id')
  await db('entries').insert([
    { employee_id: id, kind: 'Entrada', occurred_at: '2026-09-01T11:00:00.000Z', punch_photo: photo },
    { employee_id: id, kind: 'Saída', occurred_at: '2026-09-01T19:00:00.000Z', punch_photo: photo },
  ])
}
const app = createApp(db, { config: { terminalAuthProvider: 'local', photoProvider: 'database', adminRegistrationEnabled: false } })
app.use(express.static('dist'))
const server = app.listen(4175, '127.0.0.1')
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await db.destroy(); process.exit(0) }))
