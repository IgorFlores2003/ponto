import { brazilNationalHolidays } from './brazil-holidays.js'

// Individual exceptions override team events. Within either scope, the latest
// saved exception wins, so a correction can be removed to restore the prior plan.
export function scheduleForDate(employee, date, events = []) {
  let days
  try { days = typeof employee.workdays === 'string' ? JSON.parse(employee.workdays) : employee.workdays } catch { /* Use the default schedule below. */ }
  if (!Array.isArray(days)) days = [1, 2, 3, 4, 5]
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  const applicable = events.filter(event => String(event.event_date).slice(0, 10) === date &&
    (event.employee_id == null || Number(event.employee_id) === Number(employee.id)))
  const individual = applicable.filter(event => event.employee_id != null)
  const candidates = individual.length ? individual : applicable.filter(event => !event.automatic)
  const exception = candidates.reduce((latest, event) => !latest || Number(event.id || 0) >= Number(latest.id || 0) ? event : latest, null)
  const holiday = brazilNationalHolidays(Number(date.slice(0, 4))).has(date)
  const working = exception ? ['Trabalho', 'Trabalho extra'].includes(exception.kind) : days.includes(weekday) && !holiday
  const workMinutes = working ? Number(exception?.work_minutes ?? employee.work_minutes ?? (employee.target_hours || 8) * 60) : 0
  return {
    workMinutes,
    breakMinutes: working ? Number(exception?.break_minutes ?? employee.break_minutes ?? 60) : 0,
    startsAt: working ? exception?.starts_at ?? null : null,
    endsAt: working ? exception?.ends_at ?? null : null,
    reason: exception?.kind ?? (holiday ? 'Feriado nacional' : working ? 'Jornada habitual' : 'Folga semanal')
  }
}

export function monthlyScheduleMinutes(employee, month, events = []) {
  const [year, monthNumber] = month.split('-').map(Number)
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  let total = 0
  for (let day = 1; day <= days; day++) {
    total += scheduleForDate(employee, `${month}-${String(day).padStart(2, '0')}`, events).workMinutes
  }
  return total
}
