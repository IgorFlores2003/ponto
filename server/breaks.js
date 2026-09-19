import { validDate } from './reports.js'
export function localDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}
export function matchingBreak(rules, now) {
  const { date, time } = localDateTime(now)
  return rules.find(rule => rule.active && rule.effective_from <= date && rule.starts_at <= time && time < rule.ends_at) || null
}
export function validRule(rule) {
  return typeof rule.name === 'string' && !!rule.name.trim() && rule.name.trim().length <= 80 &&
    typeof rule.starts_at === 'string' && typeof rule.ends_at === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(rule.starts_at) && /^([01]\d|2[0-3]):[0-5]\d$/.test(rule.ends_at) &&
    rule.starts_at < rule.ends_at && validDate(rule.effective_from)
}
