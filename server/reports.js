export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
}
export function reportFor(employees, entries, from, to, now = Date.now()) {
  const start = Date.parse(`${from}T00:00:00-03:00`)
  const end = Date.parse(`${to}T00:00:00-03:00`) + 86400000
  const expectedDays = countWeekdays(from, to)
  return employees.map(employee => {
    const history = entries.filter(e => e.employee_id === employee.id)
    let opened = null, paused = null, total = 0, breaks = 0
    let breakName = null
    const totals = new Map()
    const addBreak = milliseconds => { breaks += milliseconds; const name = breakName || 'Intervalo'; totals.set(name, (totals.get(name) || 0) + milliseconds) }
    const overlap = (a, b) => Math.max(0, Math.min(b, end, now) - Math.max(a, start))
    for (const entry of history) {
      const at = Date.parse(entry.occurred_at)
      if (at > now) continue
      if (entry.kind === 'Entrada' || entry.kind === 'Fim do intervalo') {
        if (paused !== null) addBreak(overlap(paused, at))
        paused = null; breakName = null; opened = at
      } else {
        if (opened !== null) total += overlap(opened, at)
        opened = null
        if (entry.kind === 'Início do intervalo') { paused = at; breakName = entry.break_name || 'Intervalo' }
        else if (paused !== null) { addBreak(overlap(paused, at)); paused = null }
      }
    }
    if (opened !== null) total += overlap(opened, now)
    if (paused !== null) addBreak(overlap(paused, now))
    const expected_seconds = Math.max(0, Number(employee.work_minutes ?? Math.round((employee.target_hours || 8) * 60))) * 60 * expectedDays
    const workSeconds = Math.floor(total / 1000)
    const breakSeconds = Math.floor(breaks / 1000)
    const expected_break_seconds = Math.max(0, Number(employee.break_minutes ?? 60)) * 60 * expectedDays
    const debt_seconds = Math.max(0, expected_seconds - workSeconds)
    const extra_break_seconds = Math.max(0, breakSeconds - expected_break_seconds)
    return { ...employee, expected_days: expectedDays, expected_seconds, expected_break_seconds, debt_seconds, extra_break_seconds, minutes: Math.floor(total / 60000), work_seconds: workSeconds, break_seconds: breakSeconds,
      current_break_name: paused !== null ? breakName : null, break_totals: [...totals].map(([name, ms]) => ({ name, seconds: Math.floor(ms / 1000) })),
      current_since: opened !== null ? new Date(opened).toISOString() : paused !== null ? new Date(paused).toISOString() : null,
      punches: history.filter(e => Date.parse(e.occurred_at) >= start && Date.parse(e.occurred_at) < end && Date.parse(e.occurred_at) <= now).length,
      status: paused !== null ? 'Em intervalo' : opened !== null ? 'Em expediente' : 'Fora do expediente' }

  })
}

function countWeekdays(from, to) {
  let total = 0
  for (let cursor = Date.parse(`${from}T12:00:00Z`), end = Date.parse(`${to}T12:00:00Z`); cursor <= end; cursor += 86400000) {
    const day = new Date(cursor).getUTCDay()
    if (day !== 0 && day !== 6) total += 1
  }
  return total
}
