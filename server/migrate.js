import { createDatabase } from './db.js'
const db = createDatabase()
try { await db.migrate.latest(); console.log('Migrations aplicadas com sucesso.') }
catch (error) { console.error('Falha nas migrations:', error.code || error.name); process.exitCode = 1 }
finally { await db.destroy() }
