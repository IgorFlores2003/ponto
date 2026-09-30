import { createDatabase } from './db.js'
import { supabaseClient, supabaseConfig } from './supabase.js'

const args = process.argv.slice(2)
const argument = flag => { const index = args.indexOf(flag); return index < 0 ? '' : args[index + 1] || '' }
const username = argument('--name').trim().toLowerCase()
const userId = argument('--user-id')
let db
try {
  if (!username || username.length > 120 || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(userId)) throw new Error('Use --name nome-do-terminal --user-id UUID-do-usuario-no-Supabase-Auth.')
  const config = supabaseConfig({ ...process.env, TERMINAL_AUTH_PROVIDER: 'local', PHOTO_STORAGE: 'supabase' })
  const result = await supabaseClient(config)(`/auth/v1/admin/users/${userId}`, { admin: true })
  const user = result.user || result
  if (user.id !== userId || !user.email_confirmed_at || (user.banned_until && Date.parse(user.banned_until) > Date.now())) throw new Error('Selecione um usuário confirmado e ativo no Supabase Auth.')
  db = createDatabase()
  await db.transaction(async trx => {
    const existing = await trx('terminal_users').where({ username }).first()
    if (existing?.supabase_user_id && existing.supabase_user_id !== userId) throw new Error('Este terminal já está vinculado a outro usuário.')
    if (existing) {
      await trx('terminal_users').where({ id: existing.id }).update({ supabase_user_id: userId, active: true })
      await trx('terminal_sessions').where({ terminal_user_id: existing.id }).delete()
    } else {
      await trx('terminal_users').insert({ username, supabase_user_id: userId, active: true })
    }
  })
  console.log('Terminal vinculado. Com TERMINAL_AUTH_PROVIDER=supabase, entre no terminal com o e-mail e a senha do Supabase Auth. O acesso administrativo permanece separado.')
} catch (error) { console.error(['23505', 'SQLITE_CONSTRAINT_UNIQUE'].includes(error.code) ? 'O usuário já está vinculado a um terminal.' : error.message); process.exitCode = 1 }
finally { if (db) await db.destroy() }
