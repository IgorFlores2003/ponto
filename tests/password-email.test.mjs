import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase } from '../server/db.js'
import { createPasswordManagement } from '../server/password-management.js'

test('recovery rejects unknown emails and sends a code for a registered email', async () => {
  const db = createDatabase(':memory:')
  const calls = []
  try {
    await db.migrate.latest()
    const passwords = createPasswordManagement(db, { adminRegistrationEnabled: true, url: 'https://example.com', publicKey: 'public' }, async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) })
      return Response.json({})
    })
    await assert.rejects(passwords.forgot('missing@example.com'), error => error.status === 400 && error.message.includes('E-mail inválido'))
    assert.equal(calls.length, 0)
    await db('admin_registrations').insert({ email: 'known@example.com', name: 'Teste', supabase_user_id: 'known-id', created_at: new Date().toISOString() })
    await passwords.forgot(' Known@Example.com ')
    assert.deepEqual(calls, [{ url: 'https://example.com/auth/v1/recover', body: { email: 'known@example.com' } }])
  } finally { await db.destroy() }
})

test('recovery explains rejected password updates and only closes its temporary session', async () => {
  const db = createDatabase(':memory:')
  try {
    await db.migrate.latest()
    for (const [code, upstreamStatus, message] of [
      ['session_not_found', 403, /novo código de recuperação/],
      ['same_password', 422, /diferente da atual.*novo código/],
      ['weak_password', 422, /Senha fraca.*novo código/],
    ]) {
      const logouts = []
      const passwords = createPasswordManagement(db, { adminRegistrationEnabled: true, url: 'https://example.com', publicKey: 'public' }, async (url, options) => {
        const path = new URL(url).pathname
        if (path === '/auth/v1/verify') return Response.json({ access_token: 'temporary', user: { id: 'user-id', email: 'known@example.com', email_confirmed_at: new Date().toISOString() } })
        if (path === '/auth/v1/user') return Response.json({ code }, { status: upstreamStatus })
        if (path === '/auth/v1/logout') { logouts.push(new URL(url).searchParams.get('scope')); return new Response(null, { status: 204 }) }
        throw new Error('Unexpected request')
      })
      await assert.rejects(passwords.reset({ email: 'known@example.com', code: '12345678', password: 'replacement-password' }), error => error.status === 400 && message.test(error.message))
      assert.deepEqual(logouts, ['local'], 'a rejected recovery must not revoke other sessions')
    }
  } finally { await db.destroy() }
})
