import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDatabase } from './db.js'
import { captureBackup, encryptBackup } from './backup-data.js'
const db = createDatabase()
try {
  const snapshot = await captureBackup(db)
  const encrypted = encryptBackup(snapshot, process.env.AUTH_SESSION_ENCRYPTION_KEY)
  const directory = resolve('release-private/backups')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const file = resolve(directory, `ponto-${Date.now()}.json.enc`)
  writeFileSync(file, encrypted, { mode: 0o600, flag: 'wx' })
  console.log(`Backup criptografado salvo: ${file}. Preserve separadamente a chave AUTH_SESSION_ENCRYPTION_KEY.`)
} catch (error) { console.error('Falha no backup:', error.code || error.message); process.exitCode = 1 }
finally { await db.destroy() }
