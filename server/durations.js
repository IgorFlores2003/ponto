export function parseDuration(value) {
  if (typeof value !== 'string' || !/^\d{1,3}:[0-5]\d$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}
