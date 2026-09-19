import { createDatabase } from './db.js'

if (process.env.NODE_ENV === 'production') {
  console.error('Seeds de demonstração não podem ser executados em produção.')
  process.exitCode = 1
} else {
  const db = createDatabase()
  try {
    await db.migrate.latest()
    await db.seed.run()
    console.log('Seeds aplicados. Cadastros e senhas existentes foram preservados.')
    console.log('Novos cadastros de demonstração: admin / Admin@12345; Igor / PIN 1234; Yasmim / PIN 2344.')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
  finally { await db.destroy() }
}
