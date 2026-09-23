import { createApp } from '../server/app.js'
import { createDatabase } from '../server/db.js'
import { applyCors } from '../server/cors.js'

let app

export default function handler(req, res) {
  const allowed = applyCors(req, res)
  if (req.method === 'OPTIONS') {
    return allowed ? res.status(204).end() : res.status(403).json({ error: 'Origem não permitida.' })
  }

  // The Vercel rewrite sends every /api/* request to this function. Restore
  // the captured path so Express receives the route the client requested.
  const incoming = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`)
  const capturedPath = incoming.searchParams.get('__api_path')
  if (capturedPath) {
    incoming.searchParams.delete('__api_path')
    const apiPath = capturedPath.replace(/^\/+/, '')
    req.url = `/api/${apiPath}${incoming.search}`
  }

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Banco de dados não configurado no servidor.' })
  }
  app ||= createApp(createDatabase())
  return app(req, res)
}
