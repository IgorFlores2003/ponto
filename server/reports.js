import { scheduleForDate } from '../shared/schedule.js'

export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
}
export function reportFor(employees, entries, from, to, now = Date.now(), events = []) {
  if (!validDate(from) || !validDate(to) || from > to) return []
  const nowMs = Number.isFinite(now) ? now : Date.now()
  const start = Date.parse(`${from}T00:00:00-03:00`)
  const end = Date.parse(`${to}T00:00:00-03:00`) + 86400000
  const safeEntries = (Array.isArray(entries) ? entries : []).filter(entry => entry && Number.isFinite(Date.parse(entry.occurred_at)))
    .slice().sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || Number(a.id || 0) - Number(b.id || 0))
  const safeEvents = Array.isArray(events) ? events.filter(event => event && validDate(String(event.event_date).slice(0, 10))) : []
  return (Array.isArray(employees) ? employees : []).map(employee => {
    const todayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(nowMs))
    const today = `${todayParts.find(part => part.type === 'year').value}-${todayParts.find(part => part.type === 'month').value}-${todayParts.find(part => part.type === 'day').value}`
    const periodEnd = to < today ? to : today
    const expected = expectedSchedule(employee, from, periodEnd, safeEvents)
    const expectedMinutes = expected.workMinutes
    const expectedDays = expected.days
    const history = safeEntries.filter(e => Number(e.employee_id) === Number(employee.id))
    let opened = null, paused = null, total = 0, breaks = 0, offWork = 0
    let breakName = null
    const totals = new Map()
    const workedByDate = new Map()
    const addBreak = milliseconds => { breaks += milliseconds; const name = breakName || 'Intervalo'; totals.set(name, (totals.get(name) || 0) + milliseconds) }
    const overlap = (a, b) => Math.max(0, Math.min(b, end, nowMs) - Math.max(a, start))
    const addWork = (a, b) => {
      const stop = Math.min(b, end, nowMs)
      for (let cursor = Math.max(a, start); cursor < stop;) {
        const date = new Date(cursor - 3 * 3600000).toISOString().slice(0, 10)
        const next = Math.min(stop, Date.parse(`${date}T00:00:00-03:00`) + 86400000)
        const duration = next - cursor
        total += duration
        workedByDate.set(date, (workedByDate.get(date) || 0) + duration)
        if (scheduleForDate(employee, date, safeEvents).offDay) offWork += duration
        cursor = next
      }
    }
    for (const entry of history) {
      const at = Date.parse(entry.occurred_at)
      if (at > nowMs) continue
      if (entry.kind === 'Entrada' || entry.kind === 'Entrada do almoço' || entry.kind === 'Fim do intervalo') {
        if (paused !== null) addBreak(overlap(paused, at))
        paused = null; breakName = null; opened = at
      } else {
        if (opened !== null) addWork(opened, at)
        opened = null
        if (entry.kind === 'Início do intervalo' || entry.kind === 'Saída do almoço') { paused = at; breakName = entry.break_name || (entry.kind === 'Saída do almoço' ? 'Almoço' : 'Café') }
        else if (paused !== null) { addBreak(overlap(paused, at)); paused = null }
      }
    }
    if (opened !== null) addWork(opened, nowMs)
    if (paused !== null) addBreak(overlap(paused, nowMs))
    const expected_seconds = expectedMinutes * 60
    const workSeconds = Math.floor(total / 1000)
    const breakSeconds = Math.floor(breaks / 1000)
    const expected_break_seconds = expected.breakMinutes * 60
    const off_day_work_seconds = Math.floor(offWork / 1000)
    // A punch on a covered date uses part of that day's credit, never both.
    const excused_seconds = Math.floor([...expected.excusedByDate].reduce((sum, [date, minutes]) =>
      sum + Math.max(0, minutes * 60000 - (workedByDate.get(date) || 0)), 0) / 1000)
    const fulfilled_seconds = workSeconds + excused_seconds
    const current_excused_seconds = Math.floor(Math.max(0, (expected.excusedByDate.get(today) || 0) * 60000 - (workedByDate.get(today) || 0)) / 1000)
    const current_off_day = scheduleForDate(employee, today, safeEvents).offDay
    const debt_seconds = Math.max(0, expected_seconds - (fulfilled_seconds - off_day_work_seconds))
    const overtime_pay_cents = employee.overtime_rate_cents == null ? null
      : Math.round(off_day_work_seconds * employee.overtime_rate_cents / 3600)
    const regular_work_seconds = Math.max(0, workSeconds - off_day_work_seconds)
    const regular_pay_cents = employee.hourly_rate_cents == null ? null
      : Math.round(regular_work_seconds * employee.hourly_rate_cents / 3600)
    const total_pay_cents = (regular_work_seconds > 0 && regular_pay_cents == null) || (off_day_work_seconds > 0 && overtime_pay_cents == null)
      ? null : (regular_pay_cents ?? 0) + (overtime_pay_cents ?? 0)
    const extra_break_seconds = Math.max(0, breakSeconds - expected_break_seconds)
    return { ...employee, regular_work_seconds, regular_pay_cents, total_pay_cents, expected_days: expectedDays, overtime_pay_cents, off_day_work_seconds, excused_seconds, fulfilled_seconds, current_excused_seconds, current_off_day, expected_seconds, expected_break_seconds, debt_seconds, extra_break_seconds, minutes: Math.floor(total / 60000), work_seconds: workSeconds, break_seconds: breakSeconds,
      current_break_name: paused !== null ? breakName : null, break_totals: [...totals].map(([name, ms]) => ({ name, seconds: Math.floor(ms / 1000) })),
      current_since: opened !== null ? new Date(opened).toISOString() : paused !== null ? new Date(paused).toISOString() : null,
      punches: history.filter(e => Date.parse(e.occurred_at) >= start && Date.parse(e.occurred_at) < end && Date.parse(e.occurred_at) <= now).length,
      status: paused !== null ? 'Em intervalo' : opened !== null ? 'Em expediente' : 'Fora do expediente' }

  })
}

function expectedSchedule(employee, from, to, events) {
  const total = { workMinutes: 0, breakMinutes: 0, excusedByDate: new Map(), days: 0 }
  for (let cursor = Date.parse(`${from}T12:00:00Z`), end = Date.parse(`${to}T12:00:00Z`); cursor <= end; cursor += 86400000) {
    const date = new Date(cursor).toISOString().slice(0, 10)
    const plan = scheduleForDate(employee, date, events)
    total.workMinutes += plan.expectedMinutes
    if (plan.excusedMinutes > 0) total.excusedByDate.set(date, plan.excusedMinutes)
    total.breakMinutes += plan.breakMinutes
    if (plan.expectedMinutes > 0) total.days++
  }
  return total
}
