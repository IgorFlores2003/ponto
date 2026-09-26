import { validDate } from './reports.js'
import { parseDuration } from './durations.js'

export function planScheduleEvents(body = {}) {
  const { event_date, kind, title, employee_id = null, repeat = 'once', starts_at = '', ends_at = '', break_time = '00:00' } = body
  if (!validDate(event_date) || !['Feriado', 'Folga', 'Emenda', 'Trabalho', 'Trabalho extra'].includes(kind) ||
    typeof title !== 'string' || !title.trim() || title.trim().length > 120 ||
    !['once', 'weekly', 'fortnightly'].includes(repeat) ||
    (employee_id !== null && (!Number.isSafeInteger(employee_id) || employee_id <= 0))) {
    throw new Error('Informe data, pessoa, tipo, descrição e repetição válidos.')
  }
  let hours = { starts_at: null, ends_at: null, work_minutes: null, break_minutes: null }
  if (starts_at || ends_at) {
    const isWork = ['Trabalho', 'Trabalho extra'].includes(kind)
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
    const pause = parseDuration(break_time)
    if (!isWork || typeof starts_at !== 'string' || typeof ends_at !== 'string' || !timePattern.test(starts_at) || !timePattern.test(ends_at) || pause === null || pause < 0) {
      throw new Error('Informe entrada, saída e intervalo válidos para o dia de trabalho.')
    }
    const start = parseDuration(starts_at), end = parseDuration(ends_at)
    const duration = end > start ? end - start : end + 1440 - start
    if (start === end || pause >= duration) throw new Error('A saída deve ser diferente da entrada e o intervalo menor que a jornada.')
    hours = { starts_at, ends_at, work_minutes: duration - pause, break_minutes: pause }
  }
  const result = []
  const step = repeat === 'weekly' ? 7 : 14
  let date = event_date
  while (date.slice(0, 7) === event_date.slice(0, 7)) {
    result.push({ event_date: date, kind, title: title.trim(), employee_id, ...hours })
    if (repeat === 'once') break
    date = new Date(Date.parse(`${date}T12:00:00Z`) + step * 86400000).toISOString().slice(0, 10)
  }
  return result
}
