export function parseDuration(value) {
  if (typeof value !== 'string' || !/^\d{1,3}:[0-5]\d$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(minutes || 0))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
