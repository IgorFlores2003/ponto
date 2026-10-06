import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export const backupTables = ['admins', 'employees', 'settings', 'break_rules', 'entries', 'schedule_events', 'sessions', 'attempts', 'terminal_users', 'terminal_sessions', 'admin_registrations', 'photo_deletion_jobs', 'ponto_users', 'ponto_sessions', 'photo_analysis_jobs', 'report_closures']
export async function captureBackup(db) {
  return db.transaction(async trx => {
    const tables = {}
    for (const table of backupTables) if (await trx.schema.hasTable(table)) tables[table] = await trx(table).select('*')
    return { version: 1, created_at: new Date().toISOString(), migrations: await trx('knex_migrations').select('name').orderBy('id'), tables }
  }, db.client.config.client === 'pg' ? { isolationLevel: 'repeatable read', readOnly: true } : {})
}
export function encryptBackup(data, secret) {
  if (!/^[a-f0-9]{64}$/i.test(secret || '')) throw new Error('Configure AUTH_SESSION_ENCRYPTION_KEY (32 bytes hex) para proteger o backup.')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv)
  const bytes = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()])
  return Buffer.from(JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: bytes.toString('base64') }))
}
export function decryptBackup(bytes, secret) {
  const value = JSON.parse(bytes.toString())
  if (value.version !== 1) throw new Error('Formato de backup não suportado.')
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), Buffer.from(value.iv, 'base64'))
  cipher.setAuthTag(Buffer.from(value.tag, 'base64'))
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data, 'base64')), cipher.final()]).toString())
}
// Restore into an empty, already migrated database. The caller must explicitly
// select the destination; never use this function on the running application DB.
export async function restoreBackup(db, snapshot) {
  if (snapshot.version !== 1 || !snapshot.tables) throw new Error('Backup inválido.')
  await db.transaction(async trx => {
    for (const table of backupTables) {
      if (!await trx.schema.hasTable(table)) throw new Error('Aplique todas as migrations no destino antes de restaurar.')
      if (await trx(table).first()) throw new Error('O banco de destino precisa estar vazio.')
    }
    for (const table of backupTables) {
      const rows = snapshot.tables[table] || []
      for (let offset = 0; offset < rows.length; offset += 100) await trx(table).insert(rows.slice(offset, offset + 100))
      if (trx.client.config.client === 'pg' && rows.some(row => Number.isInteger(row.id))) {
        const [{ sequence }] = (await trx.raw("select pg_get_serial_sequence(?, 'id') as sequence", [table])).rows
        if (sequence) await trx.raw('select setval(?::regclass, ?, true)', [sequence, Math.max(...rows.map(row => row.id))])
      }
    }
  })
}
