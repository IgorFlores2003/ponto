import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createDatabase } from './db.js'
import { supabaseConfig } from './supabase.js'
import { createPhotoStorage } from './photo-storage.js'

export async function migratePhotos(db, photos, { apply = false, onProgress = () => {} } = {}) {
  const totals = { found: 0, migrated: 0, changed: 0 }
  for (const [table, field] of [['employees', 'photo'], ['entries', 'punch_photo']]) {
    let lastId = 0
    while (true) {
      const rows = await db(table).select('id', field).where('id', '>', lastId).where(field, 'like', 'data:image/%').orderBy('id').limit(50)
      if (!rows.length) break
      for (const row of rows) {
        lastId = row.id
        totals.found++
        if (!apply) continue
        let stored, committed = false
        try {
          stored = await photos.put(row[field], `${table}/${row.id}`)
          // Verify the complete original bytes before replacing the inline copy.
          const downloaded = await photos.dataUrl(stored)
          const digest = value => createHash('sha256').update(Buffer.from(value.split(',')[1], 'base64')).digest('hex')
          if (digest(downloaded) !== digest(row[field])) throw new Error('A verificação da foto falhou; o original foi preservado.')
          const updated = await db(table).where({ id: row.id, [field]: row[field] }).update({ [field]: stored })
          committed = updated > 0
          if (committed) totals.migrated++; else { totals.changed++; await photos.discard(stored) }
        } catch (error) { if (!committed) await photos.discard(stored); throw error }
        onProgress({ ...totals })
      }
    }
  }
  return totals
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes('--apply')
  const db = createDatabase()
  try {
    const config = apply ? supabaseConfig({ ...process.env, PHOTO_STORAGE: 'supabase', TERMINAL_AUTH_PROVIDER: 'local' }) : null
    const totals = await migratePhotos(db, config ? createPhotoStorage(config) : null, { apply })
    console.log(apply ? `Fotos migradas: ${totals.migrated}. Alteradas por outra operação: ${totals.changed}.` : `Simulação: ${totals.found} fotos ainda estão no banco. Nenhum dado foi alterado. Use --apply após conferir o backup e configurar o Storage.`)
  } catch (error) { console.error(error.message); process.exitCode = 1 }
  finally { await db.destroy() }
}
