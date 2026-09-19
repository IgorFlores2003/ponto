export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
}
export function reportFor(employees, entries, from, to, now = Date.now()) {
  const start = Date.parse(`${from}T00:00:00-03:00`)
  const end = Date.parse(`${to}T00:00:00-03:00`) + 86400000
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
    return { ...employee, minutes: Math.floor(total / 60000), work_seconds: Math.floor(total / 1000), break_seconds: Math.floor(breaks / 1000),
      current_break_name: paused !== null ? breakName : null, break_totals: [...totals].map(([name, ms]) => ({ name, seconds: Math.floor(ms / 1000) })),
      current_since: opened !== null ? new Date(opened).toISOString() : paused !== null ? new Date(paused).toISOString() : null,
      punches: history.filter(e => Date.parse(e.occurred_at) >= start && Date.parse(e.occurred_at) < end && Date.parse(e.occurred_at) <= now).length,
      status: paused !== null ? 'Em intervalo' : opened !== null ? 'Em expediente' : 'Fora do expediente' }

  })
}
