export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
}
export function reportFor(employees, entries, from, to, now = Date.now()) {
  const start = Date.parse(`${from}T00:00:00-03:00`)
  const end = Date.parse(`${to}T00:00:00-03:00`) + 86400000
  return employees.map(employee => {
    const history = entries.filter(e => e.employee_id === employee.id)
    let opened = null, total = 0
    for (const entry of history) {
      const at = Date.parse(entry.occurred_at)
      if (entry.kind === 'Entrada' || entry.kind === 'Fim do intervalo') opened = at
      else if (opened !== null) { total += Math.max(0, Math.min(at, end, now) - Math.max(opened, start)); opened = null }
    }
    if (opened !== null) total += Math.max(0, Math.min(now, end) - Math.max(opened, start))
    const last = history.at(-1)
    return { ...employee, minutes: Math.floor(total / 60000), punches: history.filter(e => Date.parse(e.occurred_at) >= start && Date.parse(e.occurred_at) < end).length,
      status: last?.kind === 'Início do intervalo' ? 'Em intervalo' : opened !== null ? 'Em expediente' : 'Fora do expediente' }
  })
}
