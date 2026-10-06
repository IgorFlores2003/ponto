// Durable jobs are inserted in the same transaction as each punch. Leases allow
// another invocation to resume after a function crashes or times out.
export function createPhotoAnalysis(db, photos, analyzer, { enabled = !!process.env.GEMINI_API_KEY, now = Date.now } = {}) {
  async function runOne() {
    if (!enabled) return { processed: false }
    const job = await db.transaction(async trx => {
      const query = trx('photo_analysis_jobs').where('next_attempt_at', '<=', now()).where('lease_until', '<=', now()).orderBy('next_attempt_at').orderBy('entry_id')
      if (trx.client.config.client === 'pg') query.forUpdate().skipLocked()
      const row = await query.first()
      if (!row) return null
      const lease = now() + 90000
      await trx('photo_analysis_jobs').where({ entry_id: row.entry_id }).update({ lease_until: lease, attempts: row.attempts + 1 })
      return { ...row, lease_until: lease, attempts: row.attempts + 1 }
    })
    if (!job) return { processed: false }
    const owned = connection => connection('photo_analysis_jobs').where({ entry_id: job.entry_id, lease_until: job.lease_until })
    try {
      const entry = await db('entries').where({ id: job.entry_id }).first()
      if (!entry || entry.admin_confirmed || entry.divergence_status !== 'pending' || !entry.punch_photo) {
        await owned(db).delete()
        return { processed: true }
      }
      const employee = await db('employees').where({ id: entry.employee_id }).first()
      const analysis = await analyzer({ punchPhoto: await photos.dataUrl(entry.punch_photo), employeePhoto: await photos.dataUrl(employee?.photo) })
      if (!analysis || !['ok', 'no_face', 'divergence'].includes(analysis.divergence_status) || typeof analysis.face_detected !== 'boolean') throw new Error('Analysis unavailable')
      await db.transaction(async trx => {
        if (!await owned(trx).delete()) return
        await trx('entries').where({ id: entry.id, admin_confirmed: false, divergence_status: 'pending' }).update({
          face_detected: analysis.face_detected, divergence_status: analysis.divergence_status,
          divergence_reason: typeof analysis.divergence_reason === 'string' ? analysis.divergence_reason.slice(0, 1000) : null,
        })
      })
      return { processed: true }
    } catch {
      await db.transaction(async trx => {
        if (job.attempts >= 5) {
          if (!await owned(trx).delete()) return
          await trx('entries').where({ id: job.entry_id, admin_confirmed: false, divergence_status: 'pending' }).update({ divergence_status: 'review_required', divergence_reason: 'Análise automática indisponível após novas tentativas. Confira a foto manualmente.' })
        } else {
          await owned(trx).update({ lease_until: 0, next_attempt_at: now() + Math.min(3600000, 60000 * 2 ** (job.attempts - 1)) })
        }
      })
      return { processed: true, retry: job.attempts < 5 }
    }
  }
  return { runOne }
}
