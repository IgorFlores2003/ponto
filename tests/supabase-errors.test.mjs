import test from 'node:test'
import assert from 'node:assert/strict'
import { supabaseClient } from '../server/supabase.js'

test('email errors explain the next step without exposing upstream details', async () => {
  for (const path of ['/auth/v1/signup', '/auth/v1/resend', '/auth/v1/recover']) {
    for (const [upstream, code, status, message] of [
      [500, 'unexpected_failure', 503, 'Não foi possível enviar o código'],
      [429, 'over_email_send_rate_limit', 429, 'Aguarde alguns minutos'],
      [422, 'email_address_invalid', 400, 'E-mail inválido'],
    ]) {
      const request = supabaseClient({ url: 'https://example.com', publicKey: 'public' }, async () => Response.json({ code, message: 'private SMTP credentials' }, { status: upstream }))
      await assert.rejects(request(path, { method: 'POST', body: {} }), error => {
        assert.equal(error.status, status)
        assert.equal(error.upstreamStatus, upstream)
        assert.ok(error.message.includes(message))
        assert.ok(!error.message.includes('private'))
        return true
      })
    }
  }
})

test('non-JSON upstream errors remain safe and login failures stay unauthorized', async () => {
  const request = supabaseClient({ url: 'https://example.com', publicKey: 'public' }, async () => new Response('private error', { status: 500 }))
  await assert.rejects(request('/auth/v1/resend'), error => error.status === 503 && !error.message.includes('private'))
  const login = supabaseClient({ url: 'https://example.com', publicKey: 'public' }, async () => Response.json({ code: 'invalid_credentials' }, { status: 400 }))
  await assert.rejects(login('/auth/v1/token?grant_type=password'), error => error.status === 401)
})
