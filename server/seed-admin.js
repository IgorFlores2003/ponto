import { createDatabase } from './db.js'
import { seedAdmin } from './admin-seed.js'

let db
try {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    throw new Error('Configure DATABASE_URL para criar o administrador em produção.')
  }
  if (!process.env.ADMIN_SEED_USERNAME || !process.env.ADMIN_SEED_PASSWORD) {
    throw new Error('Configure ADMIN_SEED_USERNAME e ADMIN_SEED_PASSWORD no .env ou no ambiente.')
  }
  db = createDatabase()
  await db.migrate.latest()
  const created = await seedAdmin(db, {
    username: process.env.ADMIN_SEED_USERNAME,
    password: process.env.ADMIN_SEED_PASSWORD,
  })
  console.log(created
    ? 'Administrador criado. Nenhum funcionário de demonstração foi adicionado.'
    : 'Administrador já existe. A senha existente foi preservada.')
} catch (error) {
  console.error('Falha no seed do administrador:', error.code || error.message)
  process.exitCode = 1
} finally {
  if (db) await db.destroy()
}
