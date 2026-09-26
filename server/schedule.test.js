import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduleForDate, monthlyScheduleMinutes } from '../shared/schedule.js'
import { planScheduleEvents } from './schedule-events.js'
import { reportFor } from './reports.js'
import { createDatabase } from './db.js'
import { createApp } from './app.js'
import { createAdmin } from './auth.js'

const person = { id: 1, workdays: '[0,1,2,3,5,6]', work_minutes: 480, break_minutes: 60 }
const event = (id, kind, employee_id = 1, event_date = '2026-09-07') => ({ id, kind, employee_id, event_date })

test('folga semanal e fins de semana usam os dias individuais', () => {
  assert.equal(scheduleForDate(person, '2026-09-24').workMinutes, 0)
  assert.equal(scheduleForDate(person, '2026-09-22').workMinutes, 480)
  const weekdays = { ...person, workdays: '[1,2,3,4,5]' }
  assert.equal(scheduleForDate(weekdays, '2026-09-26').workMinutes, 0)
  assert.equal(scheduleForDate(weekdays, '2026-09-27').workMinutes, 0)
})

test('domingos alternados e folgas semanais são gerados só até o fim do mês', () => {
  const fortnight = planScheduleEvents({ event_date: '2026-09-06', kind: 'Folga', title: 'Domingo alternado', employee_id: 1, repeat: 'fortnightly' })
  assert.deepEqual(fortnight.map(e => e.event_date), ['2026-09-06', '2026-09-20'])
  assert.equal(scheduleForDate(person, '2026-09-06', fortnight).workMinutes, 0)
  assert.equal(scheduleForDate(person, '2026-09-13', fortnight).workMinutes, 480)
  assert.equal(scheduleForDate(person, '2026-09-20', fortnight).workMinutes, 0)
  assert.equal(scheduleForDate(person, '2026-09-27', fortnight).workMinutes, 480)
  const weekly = planScheduleEvents({ event_date: '2026-12-03', kind: 'Folga', title: 'Quintas', repeat: 'weekly' })
  assert.deepEqual(weekly.map(e => e.event_date), ['2026-12-03', '2026-12-10', '2026-12-17', '2026-12-24', '2026-12-31'])
})

test('trabalho individual vence feriado; folga individual vence trabalho da equipe', () => {
  assert.equal(scheduleForDate(person, '2026-09-07').workMinutes, 0)
  const work = event(1, 'Trabalho')
  const holiday = event(2, 'Feriado', null)
  assert.equal(scheduleForDate(person, '2026-09-07', [work, holiday]).workMinutes, 480)
  assert.equal(scheduleForDate({ ...person, id: 2 }, '2026-09-07', [work, holiday]).workMinutes, 0)
  assert.equal(scheduleForDate(person, '2026-09-07', [event(1, 'Folga'), event(2, 'Trabalho', null)]).workMinutes, 0)
  assert.equal(scheduleForDate(person, '2026-09-07', [event(3, 'Folga'), work]).workMinutes, 0)
  assert.equal(scheduleForDate(person, '2026-09-07', [event(3, 'Folga'), event(4, 'Trabalho')]).workMinutes, 480)
})

test('sábado das 7 às 11 conta quatro horas e nenhum intervalo no relatório', () => {
  const events = planScheduleEvents({ event_date: '2026-09-05', kind: 'Trabalho', title: 'Sábado Tati', employee_id: 1, repeat: 'weekly', starts_at: '07:00', ends_at: '11:00', break_time: '00:00' })
  const plan = scheduleForDate(person, '2026-09-26', events)
  assert.equal(plan.workMinutes, 240)
  assert.equal(plan.startsAt, '07:00')
  const row = reportFor([person], [], '2026-09-26', '2026-09-26', Date.parse('2026-09-27T12:00:00Z'), events)[0]
  assert.equal(row.expected_seconds, 4 * 3600)
  assert.equal(row.expected_days, 1)
  assert.equal(row.expected_break_seconds, 0)
  assert.equal(row.debt_seconds, 4 * 3600)
  const off = reportFor([person], [], '2026-09-26', '2026-09-26', Date.parse('2026-09-27T12:00:00Z'), [event(1, 'Folga', 1, '2026-09-26')])[0]
  assert.equal(off.debt_seconds, 0)
})

test('horário desconta intervalo e aceita saída no dia seguinte', () => {
  const [shift] = planScheduleEvents({ event_date: '2026-09-26', kind: 'Trabalho', title: 'Noite', starts_at: '22:00', ends_at: '06:00', break_time: '01:00' })
  assert.equal(shift.work_minutes, 420)
  assert.equal(shift.break_minutes, 60)
})

test('rejeita datas, pessoas, repetição e horários inválidos', () => {
  const base = { event_date: '2026-09-26', kind: 'Trabalho', title: 'Escala' }
  for (const change of [{ event_date: '2026-02-30' }, { employee_id: 0 }, { repeat: 'daily' }, { starts_at: '25:00', ends_at: '26:00' }, { starts_at: '07:00' }, { starts_at: '07:00', ends_at: '07:00' }, { starts_at: '07:00', ends_at: '11:00', break_time: '04:00' }, { kind: 'Folga', starts_at: '07:00', ends_at: '11:00' }]) {
    assert.throws(() => planScheduleEvents({ ...base, ...change }))
  }
})

test('total mensal automático inclui mês inteiro, finais de semana, folgas e ano bissexto', () => {
  const employee = { ...person, workdays: '[1,2,3,4,5]' }
  assert.equal(monthlyScheduleMinutes(employee, '2026-09'), 21 * 480)
  const saturday = { ...event(1, 'Trabalho', 1, '2026-09-26'), work_minutes: 240, break_minutes: 0 }
  const sunday = event(2, 'Trabalho', 1, '2026-09-27')
  const off = event(3, 'Folga', 1, '2026-09-29')
  assert.equal(monthlyScheduleMinutes(employee, '2026-09', [saturday, sunday, off]), 21 * 480 + 240)
  assert.equal(monthlyScheduleMinutes({ ...employee, workdays: '[0,1,2,3,4,5,6]', work_minutes: 60 }, '2028-02'), 29 * 60)
  assert.equal(monthlyScheduleMinutes({ ...employee, workdays: '[]' }, '2026-09'), 0)
})

test('valor mensal antigo de 176h não interfere nas jornadas de 7h20', () => {
  const sixDays = { ...person, workdays: '[1,2,3,4,5,6]', work_minutes: 440, monthly_minutes: 10560 }
  const fiveDays = { ...sixDays, workdays: '[1,2,3,4,5]' }
  assert.equal(monthlyScheduleMinutes(sixDays, '2026-09'), 11000) // 183h20, com folga no feriado.
  assert.equal(monthlyScheduleMinutes(fiveDays, '2026-09'), 9240) // 154h.
  assert.equal(monthlyScheduleMinutes(sixDays, '2026-09', [event(1, 'Trabalho')]), 11440) // 190h40, trabalhando no feriado.
})

test('API salva repetição, retorna horários, calcula relatório e remove só a data escolhida', async () => {
  const db = createDatabase(':memory:')
  let server
  try {
    await db.migrate.latest()
    await createAdmin(db, 'admin', 'senha-segura-123')
    server = createApp(db).listen(0, '127.0.0.1')
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
    const base = `http://127.0.0.1:${server.address().port}/api`
    let token
    async function request(path, body) {
      const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      return { status: response.status, data: response.status === 204 ? null : await response.json() }
    }
    assert.equal((await request('/schedule-events', {})).status, 401)
    token = (await request('/auth/login', { username: 'admin', password: 'senha-segura-123' })).data.token
    const employee = (await request('/employees', { name: 'Tati', pin: '1234' })).data
    const body = { event_date: '2026-09-05', employee_id: employee.id, kind: 'Trabalho', title: 'Sábados', starts_at: '07:00', ends_at: '11:00', break_time: '00:00', repeat: 'weekly' }
    const created = await request('/schedule-events', body)
    assert.equal(created.status, 201)
    assert.equal(created.data.length, 4)
    assert.equal(created.data[0].work_minutes, 240)
    assert.equal(created.data[0].employee_name, 'Tati')
    const listed = await request('/schedule-events?from=2026-09-01&to=2026-09-30')
    assert.equal(listed.data.length, 4)
    assert.equal(listed.data[0].starts_at, '07:00')
    const report = await request('/reports?from=2026-09-05&to=2026-09-05')
    assert.equal(report.data.rows[0].expected_seconds, 14400)
    assert.equal(report.data.rows[0].expected_break_seconds, 0)
    assert.equal((await request('/schedule-events', { ...body, employee_id: 99999 })).status, 404)
    assert.equal((await request('/schedule-events', { ...body, ends_at: 'bad' })).status, 400)
    assert.equal((await request('/schedule-events?to=bad')).status, 400)
    assert.equal((await request(`/schedule-events/${created.data[0].id}/delete`, {})).status, 204)
    assert.equal((await request('/schedule-events?from=2026-09-01&to=2026-09-30')).data.length, 3)
    const single = await request('/schedule-events', { event_date: '2026-09-12', employee_id: employee.id, kind: 'Folga', title: 'Troca de escala' })
    assert.equal(single.status, 201)
    assert.ok(single.data.id)
    assert.equal((await request('/reports?from=2026-09-12&to=2026-09-12')).data.rows[0].expected_seconds, 0)
    const other = (await request('/employees', { name: 'Domingo', pin: '5678', workdays: [] })).data
    assert.equal((await request(`/employees/${other.id}/schedule`, { work_time: '06:00', break_time: '00:30', workdays: [] })).status, 204)
    const baseline = (await request('/employees?month=2026-09')).data
    assert.equal(baseline.find(e => e.id === other.id).monthly_minutes, 0)
    assert.equal(baseline.find(e => e.id === employee.id).monthly_month, '2026-09')
    assert.equal((await request('/employees?month=2026-99')).status, 400)
    const roster = { event_date: '2026-09-19', assignments: [{ employee_id: employee.id, working: true }, { employee_id: other.id, working: true }] }
    assert.equal((await request('/schedule-day', { ...roster, assignments: [] })).status, 409)
    assert.equal((await request('/schedule-day', { ...roster, assignments: [roster.assignments[0], roster.assignments[0]] })).status, 400)
    const saved = await request('/schedule-day', roster)
    assert.equal(saved.status, 201)
    assert.equal(saved.data.length, 1) // Tati's existing 07:00–11:00 shift is preserved.
    assert.equal(saved.data[0].employee_id, other.id)
    const monthly = (await request('/employees?month=2026-09')).data
    assert.equal(monthly.find(e => e.id === employee.id).monthly_minutes, baseline.find(e => e.id === employee.id).monthly_minutes)
    assert.equal(monthly.find(e => e.id === other.id).monthly_minutes, 360)
    assert.equal((await request('/schedule-day', roster)).data.length, 0)
    assert.equal((await request('/schedule-day', { ...roster, event_date: '2026-09-20', assignments: [{ employee_id: employee.id, working: false }, { employee_id: other.id, working: true }] })).status, 201)
    assert.equal((await request('/employees?month=2026-09')).data.find(e => e.id === other.id).monthly_minutes, 720)
    assert.equal((await request('/schedule-day', { ...roster, assignments: roster.assignments.map(item => ({ ...item, working: false })) })).status, 201)
    assert.equal((await request('/employees?month=2026-09')).data.find(e => e.id === other.id).monthly_minutes, 360)

  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    await db.destroy()
  }
})
