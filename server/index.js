import express from 'express'
import { fileURLToPath } from 'node:url'
import { createDatabase } from './db.js'
import { createApp } from './app.js'
const db = createDatabase()
await db.migrate.latest()
const app = createApp(db)
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
app.use(express.static(dist))
app.get('/', (req, res) => res.sendFile(`${dist}/index.html`))
const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => console.log('API Ponto Digital disponível na porta ' + (process.env.PORT || 3001)))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await db.destroy(); process.exit(0) }))
