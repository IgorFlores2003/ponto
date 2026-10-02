import { isStoredPhoto } from './photo-storage.js'

export function photoCutoff(now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error('Data inválida.')
  const cutoff = new Date(now)
  const day = cutoff.getUTCDate()
  cutoff.setUTCDate(1)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 2)
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate()
  cutoff.setUTCDate(Math.min(day, lastDay))
  return cutoff.toISOString()
}

export async function prunePhotos(db, photos, { now = new Date(), apply = false, limit = 200, timeBudgetMs = 40000 } = {}) {
  const cutoff = photoCutoff(now)
  const started = Date.now()
  const totals = { cutoff, found: 0, cleared: 0, deleted: 0, failed: 0, pending: 0 }
  for (const [table, field, dateField] of [['entries', 'punch_photo', 'occurred_at'], ['employees', 'photo', 'photo_updated_at']]) {
    const query = () => db(table).whereNotNull(field).where(dateField, '<', cutoff)
    totals.found += Number((await query().count('* as count').first()).count)
    if (!apply) continue
    const rows = await query().select('id', field, dateField).orderBy('id').limit(limit)
    for (const row of rows) {
      // Reserve time for physical deletions so a steady upload rate cannot
      // indefinitely postpone processing the persisted Storage queue.
      if (Date.now() - started >= timeBudgetMs / 2) break
      await db.transaction(async trx => {
        const updated = await trx(table).where({ id: row.id, [field]: row[field], [dateField]: row[dateField] }).update({ [field]: null, ...(table === 'employees' ? { photo_updated_at: null } : {}) })
        if (!updated) return
        if (isStoredPhoto(row[field])) await trx('photo_deletion_jobs').insert({ reference: row[field], created_at: now.toISOString() }).onConflict('reference').ignore()
        totals.cleared++
      })
    }
  }
  if (apply) {
    const jobs = await db('photo_deletion_jobs').orderBy('id').limit(limit)
    for (const job of jobs) {
      if (Date.now() - started >= timeBudgetMs) break
      try {
        // Preserve references that are still used by another row.
        const inUse = await db('employees').where({ photo: job.reference }).first() || await db('entries').where({ punch_photo: job.reference }).first()
        if (inUse) continue
        await photos.remove(job.reference)
        await db('photo_deletion_jobs').where({ id: job.id }).delete()
        totals.deleted++
      } catch { totals.failed++ }
    }
  }
  totals.pending = Number((await db('photo_deletion_jobs').count('* as count').first()).count)
  return totals
}
