import { randomBytes } from 'node:crypto'
import { hashPassword } from './auth.js'
import { supabaseClient, SupabaseError } from './supabase.js'

const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const duplicateEmail = () => new SupabaseError('Este e-mail já está cadastrado. Entre com essa conta ou use outro e-mail.', 409)
export function createAdminRegistration(db, config, fetcher) {
  const request = supabaseClient(config, fetcher)
  function enabled() {
    if (!config.adminRegistrationEnabled) throw new SupabaseError('O cadastro ainda não está disponível. Entre em contato com o administrador.', 503)
  }
  async function closeProviderSession(result) {
    if (result.access_token) {
      try { await request('/auth/v1/logout?scope=local', { method: 'POST', token: result.access_token }) }
      catch { /* No application session is issued by registration or verification. */ }
    }
  }
  async function signup({ email: input, password, name } = {}) {
    enabled()
    const email = normalizeEmail(input)
    if (!validEmail(email) || typeof name !== 'string' || !name.trim() || name.trim().length > 120 || typeof password !== 'string' || password.length < 10 || password.length > 1024) {
      throw new SupabaseError('Informe nome, e-mail válido e senha com pelo menos 10 caracteres.', 400)
    }
    // Fail closed if the project's email confirmation requirement is disabled.
    const settings = await request('/auth/v1/settings')
    if (settings.mailer_autoconfirm !== false) throw new SupabaseError('A confirmação de e-mail precisa ser configurada pelo administrador.')
    const [registration, admin] = await Promise.all([
      db('admin_registrations').whereRaw('lower(trim(email)) = ?', [email]).first(),
      db('admins').whereRaw('lower(trim(username)) = ?', [email]).first(),
    ])
    if (registration || admin) throw duplicateEmail()
    const result = await request('/auth/v1/signup', { method: 'POST', body: { email, password } })
    await closeProviderSession(result)
    const user = result.user || result
    // Supabase may return a fake user for an existing email to avoid account enumeration.
    if (Array.isArray(user.identities) && user.identities.length === 0) throw duplicateEmail()
    if (!user.id) throw new SupabaseError('Não foi possível concluir o cadastro. Tente novamente.', 502)
    // Persist the identity verified by Auth; never trust user metadata for permissions.
    await db('admin_registrations').insert({ email, name: name.trim(), supabase_user_id: user.id, created_at: new Date().toISOString() }).onConflict('email').ignore()
  }
  async function resend(input) {
    enabled()
    const email = normalizeEmail(input)
    if (!validEmail(email)) throw new SupabaseError('Informe um e-mail válido.', 400)
    await request('/auth/v1/resend', { method: 'POST', body: { type: 'signup', email } })
  }
  async function verify(input, token) {
    enabled()
    const email = normalizeEmail(input)
    if (!validEmail(email) || typeof token !== 'string' || !/^\d{6,10}$/.test(token)) throw new SupabaseError('Informe o e-mail e o código recebido.', 400)
    let result
    try { result = await request('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token } }) }
    catch (error) {
      if (error instanceof SupabaseError && error.status === 401) throw new SupabaseError('Código inválido ou expirado. Solicite um novo código.', 400)
      throw error
    }
    await closeProviderSession(result)
    if (!result.user?.email_confirmed_at || normalizeEmail(result.user.email) !== email) throw new SupabaseError('Não foi possível confirmar o e-mail.', 400)
    await db('admin_registrations').where({ email, supabase_user_id: result.user.id }).update({ email_confirmed_at: result.user.email_confirmed_at })
  }
  async function review(id, action, reviewer) {
    enabled()
    if (!Number.isSafeInteger(id) || id < 1 || !['approve', 'reject'].includes(action)) throw new SupabaseError('Solicitação inválida.', 400)
    const registration = await db('admin_registrations').where({ id }).first()
    if (!registration || registration.status !== 'pending') throw new SupabaseError('Solicitação não está pendente.', 409)
    let confirmedAt, passwordHash
    if (action === 'approve') {
      const result = await request(`/auth/v1/admin/users/${encodeURIComponent(registration.supabase_user_id)}`, { admin: true })
      const user = result.user || result
      if (user.id !== registration.supabase_user_id || normalizeEmail(user.email) !== registration.email || !user.email_confirmed_at || (user.banned_until && Date.parse(user.banned_until) > Date.now())) {
        throw new SupabaseError('O usuário precisa confirmar o e-mail antes da aprovação.', 409)
      }
      confirmedAt = user.email_confirmed_at
      passwordHash = await hashPassword(randomBytes(32).toString('hex'))
    }
    await db.transaction(async trx => {
      const updated = await trx('admin_registrations').where({ id, status: 'pending' }).update({
        status: action === 'approve' ? 'approved' : 'rejected', reviewed_by: reviewer, reviewed_at: new Date().toISOString(),
        ...(confirmedAt ? { email_confirmed_at: confirmedAt } : {}),
      })
      if (!updated) throw new SupabaseError('Solicitação já analisada.', 409)
      if (action === 'approve') {
        if (await trx('admins').where({ username: registration.email }).first()) throw new SupabaseError('Já existe um administrador com esse e-mail.', 409)
        await trx('admins').insert({ username: registration.email, password_hash: passwordHash, supabase_user_id: registration.supabase_user_id })
      }
    })
  }
  return { signup, resend, verify, review }
}
