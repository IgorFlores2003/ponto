import { brazilNationalHolidays } from '../shared/brazil-holidays.js'

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
    const workdays = parseWorkdays(employee.workdays)
    const todayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(nowMs))
    const today = `${todayParts.find(part => part.type === 'year').value}-${todayParts.find(part => part.type === 'month').value}-${todayParts.find(part => part.type === 'day').value}`
    const periodEnd = to < today ? to : today
    const expectedMinutes = from > periodEnd ? 0 : expectedScheduleMinutes(employee, from, periodEnd, workdays, safeEvents)
    const dailyMinutes = Math.max(1, Number(employee.work_minutes ?? Math.round((employee.target_hours || 8) * 60)))
    const expectedDays = Math.floor(expectedMinutes / dailyMinutes)
    const history = safeEntries.filter(e => Number(e.employee_id) === Number(employee.id))
    let opened = null, paused = null, total = 0, breaks = 0
    let breakName = null
    const totals = new Map()
    const addBreak = milliseconds => { breaks += milliseconds; const name = breakName || 'Intervalo'; totals.set(name, (totals.get(name) || 0) + milliseconds) }
    const overlap = (a, b) => Math.max(0, Math.min(b, end, nowMs) - Math.max(a, start))
    for (const entry of history) {
      const at = Date.parse(entry.occurred_at)
      if (at > nowMs) continue
      if (entry.kind === 'Entrada' || entry.kind === 'Entrada do almoço' || entry.kind === 'Fim do intervalo') {
        if (paused !== null) addBreak(overlap(paused, at))
        paused = null; breakName = null; opened = at
      } else {
        if (opened !== null) total += overlap(opened, at)
        opened = null
        if (entry.kind === 'Início do intervalo' || entry.kind === 'Saída do almoço') { paused = at; breakName = entry.break_name || (entry.kind === 'Saída do almoço' ? 'Almoço' : 'Café') }
        else if (paused !== null) { addBreak(overlap(paused, at)); paused = null }
      }
    }
    if (opened !== null) total += overlap(opened, nowMs)
    if (paused !== null) addBreak(overlap(paused, nowMs))
    const expected_seconds = expectedMinutes * 60
    const workSeconds = Math.floor(total / 1000)
    const breakSeconds = Math.floor(breaks / 1000)
    const expected_break_seconds = expectedMinutes ? Math.max(0, Number(employee.break_minutes ?? 60)) * 60 * Math.round(expectedMinutes / Math.max(1, Number(employee.work_minutes ?? 480))) : 0
    const debt_seconds = Math.max(0, expected_seconds - workSeconds)
    const extra_break_seconds = Math.max(0, breakSeconds - expected_break_seconds)
    return { ...employee, expected_days: expectedDays, expected_seconds, expected_break_seconds, debt_seconds, extra_break_seconds, minutes: Math.floor(total / 60000), work_seconds: workSeconds, break_seconds: breakSeconds,
      current_break_name: paused !== null ? breakName : null, break_totals: [...totals].map(([name, ms]) => ({ name, seconds: Math.floor(ms / 1000) })),
      current_since: opened !== null ? new Date(opened).toISOString() : paused !== null ? new Date(paused).toISOString() : null,
      punches: history.filter(e => Date.parse(e.occurred_at) >= start && Date.parse(e.occurred_at) < end && Date.parse(e.occurred_at) <= now).length,
      status: paused !== null ? 'Em intervalo' : opened !== null ? 'Em expediente' : 'Fora do expediente' }

  })
}

function parseWorkdays(value) {
  try { const days = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(days) && days.length && days.every(day => Number.isInteger(day) && day >= 0 && day <= 6) ? [...new Set(days)] : [1, 2, 3, 4, 5] } catch { return [1, 2, 3, 4, 5] }
}

function expectedScheduleMinutes(employee, from, to, workdays, events) {
  const daily = Math.max(0, Number(employee.work_minutes ?? Math.round((employee.target_hours || 8) * 60)))
  let total = 0
  for (let cursor = Date.parse(`${from}T12:00:00Z`), end = Date.parse(`${to}T12:00:00Z`); cursor <= end; cursor += 86400000) {
    const date = new Date(cursor).toISOString().slice(0, 10)
    const scheduled = workdays.includes(new Date(cursor).getUTCDay())
    const dayEvents = events.filter(event => String(event.event_date).slice(0, 10) === date && (event.employee_id == null || Number(event.employee_id) === Number(employee.id)))
    const nationalHoliday = brazilNationalHolidays(new Date(cursor).getUTCFullYear()).has(date)
    const excused = dayEvents.some(event => ['Feriado', 'Folga', 'Emenda'].includes(event.kind))
    const extra = dayEvents.some(event => event.kind === 'Trabalho extra')
    if ((excused || nationalHoliday) && !extra) continue
    if (scheduled || extra) total += daily
  }
  return total
}
