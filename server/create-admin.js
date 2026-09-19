import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { createDatabase } from './db.js'
import { createAdmin } from './auth.js'
let hidden = false
const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk); callback() } })
const rl = createInterface({ input: process.stdin, output, terminal: !!process.stdin.isTTY })
const db = createDatabase()
try {
  await db.migrate.latest()
  const username = await rl.question('Usuário do administrador: ')
  process.stdout.write('Senha (mínimo 10 caracteres): '); hidden = true
  const password = await rl.question('')
  hidden = false; process.stdout.write('\n')
  await createAdmin(db, username, password)
  console.log('Administrador criado. Acesse /#/admin para entrar.')
} catch (error) { console.error(['SQLITE_CONSTRAINT_UNIQUE', '23505'].includes(error.code) ? 'Usuário já cadastrado.' : error.message); process.exitCode = 1 }
finally { rl.close(); await db.destroy() }
