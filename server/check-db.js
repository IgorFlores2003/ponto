import { createDatabase } from './db.js'
const db = createDatabase()
try {
  await db.raw('select 1')
  const [{ count: employees }] = await db('employees').count('* as count')
  const [{ count: admins }] = await db('admins').count('* as count')
  const [{ count: pendingPins }] = await db('employees').whereNull('pin_digest').count('* as count')
  console.log(`Banco conectado. Administradores: ${admins}; funcionários: ${employees}; PINs pendentes: ${pendingPins}.`)
  if (db.client.config.client === 'pg') {
    const tables = ['employees', 'entries', 'admins', 'sessions', 'settings', 'attempts', 'break_rules', 'schedule_events', 'terminal_users', 'terminal_sessions', 'admin_registrations', 'photo_deletion_jobs', 'ponto_users', 'ponto_sessions', 'photo_analysis_jobs', 'report_closures']
    const rows = await db('pg_tables').where({ schemaname: 'public', rowsecurity: true }).whereIn('tablename', tables).select('tablename')
    if (rows.length !== tables.length) throw new Error('RLS incompleto ou migrations pendentes')
    const grants = await db('information_schema.role_table_grants').where({ table_schema: 'public' }).whereIn('table_name', tables).whereIn('grantee', ['anon', 'authenticated'])
    if (grants.length) throw new Error('Permissões públicas inesperadas nas tabelas do aplicativo')
    console.log(`RLS verificado nas ${tables.length} tabelas do aplicativo; sem grants para anon/authenticated.`)
  }
} catch (error) { console.error('Falha na verificação:', error.code || error.name); process.exitCode = 1 }
finally { await db.destroy() }
