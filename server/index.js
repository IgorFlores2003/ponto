import express from 'express'
import compression from 'compression'
import { fileURLToPath } from 'node:url'
import { createDatabase } from './db.js'
import { createApp } from './app.js'
import { supabaseConfig } from './supabase.js'
const config = supabaseConfig()
const db = createDatabase()
await db.migrate.latest()
const app = createApp(db, { config })

// Gzip compression for all responses
app.use(compression())

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
// Static assets (JS/CSS/images) with 1-year immutable cache
app.use(express.static(dist, {
  maxAge: '1y',
  immutable: true,
  index: false,
  setHeaders(res, filePath) {
    // HTML must never be cached to pick up new asset hashes
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store')
    }
  },
}))
app.get('/', (req, res) => res.sendFile(`${dist}/index.html`))
const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => console.log('API Ponto Digital disponível na porta ' + (process.env.PORT || 3001)))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await db.destroy(); process.exit(0) }))
