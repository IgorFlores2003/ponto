// Opt-in only: creates an isolated, randomly named schema on the configured
// Supabase session pooler; no application tables are read or modified.
import assert from 'node:assert/strict'
import knex from 'knex'
import { randomBytes, randomUUID } from 'node:crypto'
import { createDatabase } from '../server/db.js'
import { createApp } from '../server/app.js'
import { seedAdmin } from '../server/admin-seed.js'
import { pinDigest } from '../server/auth.js'
import { captureBackup, encryptBackup, decryptBackup, restoreBackup } from '../server/backup-data.js'
import { photo } from './fixtures.mjs'

if (process.env.RUN_POSTGRES_TESTS !== '1') throw new Error('Set RUN_POSTGRES_TESTS=1 to create and remove an isolated test schema.')
const source = createDatabase()
const schema = `ponto_test_${randomBytes(8).toString('hex')}`
const config = source.client.config
const url = new URL(config.connection.connectionString)
if (url.hostname.endsWith('.pooler.supabase.com')) url.port = '5432'
const db = knex({ ...config, connection: { ...config.connection, connectionString: url.href }, searchPath: [schema], pool: { min: 0, max: 5 }, migrations: { ...config.migrations, schemaName: schema } })
let server
try {
  await source.raw('create schema ??', [schema])
  assert.equal((await db.raw('select current_schema() as name')).rows[0].name, schema)
  await db.migrate.latest()
  await seedAdmin(db, { username: 'admin', password: 'PostgresTest12345' })
  const jobs = []
  const app = createApp(db, { config: { terminalAuthProvider: 'local', photoProvider: 'database' }, analyzer: async () => ({ face_detected: true, divergence_status: 'ok' }), backgroundTask: job => jobs.push(job) })
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  const base = `http://127.0.0.1:${server.address().port}/api`
  const request = (path, body, token) => fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const admin = await (await request('/auth/login', { username: 'admin', password: 'PostgresTest12345' })).json()
  assert.equal(admin.role, 'admin')
  const account = await request('/ponto-users', { username: 'ponto', password: 'PostgresPonto12345' }, admin.token)
  assert.equal(account.status, 201)
  const ponto = await (await request('/auth/login', { username: 'ponto', password: 'PostgresPonto12345' })).json()
  await db('employees').insert({ name: 'Concurrent test', registration: 'CONCURRENT', pin_digest: await pinDigest(db, '1234'), created_at: new Date().toISOString() })
  const body = { photo, pin: '1234', kind: 'Entrada', request_id: randomUUID() }
  const results = await Promise.all(Array.from({ length: 8 }, () => request('/terminal/punch', body, ponto.token)))
  assert.deepEqual(results.map(result => result.status), Array(8).fill(200))
  assert.equal(Number((await db('entries').count('* as count').first()).count), 1)
  const load = await Promise.all(Array.from({ length: 20 }, () => request('/employees', undefined, admin.token)))
  assert.ok(load.every(response => response.status === 200))
  await Promise.all(jobs)
  const secure = await db('pg_tables').where({ schemaname: schema }).whereNotIn('tablename', ['knex_migrations', 'knex_migrations_lock']).select('tablename', 'rowsecurity')
  assert.ok(secure.every(row => row.rowsecurity))
  const policies = await source('pg_policies').where({ schemaname: schema })
  assert.equal(policies.length, 0)
  const restoredSchema = `${schema}_restored`
  const snapshot = decryptBackup(encryptBackup(await captureBackup(db), 'a'.repeat(64)), 'a'.repeat(64))
  const restored = knex({ ...config, connection: { ...config.connection, connectionString: url.href }, searchPath: [restoredSchema], pool: { min: 0, max: 2 }, migrations: { ...config.migrations, schemaName: restoredSchema } })
  try {
    await source.raw('create schema ??', [restoredSchema])
    assert.equal((await restored.raw('select current_schema() as name')).rows[0].name, restoredSchema)
    await restored.migrate.latest()
    await restoreBackup(restored, snapshot)
    assert.equal(Number((await restored('entries').count('* as count').first()).count), 1)
    assert.equal((await restored('employees').first()).pin_digest, (await db('employees').first()).pin_digest)
    assert.equal((await restored('admins').first()).password_hash, (await db('admins').first()).password_hash)
    console.log('Backup: exportação criptografada e restauração em schema PostgreSQL vazio aprovadas.')
  } finally {
    await restored.destroy()
    await source.raw('drop schema if exists ?? cascade', [restoredSchema])
  }
  console.log('PostgreSQL: migrations, autenticação, 8 batidas simultâneas sem duplicação, 20 consultas concorrentes e RLS aprovados.')
} finally {
  if (server?.listening) await new Promise(resolve => server.close(resolve))
  await db.destroy()
  await source.raw('drop schema if exists ?? cascade', [schema])
  await source.destroy()
}
