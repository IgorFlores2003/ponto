import { createApp } from '../server/app.js'
import { createDatabase } from '../server/db.js'

let app
export default function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Banco de dados não configurado no servidor.' })
  }
  // Reutiliza o pool entre requisições. Migrations são executadas separadamente.
  app ||= createApp(createDatabase())
  return app(req, res)
}
