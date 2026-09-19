import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash, createHmac } from 'node:crypto'
import { promisify } from 'node:util'
const scrypt = promisify(scryptCallback)
export const hashToken = token => createHash('sha256').update(token).digest('hex')
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`
}
export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  return timingSafeEqual(Buffer.from(hash, 'hex'), await scrypt(password, salt, 64))
}
export async function pinDigest(db, pin) {
  await db('settings').insert({ key: 'pin_key', value: randomBytes(32).toString('hex') }).onConflict('key').ignore()
  const { value } = await db('settings').where({ key: 'pin_key' }).first()
  return createHmac('sha256', value).update(pin).digest('hex')
}
export async function createAdmin(db, username, password) {
  if (!username.trim() || password.length < 10) throw new Error('Informe um usuário e uma senha com pelo menos 10 caracteres.')
  await db('admins').insert({ username: username.trim().toLowerCase(), password_hash: await hashPassword(password) })
}
export function rateLimit(db, scope, max, period) {
  return async (req, res, next) => {
    const now = Date.now()
    const key = `${scope}:${req.ip}`
    const allowed = await db.transaction(async trx => {
      if (trx.client.config.client === 'pg') await trx.raw('select pg_advisory_xact_lock(hashtext(?))', [key])
      await trx('attempts').where('expires_at', '<=', now).delete()
      const current = await trx('attempts').where({ key }).first()
      if (current && current.count >= max) return false
      if (current) await trx('attempts').where({ key }).increment('count', 1)
      else await trx('attempts').insert({ key, count: 1, expires_at: now + period })
      return true
    })
    if (!allowed) { res.setHeader('Retry-After', Math.ceil(period / 1000)); return res.status(429).json({ error: 'Muitas tentativas. Aguarde antes de tentar novamente.' }) }
    next()
  }
}
