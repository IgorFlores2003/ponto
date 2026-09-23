import { createDatabase } from './db.js'
const db = createDatabase()
try {
  await db.raw('select 1')
  const [{ count: employees }] = await db('employees').count('* as count')
  const [{ count: admins }] = await db('admins').count('* as count')
  const [{ count: pendingPins }] = await db('employees').whereNull('pin_digest').count('* as count')
  console.log(`Banco conectado. Administradores: ${admins}; funcionários: ${employees}; PINs pendentes: ${pendingPins}.`)
  if (db.client.config.client === 'pg') {
    const { rows } = await db.raw("select count(*)::int as count from pg_tables where schemaname = 'public' and tablename in ('employees','entries','admins','sessions','settings','attempts','break_rules','schedule_events') and rowsecurity")
    if (rows[0].count !== 7) throw new Error('RLS incompleto')
    console.log('RLS verificado nas sete tabelas do aplicativo.')
  }
} catch (error) { console.error('Falha na verificação:', error.code || error.name); process.exitCode = 1 }
finally { await db.destroy() }
