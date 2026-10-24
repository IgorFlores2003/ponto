import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase } from '../server/db.js'
import { createApp } from '../server/app.js'

const config = { terminalAuthProvider: 'local', photoProvider: 'database', adminRegistrationEnabled: true, url: 'https://auth.example', publicKey: 'public', secretKey: 'secret', encryptionKey: 'a'.repeat(64) }

// Minimal Supabase Auth double: just enough behavior for registration, sessions and password changes.
function fakeSupabase() {
  const users = new Map()
  const calls = []
  const state = { expiresIn: 3600 }
  const session = user => ({ access_token: `access-${user.id}`, refresh_token: `refresh-${user.id}`, expires_in: state.expiresIn,
    user: { id: user.id, email: user.email, email_confirmed_at: user.confirmed } })
  const byToken = token => [...users.values()].find(user => `Bearer access-${user.id}` === token)
  async function fetcher(url, options) {
    const { pathname, search } = new URL(url)
    const body = options.body ? JSON.parse(options.body) : {}
    calls.push(`${options.method} ${pathname}${search}`)
    const fail = (status, code) => Response.json({ code }, { status })
    if (pathname === '/auth/v1/settings') return Response.json({ mailer_autoconfirm: false })
    if (pathname === '/auth/v1/signup') {
      const user = { id: `user-${users.size + 1}`, email: body.email, password: body.password, confirmed: null }
      users.set(body.email, user)
      return Response.json({ id: user.id, identities: [{}] })
    }
    if (pathname === '/auth/v1/verify') {
      const user = users.get(body.email)
      if (!user || body.token !== '123456') return fail(403, 'otp_expired')
      user.confirmed ||= new Date().toISOString()
      return Response.json(session(user))
    }
    if (pathname === '/auth/v1/token' && search === '?grant_type=password') {
      const user = users.get(body.email)
      return user?.password === body.password ? Response.json(session(user)) : fail(400, 'invalid_credentials')
    }
    if (pathname === '/auth/v1/token') {
      const user = [...users.values()].find(item => `refresh-${item.id}` === body.refresh_token)
      return user ? Response.json(session(user)) : fail(400, 'refresh_token_not_found')
    }
    if (pathname === '/auth/v1/user' && options.method === 'PUT') {
      const user = byToken(options.headers.Authorization)
      if (body.password === user.password) return fail(422, 'same_password')
      if (body.password.includes('weak')) return fail(422, 'weak_password')
      user.password = body.password
      return Response.json({ id: user.id })
    }
    if (pathname === '/auth/v1/user') return Response.json(byToken(options.headers.Authorization))
    if (pathname === '/auth/v1/logout') return new Response(null, { status: 204 })
    if (pathname === '/auth/v1/recover') return Response.json({})
    throw new Error(`Unexpected Supabase call ${pathname}`)
  }
  return { users, calls, state, fetcher }
}

async function start(supabase) {
  const db = createDatabase(':memory:')
  await db.migrate.latest()
  const server = createApp(db, { config, fetcher: supabase.fetcher }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}/api`
  const request = async (path, body, token) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: response.status === 204 ? null : await response.json() }
  }
  return { db, request, close: async () => { await new Promise(resolve => server.close(resolve)); await db.destroy() } }
}

test('signup, password change and recovery sign the admin in', async () => {
  const supabase = fakeSupabase()
  const { request, close } = await start(supabase)
  try {
    assert.equal((await request('/auth/signup', { name: 'Ana', email: 'ana@example.com', password: 'first-password' })).status, 202)
    const first = await request('/auth/verify-email', { email: 'ana@example.com', code: '123456' })
    assert.equal(first.body.role, 'admin', 'the first confirmed registration becomes the admin')
    supabase.calls.length = 0
    assert.equal((await request('/auth/me', undefined, first.body.token)).status, 200)
    assert.deepEqual(supabase.calls, [], 'a fresh session is validated without calling Supabase')

    await request('/auth/signup', { name: 'Bruno', email: 'bruno@example.com', password: 'bruno-password' })
    const second = await request('/auth/verify-email', { email: 'bruno@example.com', code: '123456' })
    assert.equal(second.body.token, undefined, 'later registrations still need approval')
    assert.equal((await request('/auth/login', { username: 'bruno@example.com', password: 'bruno-password' })).status, 401)

    const weak = await request('/auth/change-password', { current_password: 'first-password', password: 'weak-password' }, first.body.token)
    assert.equal(weak.status, 400)
    assert.match(weak.body.error, /Senha fraca/)
    const same = await request('/auth/change-password', { current_password: 'first-password', password: 'first-password' }, first.body.token)
    assert.match(same.body.error, /diferente da atual/)
    assert.equal((await request('/auth/me', undefined, first.body.token)).status, 200, 'a rejected password keeps the session')

    const changed = await request('/auth/change-password', { current_password: 'first-password', password: 'second-password' }, first.body.token)
    assert.equal(changed.status, 200)
    assert.equal((await request('/auth/me', undefined, first.body.token)).status, 401)
    assert.equal((await request('/auth/me', undefined, changed.body.token)).status, 200)
    assert.ok(supabase.calls.includes('POST /auth/v1/logout?scope=others'))

    await request('/auth/forgot-password', { email: 'bruno@example.com' })
    const pending = await request('/auth/reset-password', { email: 'bruno@example.com', code: '123456', password: 'bruno-new-password' })
    assert.equal(pending.status, 200)
    assert.equal(pending.body.token, undefined)
    assert.match(pending.body.message, /aguarda a aprovação/)

    const recovered = await request('/auth/reset-password', { email: 'ana@example.com', code: '123456', password: 'third-password' })
    assert.equal(recovered.body.role, 'admin')
    assert.equal((await request('/auth/me', undefined, changed.body.token)).status, 401)
    assert.equal((await request('/auth/me', undefined, recovered.body.token)).status, 200)
  } finally { await close() }
})

test('a registration confirmed before any admin existed can sign in, and sessions refresh only near expiry', async () => {
  const supabase = fakeSupabase()
  const { db, request, close } = await start(supabase)
  try {
    supabase.users.set('ana@example.com', { id: 'user-1', email: 'ana@example.com', password: 'first-password', confirmed: new Date().toISOString() })
    await db('admin_registrations').insert({ email: 'ana@example.com', name: 'Ana', supabase_user_id: 'user-1', created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() })
    assert.equal((await request('/auth/login', { username: 'ana@example.com', password: 'wrong-password' })).status, 401)
    assert.equal(await db('admins').first(), undefined)
    supabase.state.expiresIn = 30
    const login = await request('/auth/login', { username: 'ana@example.com', password: 'first-password' })
    assert.equal(login.body.role, 'admin')
    supabase.calls.length = 0
    assert.equal((await request('/auth/me', undefined, login.body.token)).status, 200)
    assert.deepEqual(supabase.calls, ['POST /auth/v1/token?grant_type=refresh_token'])
  } finally { await close() }
})
