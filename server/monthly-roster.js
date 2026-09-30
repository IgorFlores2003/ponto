import { weekdayDates, rosterDates } from '../shared/monthly-roster.js'
import { validDate } from './reports.js'
import { scheduleForDate } from '../shared/schedule.js'

export function validateMonthlyRoster(body = {}) {
  const { month, start_date, weekday, assignments } = body
  weekdayDates(month, weekday)
  if (!validDate(start_date) || start_date.slice(0, 7) !== month) throw new Error('Escolha uma data inicial dentro do mês.')
  if (!Array.isArray(assignments) || !assignments.length || assignments.length > 1000 ||
    assignments.some(item => !item || !Number.isSafeInteger(item.employee_id) || item.employee_id <= 0 || !['Trabalho', 'Trabalho extra'].includes(item.kind)) ||
    new Set(assignments.map(item => item.employee_id)).size !== assignments.length) {
    throw new Error('Selecione funcionários válidos, sem duplicação.')
  }
  for (const item of assignments) {
    rosterDates(month, weekday, item.first_date, item.count, item.interval)
    if (item.first_date < start_date) throw new Error('A primeira ocorrência deve ser a partir da data inicial.')
  }
  return body
}

export function planMonthlyRoster(body, employees, events) {
  const { month, start_date, weekday, assignments } = validateMonthlyRoster(body)
  const dates = weekdayDates(month, weekday).filter(date => date >= start_date)
  const planned = [], preserved = []
  for (const item of assignments) {
    const employee = employees.find(person => person.id === item.employee_id && person.active)
    if (!employee) throw new Error('A equipe mudou. Atualize a página e selecione novamente os funcionários.')
    const workingDates = new Set(rosterDates(month, weekday, item.first_date, item.count, item.interval))
    for (const event_date of dates) {
      const current = scheduleForDate(employee, event_date, events)
      if (current.reason === 'Atestado') {
        preserved.push({ employee_id: employee.id, event_date })
        continue
      }
      const kind = workingDates.has(event_date) ? item.kind : 'Folga'
      if ((kind === 'Folga' && current.workMinutes === 0) ||
        (kind === 'Trabalho' && current.workMinutes > 0 && current.reason !== 'Trabalho extra') ||
        (kind === 'Trabalho extra' && current.reason === kind)) continue
      planned.push({ event_date, employee_id: employee.id, kind, title: 'Escala mensal em massa',
        ...(kind !== 'Folga' && current.workMinutes > 0 ? {
          starts_at: current.startsAt, ends_at: current.endsAt,
          work_minutes: current.workMinutes, break_minutes: current.breakMinutes,
        } : {}) })
    }
  }
  return { planned, preserved }
}

export async function saveMonthlyRoster(db, body, eventColumns) {
  validateMonthlyRoster(body)
  return db.transaction(async trx => {
    const employees = await trx('employees').whereIn('id', body.assignments.map(item => item.employee_id)).where({ active: true })
    const events = await trx('schedule_events').select('*', trx.raw('CAST(event_date AS TEXT) AS event_date'))
      .where('event_date', '>=', `${body.month}-01`).where('event_date', '<=', weekdayDates(body.month, body.weekday).at(-1))
    const { planned, preserved } = planMonthlyRoster(body, employees, events)
    const ids = []
    for (const event of planned) {
      const [{ id }] = await trx('schedule_events').insert({ ...event, created_at: new Date().toISOString() }).returning('id')
      ids.push(id)
    }
    const created = await trx('schedule_events').leftJoin('employees', 'schedule_events.employee_id', 'employees.id')
      .select(eventColumns).whereIn('schedule_events.id', ids).orderBy('schedule_events.event_date')
    return { events: created, preserved }
  })
}
