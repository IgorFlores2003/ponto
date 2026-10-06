import test from 'node:test'
import assert from 'node:assert/strict'
import { reportFor } from '../server/reports.js'

const employee = { id: 1, workdays: [1, 2, 3, 4, 5], work_minutes: 480, break_minutes: 60, hourly_rate_cents: 1500, overtime_rate_cents: 2500 }
const entries = [
  { employee_id: 1, kind: 'Entrada', occurred_at: '2026-10-05T08:00:00-03:00' },
  { employee_id: 1, kind: 'Saída do almoço', occurred_at: '2026-10-05T12:00:00-03:00' },
  { employee_id: 1, kind: 'Entrada do almoço', occurred_at: '2026-10-05T13:00:00-03:00' },
  { employee_id: 1, kind: 'Saída', occurred_at: '2026-10-05T17:00:00-03:00' },
  { employee_id: 1, kind: 'Entrada', occurred_at: '2026-10-10T08:00:00-03:00' },
  { employee_id: 1, kind: 'Saída', occurred_at: '2026-10-10T10:00:00-03:00' },
]
const report = (overrides = {}, punches = entries) => reportFor([{ ...employee, ...overrides }], punches, '2026-10-01', '2026-10-31', Date.parse('2026-11-01T00:00:00-03:00'))[0]
test('monthly pay separates normal and extra rates without counting breaks or overtime twice', () => {
  const row = report()
  assert.equal(row.regular_work_seconds, 8 * 3600)
  assert.equal(row.off_day_work_seconds, 2 * 3600)
  assert.equal(row.regular_pay_cents, 12000)
  assert.equal(row.overtime_pay_cents, 5000)
  assert.equal(row.total_pay_cents, 17000)
})
test('missing applicable rates leave payment incomplete', () => {
  assert.equal(report({ hourly_rate_cents: null }).total_pay_cents, null)
  assert.equal(report({ overtime_rate_cents: null }).total_pay_cents, null)
  assert.equal(report({ overtime_rate_cents: null }, entries.slice(0, 4)).total_pay_cents, 12000)
})
