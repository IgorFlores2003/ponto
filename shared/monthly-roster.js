// UTC keeps calendar dates independent of the device timezone.
export function weekdayDates(month, weekday) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1 ||
    !Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('Informe mês e dia da semana válidos.')
  const dates = []
  const cursor = new Date(`${month}-01T12:00:00Z`)
  while (cursor.toISOString().slice(0, 7) === month) {
    if (cursor.getUTCDay() === weekday) dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

export function rosterDates(month, weekday, firstDate, count, interval) {
  const dates = weekdayDates(month, weekday)
  const start = dates.indexOf(firstDate)
  if (start < 0 || !Number.isInteger(count) || count < 1 || ![1, 2].includes(interval)) {
    throw new Error('Escolha a primeira data, a quantidade e a frequência válidas para este mês.')
  }
  const selected = dates.slice(start).filter((_, index) => index % interval === 0)
  if (count > selected.length) throw new Error(`Cabem apenas ${selected.length} ocorrências a partir desta data neste mês.`)
  return selected.slice(0, count)
}
