import test from 'node:test'
import assert from 'node:assert/strict'
import { reportFor } from './reports.js'
const people = [{ id: 1, name: 'Igor', job_title: 'Atendente' }]
const entry = (kind, time) => ({ employee_id: 1, kind, occurred_at: `2026-09-19T${time}-03:00` })
const report = (entries, time, date = '2026-09-19') => reportFor(people, entries, date, date, Date.parse(`2026-09-19T${time}-03:00`))[0]

test('serviço e intervalo aberto são separados com precisão de segundos', () => {
  const row = report([entry('Entrada', '08:00:00'), entry('Início do intervalo', '12:00:00')], '12:30:15')
  assert.equal(row.work_seconds, 14400)
  assert.equal(row.break_seconds, 1815)
  assert.equal(row.status, 'Em intervalo')
  assert.equal(row.job_title, 'Atendente')
  assert.equal(Date.parse(row.current_since), Date.parse('2026-09-19T12:00:00-03:00'))
})
test('retorno congela o intervalo e saída congela o serviço', () => {
  const entries = [entry('Entrada', '08:00:00'), entry('Início do intervalo', '12:00:00'), entry('Fim do intervalo', '13:00:00')]
  const open = report(entries, '14:00:10')
  assert.equal(open.work_seconds, 18010)
  assert.equal(open.break_seconds, 3600)
  assert.equal(open.status, 'Em expediente')
  const closed = report([...entries, entry('Saída', '17:00:00')], '18:00:00')
  assert.equal(closed.work_seconds, 28800)
  assert.equal(closed.break_seconds, 3600)
  assert.equal(closed.current_since, null)
})
test('intervalo atravessando meia-noite é recortado no período e sem jornada resulta em zero', () => {
  const row = report([{ employee_id: 1, kind: 'Início do intervalo', occurred_at: '2026-09-18T23:30:00-03:00' }, entry('Fim do intervalo', '00:30:00')], '01:00:00')
  assert.equal(row.break_seconds, 1800)
  assert.equal(row.work_seconds, 1800)
  const empty = report([], '01:00:00')
  assert.equal(empty.work_seconds, 0)
  assert.equal(empty.break_seconds, 0)
  assert.equal(empty.status, 'Fora do expediente')
})
