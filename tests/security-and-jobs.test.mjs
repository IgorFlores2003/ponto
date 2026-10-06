import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase } from '../server/db.js'
import { createPhotoAnalysis } from '../server/photo-analysis.js'
import { clientIp } from '../server/security.js'
import { photo } from './fixtures.mjs'

test('proxy IP is trusted only on the Vercel runtime', () => {
  const req = { headers: { 'x-forwarded-for': '203.0.113.7' }, ip: '127.0.0.1' }
  assert.equal(clientIp(req, {}), '127.0.0.1')
  assert.equal(clientIp(req, { VERCEL: '1' }), '203.0.113.7')
  req.headers['x-forwarded-for'] = 'malformed'
  assert.equal(clientIp(req, { VERCEL: '1' }), '127.0.0.1')
})

test('photo analysis retries durably, recovers expired leases and preserves manual decisions', async () => {
  const db = createDatabase(':memory:')
  let now = Date.now()
  try {
    await db.migrate.latest()
    const [{ id: employee_id }] = await db('employees').insert({ name: 'Queue test', registration: 'QUEUE', department: 'Test', created_at: new Date().toISOString() }).returning('id')
    async function enqueue() {
      const [{ id }] = await db('entries').insert({ employee_id, kind: 'Entrada', occurred_at: new Date().toISOString(), punch_photo: photo, divergence_status: 'pending', admin_confirmed: false }).returning('id')
      await db('photo_analysis_jobs').insert({ entry_id: id })
      return id
    }
    const photos = { dataUrl: async value => value }
    let calls = 0
    const worker = createPhotoAnalysis(db, photos, async () => { calls++; return { face_detected: true, divergence_status: 'ok' } }, { enabled: true, now: () => now })
    const first = await enqueue()
    await db('photo_analysis_jobs').where({ entry_id: first }).update({ lease_until: now + 90000 })
    assert.equal((await worker.runOne()).processed, false)
    now += 90001
    assert.equal((await worker.runOne()).processed, true)
    assert.equal((await db('entries').where({ id: first }).first()).divergence_status, 'ok')
    assert.equal(calls, 1)
    const failure = await enqueue()
    const failing = createPhotoAnalysis(db, photos, async () => null, { enabled: true, now: () => now })
    for (let i = 0; i < 5; i++) { await failing.runOne(); now += 3600001 }
    assert.equal((await db('entries').where({ id: failure }).first()).divergence_status, 'review_required')
    assert.equal(await db('photo_analysis_jobs').where({ entry_id: failure }).first(), undefined)
    const manual = await enqueue()
    const concurrentReview = createPhotoAnalysis(db, photos, async () => {
      await db('entries').where({ id: manual }).update({ admin_confirmed: true, divergence_status: 'rejected' })
      return { face_detected: true, divergence_status: 'ok' }
    }, { enabled: true, now: () => now })
    await concurrentReview.runOne()
    assert.equal((await db('entries').where({ id: manual }).first()).divergence_status, 'rejected')
    const concurrent = await enqueue()
    const before = calls
    await Promise.all([worker.runOne(), worker.runOne(), worker.runOne()])
    assert.equal(calls, before + 1)
    assert.equal((await db('entries').where({ id: concurrent }).first()).divergence_status, 'ok')
  } finally { await db.destroy() }
})
