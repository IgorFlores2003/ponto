import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { hashPassword, verifyPassword, hashToken } from './auth.js'
import { supabaseClient, SupabaseError } from './supabase.js'

const SESSION_DURATION = 8 * 3600000
const denied = () => new SupabaseError('Usuário ou senha inválidos, ou acesso não autorizado.', 401)

function encrypt(payload, key, tokenHash) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
  cipher.setAAD(Buffer.from(tokenHash))
  const bytes = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64')
}
function decrypt(value, key, tokenHash) {
  const bytes = Buffer.from(value, 'base64')
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), bytes.subarray(0, 12))
  cipher.setAAD(Buffer.from(tokenHash))
  cipher.setAuthTag(bytes.subarray(12, 28))
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString())
}
function providerSession(data) {
  if (!data?.access_token || !data?.refresh_token || !data?.user?.id || !Number.isFinite(data.expires_in)) throw new SupabaseError()
  return { access_token: data.access_token, refresh_token: data.refresh_token, user_id: data.user.id,
    expires_at: Date.now() + data.expires_in * 1000 }
}

export function createSessionAuth(db, config, fetcher, scope = 'admin') {
  const request = supabaseClient(config, fetcher)
  const terminal = scope === 'terminal'
  const ponto = scope === 'ponto'
  const provider = terminal ? config.terminalAuthProvider : 'local'
  const local = provider === 'local'
  const sessions = ponto ? 'ponto_sessions' : terminal ? 'terminal_sessions' : 'sessions'
  const accounts = ponto ? 'ponto_users' : terminal && !local ? 'terminal_users' : 'admins'
  const ownerField = ponto ? 'ponto_user_id' : terminal && !local ? 'terminal_user_id' : 'admin_id'
  const dummyHash = local ? hashPassword(randomBytes(24).toString('hex')) : null
  async function revokeUpstream(payload) {
    try { await request('/auth/v1/logout?scope=local', { method: 'POST', token: payload.access_token }) }
    catch { console.warn('Sessão local encerrada; revogação remota indisponível.') }
  }
  async function login(username, password) {
    if (typeof username !== 'string' || username.length > 254 || typeof password !== 'string' || !password || password.length > 1024) throw denied()
    let account, payload
    let sessionProvider = provider
    if (local) {
      account = await db(accounts).where({ username: username.trim().toLowerCase() }).first()
      if (account?.supabase_user_id) {
        if (!config.adminRegistrationEnabled) throw denied()
        sessionProvider = 'supabase'
      } else {
        const valid = await verifyPassword(password, account?.password_hash || await dummyHash)
        if (!account || !valid || (ponto && !account.active)) throw denied()
      }
    }
    if (sessionProvider === 'supabase') {
      const result = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: username.trim().toLowerCase(), password } })
      payload = providerSession(result)
      // Only explicitly linked Auth accounts may open this company terminal.
      account = await db(accounts).where({ supabase_user_id: payload.user_id }).first()
      if (!account || ((ponto || accounts === 'terminal_users') && !account.active) || !result.user.email_confirmed_at) { await revokeUpstream(payload); throw denied() }
    }
    const token = randomBytes(32).toString('hex')
    const token_hash = hashToken(token)
    const expires_at = Date.now() + SESSION_DURATION
    try {
      await db(sessions).where('expires_at', '<=', Date.now()).delete()
      await db(sessions).insert({ token_hash, [ownerField]: account.id, expires_at, auth_provider: sessionProvider,
        provider_session: payload ? encrypt(payload, config.encryptionKey, token_hash) : null })
    } catch (error) { if (payload) await revokeUpstream(payload); throw error }
    return { token, expires_at, username: account.username }
  }
  async function authenticate(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null
    const token_hash = hashToken(token)
    // Row locking serializes refresh-token rotation across server instances.
    const result = await db.transaction(async trx => {
      const query = trx(sessions).where({ token_hash }).where('expires_at', '>', Date.now())
      if (trx.client.config.client === 'pg') query.forUpdate()
      const session = await query.first()
      if (!session) return null
      const account = await trx(accounts).where({ id: session[ownerField] }).first()
      if (!account || ((ponto || accounts === 'terminal_users') && !account.active)) return null
      const expectedProvider = local && account.supabase_user_id ? 'supabase' : provider
      if (session.auth_provider !== expectedProvider) return null
      if (expectedProvider === 'local') return session
      if (local && !config.adminRegistrationEnabled) return null
      let payload
      try { payload = decrypt(session.provider_session, config.encryptionKey, token_hash) }
      catch { await trx(sessions).where({ token_hash }).delete(); return null }
      if (payload.user_id !== account.supabase_user_id) { await trx(sessions).where({ token_hash }).delete(); return null }
      try {
        if (payload.expires_at <= Date.now() + 60000) {
          const refreshed = providerSession(await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: payload.refresh_token } }))
          if (refreshed.user_id !== payload.user_id) throw denied()
          payload = refreshed
          session.provider_session = encrypt(payload, config.encryptionKey, token_hash)
          await trx(sessions).where({ token_hash }).update({ provider_session: session.provider_session })
        }
        const user = await request('/auth/v1/user', { token: payload.access_token })
        if (user.id !== account.supabase_user_id || !user.email_confirmed_at || (user.banned_until && Date.parse(user.banned_until) > Date.now())) throw denied()
        return session
      } catch (error) {
        if (error instanceof SupabaseError && error.status === 401) { await trx(sessions).where({ token_hash }).delete(); return null }
        // Preserve a successfully rotated refresh token even when getUser is temporarily unavailable.
        return { error }
      }
    })
    if (result?.error) throw result.error
    return result
  }
  async function logout(session) {
    await db(sessions).where({ token_hash: session.token_hash }).delete()
    if (session.auth_provider === 'supabase' && session.provider_session) {
      try { await revokeUpstream(decrypt(session.provider_session, config.encryptionKey, session.token_hash)) }
      catch { /* Local revocation is already durable. */ }
    }
  }
  return { login, authenticate, logout }
}
