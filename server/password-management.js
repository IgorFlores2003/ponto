import { randomBytes } from 'node:crypto'
import { hashPassword, verifyPassword } from './auth.js'
import { supabaseClient, SupabaseError } from './supabase.js'

const emailOf = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 1024) throw new SupabaseError('Use uma senha de 10 a 1024 caracteres.', 400)
}
export function createPasswordManagement(db, config, fetcher) {
  const request = supabaseClient(config, fetcher)
  function enabled() {
    if (!config.adminRegistrationEnabled) throw new SupabaseError('A recuperação por e-mail ainda não está disponível. Entre em contato com o administrador.', 503)
  }
  async function revokeSessions(adminId, connection = db) {
    await connection('sessions').where({ admin_id: adminId }).delete()
    await connection('terminal_sessions').where({ admin_id: adminId }).delete()
  }
  async function closeRemote(token) {
    if (!token) return
    try { await request('/auth/v1/logout?scope=global', { method: 'POST', token }) }
    catch { /* App sessions have already been revoked. */ }
  }
  async function forgot(input) {
    enabled()
    const email = emailOf(input)
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SupabaseError('Informe um e-mail válido.', 400)
    const registration = await db('admin_registrations').where({ email }).first()
    const account = await db('admins').whereRaw('lower(trim(username)) = ?', [email]).first()
    if (registration || account) {
      if (account && !account.supabase_user_id) {
        // A legacy local admin gets an Auth identity only when they request recovery.
        // Keep it unlinked until they prove access to this email with the recovery code.
        try {
          await request('/auth/v1/admin/users', { method: 'POST', admin: true,
            body: { email, password: randomBytes(48).toString('base64url'), email_confirm: true } })
        } catch (error) {
          // An existing Auth identity can still receive a recovery message.
          if (!(error instanceof SupabaseError) || ![400, 409].includes(error.upstreamStatus)) throw error
        }
      }
      await request('/auth/v1/recover', { method: 'POST', body: { email } })
    }
  }
  async function reset({ email: input, code, password } = {}) {
    enabled(); validatePassword(password)
    const email = emailOf(input)
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof code !== 'string' || !/^\d{6,10}$/.test(code)) throw new SupabaseError('Informe o e-mail e o código de recuperação.', 400)
    let result
    try { result = await request('/auth/v1/verify', { method: 'POST', body: { type: 'recovery', email, token: code } }) }
    catch (error) {
      if (error instanceof SupabaseError && error.status === 401) throw new SupabaseError('Código inválido ou expirado. Solicite outro e-mail.', 400)
      throw error
    }
    try {
      if (!result.access_token || !result.user?.email_confirmed_at || emailOf(result.user.email) !== email) throw new SupabaseError('Não foi possível validar a recuperação.', 400)
      let account = await db('admins').where({ supabase_user_id: result.user.id }).first()
      if (!account) account = await db('admins').whereRaw('lower(trim(username)) = ?', [email]).whereNull('supabase_user_id').first()
      await request('/auth/v1/user', { method: 'PUT', token: result.access_token, body: { password } })
      if (account) {
        await db.transaction(async trx => {
          if (!account.supabase_user_id) {
            const linked = await trx('admins').where({ id: account.id }).whereNull('supabase_user_id').update({ supabase_user_id: result.user.id })
            if (!linked) throw new SupabaseError('Não foi possível vincular a conta. Entre em contato com o administrador.', 409)
          }
          await revokeSessions(account.id, trx)
        })
      }
    } finally { await closeRemote(result.access_token) }
  }
  async function change(adminId, { current_password: currentPassword, password } = {}) {
    validatePassword(password)
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024) throw new SupabaseError('Informe sua senha atual.', 400)
    const account = await db('admins').where({ id: adminId }).first()
    if (!account) throw new SupabaseError('Entre novamente.', 401)
    if (!account.supabase_user_id) {
      if (!await verifyPassword(currentPassword, account.password_hash)) throw new SupabaseError('Senha atual incorreta.', 400)
      const passwordHash = await hashPassword(password)
      await db.transaction(async trx => {
        const updated = await trx('admins').where({ id: adminId, password_hash: account.password_hash }).update({ password_hash: passwordHash })
        if (!updated) throw new SupabaseError('A senha foi alterada em outra sessão. Entre novamente.', 409)
        await revokeSessions(adminId, trx)
      })
    } else {
      enabled()
      let result
      try { result = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: account.username, password: currentPassword } }) }
      catch (error) {
        if (error instanceof SupabaseError && error.status === 401) throw new SupabaseError('Senha atual incorreta.', 400)
        throw error
      }
      try {
        if (result.user?.id !== account.supabase_user_id || !result.user.email_confirmed_at || !result.access_token) throw new SupabaseError('Não foi possível validar sua conta.', 401)
        await db.transaction(trx => revokeSessions(adminId, trx))
        await request('/auth/v1/user', { method: 'PUT', token: result.access_token, body: { password, current_password: currentPassword } })
      } finally { await closeRemote(result.access_token) }
    }
  }
  return { forgot, reset, change }
}
