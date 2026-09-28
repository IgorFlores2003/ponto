// Store money as integer cents; accept Brazilian decimal comma or decimal point.
export function parseHourlyRate(value) {
  if (value === '' || value === null) return null
  if (typeof value !== 'string' || !/^\d{1,6}([.,]\d{1,2})?$/.test(value)) return undefined
  const [whole, fraction = ''] = value.split(/[.,]/)
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
