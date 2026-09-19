import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase } from './db.js'
import { pinDigest, verifyPassword, hashPassword } from './auth.js'

test('seeds criam acessos válidos e preservam dados ao repetir', async () => {
  const db = createDatabase(':memory:')
  try {
    await db.migrate.latest()
    await db.seed.run()
    const admin = await db('admins').first()
    assert.ok(await verifyPassword('Admin@12345', admin.password_hash))
    assert.equal((await db('employees').where({ pin_digest: await pinDigest(db, '1234') }).first()).name, 'Igor')
    assert.equal((await db('employees').where({ pin_digest: await pinDigest(db, '2344') }).first()).name, 'Yasmim')
    await db('admins').where({ id: admin.id }).update({ password_hash: await hashPassword('senha-alterada') })
    await db('employees').where({ registration: 'DEMO-001' }).update({ name: 'Igor atualizado' })
    await db.seed.run()
    assert.equal((await db('employees')).length, 2)
    assert.equal((await db('admins')).length, 1)
    assert.ok(await verifyPassword('senha-alterada', (await db('admins').first()).password_hash))
    assert.equal((await db('employees').where({ registration: 'DEMO-001' }).first()).name, 'Igor atualizado')
    assert.equal((await db('entries')).length, 0)
  } finally { await db.destroy() }
})

test('conflito de PIN desfaz o seed inteiro sem alterar o dono original', async () => {
  const db = createDatabase(':memory:')
  try {
    await db.migrate.latest()
    await db('employees').insert({ name: 'Original', registration: 'EXISTENTE', pin_digest: await pinDigest(db, '2344'), created_at: new Date().toISOString() })
    await assert.rejects(db.seed.run(), /já está em uso/)
    assert.equal((await db('admins')).length, 0)
    assert.equal((await db('employees')).length, 1)
    assert.equal((await db('employees').first()).name, 'Original')
  } finally { await db.destroy() }
})
