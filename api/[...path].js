import { createApp } from '../server/app.js'
import { createDatabase } from '../server/db.js'
import { applyCors } from '../server/cors.js'

let app

export default function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') {
    return allowed ? res.status(204).end() : res.status(403).json({ error: 'Origem não permitida.' })
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Banco de dados não configurado no servidor.' })
  }
  app ||= createApp(createDatabase())
  return app(req, res)
}
