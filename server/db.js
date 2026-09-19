import './env.js'
import knex from 'knex'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
export function createDatabase(filename) {
  const shared = {
    migrations: { directory: resolve(root, 'server/migrations') },
    seeds: { directory: resolve(root, 'server/seeds') },
  }
  // Explicit filenames isolate tests from the configured remote database.
  if (filename === undefined && process.env.DATABASE_URL) {
    return knex({ ...shared, client: 'pg',
      connection: { connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_CA_PATH ? { ca: readFileSync(resolve(root, process.env.DATABASE_CA_PATH), 'utf8') } : {}) },
        connectionTimeoutMillis: 15000,
      }, pool: { min: 0, max: 5 }, acquireConnectionTimeout: 20000,
    })
  }
  filename ||= process.env.DATABASE_PATH || resolve(root, 'data/ponto.sqlite')
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true })
  return knex({ client: 'better-sqlite3', connection: { filename }, useNullAsDefault: true,
    pool: { min: 1, max: 1, afterCreate(connection, done) { connection.pragma('foreign_keys = ON'); connection.pragma('journal_mode = WAL'); done(null, connection) } },
    migrations: { directory: resolve(root, 'server/migrations') },
    seeds: { directory: resolve(root, 'server/seeds') } })
}
