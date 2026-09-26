import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import { fileURLToPath } from 'node:url'
import { createDatabase } from './db.js'
import { createApp } from './app.js'
const db = createDatabase()
await db.migrate.latest()
const app = createApp(db)

// Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Capacitor WebView needs this off
}))

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
