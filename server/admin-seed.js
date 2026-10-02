import { hashPassword } from './auth.js'

export async function seedAdmin(db, { username, password }) {
  if (typeof username !== 'string' || !username.trim() || username.trim().length > 254) {
    throw new Error('Configure ADMIN_SEED_USERNAME com um usuário de até 254 caracteres.')
  }
  if (typeof password !== 'string' || password.length < 10 || password.length > 1024) {
    throw new Error('Configure ADMIN_SEED_PASSWORD com uma senha de 10 a 1024 caracteres.')
  }
  const normalizedUsername = username.trim().toLowerCase()
  if (await db('admins').where({ username: normalizedUsername }).first()) return false
  const inserted = await db('admins').insert({
    username: normalizedUsername,
    password_hash: await hashPassword(password),
  }).onConflict('username').ignore().returning('id')
  return inserted.length > 0
}
