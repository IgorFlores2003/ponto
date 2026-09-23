import { useEffect, useMemo, useState } from 'react'
import { brazilNationalHolidays } from '../shared/brazil-holidays.js'
import ConfirmDialog from './ConfirmDialog'

type Person = { id: number; name: string; work_minutes: number; workdays?: string; active: boolean }
type Event = { id: number | string; event_date: string; kind: string; title: string; employee_id: number | null; employee_name?: string | null; automatic?: boolean }
type Props = { employees: Person[]; request: <T>(path: string, body?: unknown) => Promise<T>; onError: (error: unknown) => void }
const kinds = ['Feriado', 'Folga', 'Emenda', 'Trabalho extra']
const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const monthKey = (date: Date) => isoDate(new Date(date.getFullYear(), date.getMonth(), 1)).slice(0, 7)
const eventLabel = (event: Event) => `${event.kind}: ${event.title}${event.employee_name ? ` · ${event.employee_name}` : ''}`
function scheduleDays(employee: Person) { try { return JSON.parse(employee.workdays || '[1,2,3,4,5]') as number[] } catch { return [1, 2, 3, 4, 5] } }

export default function WorkCalendar({ employees, request, onError }: Props) {
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState(() => isoDate(new Date()))
  const [events, setEvents] = useState<Event[]>([])
  const [form, setForm] = useState({ kind: 'Feriado', title: '', employee_id: '' })
  const [busy, setBusy] = useState(false)
  const [deleteEventTarget, setDeleteEventTarget] = useState<Event | null>(null)
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const days = useMemo(() => {
    const start = new Date(first)
    start.setDate(start.getDate() - start.getDay())
    const result: Date[] = []
    const count = Math.ceil((last.getDate() + first.getDay()) / 7) * 7
    for (let i = 0; i < count; i++) result.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
    return result
  }, [month.getFullYear(), month.getMonth()])
  const from = isoDate(days[0]), to = isoDate(days[days.length - 1])
  useEffect(() => { request<Event[]>(`/schedule-events?from=${from}&to=${to}`).then(setEvents).catch(onError) }, [from, to])
  const eventsForDate = (date: string): Event[] => {
    const officialName = brazilNationalHolidays(Number(date.slice(0, 4))).get(date)
    return [...events.filter(event => event.event_date.slice(0, 10) === date), ...(officialName ? [{ id: `national-${date}`, event_date: date, kind: 'Feriado nacional', title: officialName, employee_id: null, automatic: true } as Event] : [])]
  }
  const dayEvents = eventsForDate(selected)
  const scheduled = employees.filter(employee => employee.active && scheduleDays(employee).includes(new Date(`${selected}T12:00:00`).getDay()))
  const offEvents = dayEvents.filter(event => ['Feriado', 'Feriado nacional', 'Folga', 'Emenda'].includes(event.kind))
  const offIds = new Set<number>(offEvents.some(event => event.employee_id === null) ? scheduled.map(person => person.id) : offEvents.map(event => event.employee_id as number))
  const extra = dayEvents.filter(event => event.kind === 'Trabalho extra').map(event => event.employee_id === null ? employees.filter(person => person.active) : employees.filter(person => person.id === event.employee_id)).flat()
  const working = [...scheduled.filter(person => !offIds.has(person.id)), ...extra.filter(person => !scheduled.some(regular => regular.id === person.id) && !offIds.has(person.id))]
  async function addEvent(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try {
      const created = await request<Event>('/schedule-events', { event_date: selected, kind: form.kind, title: form.title, employee_id: form.employee_id ? Number(form.employee_id) : null })
      setEvents(current => [...current, created]); setForm(current => ({ ...current, title: '' }))
    } catch (error) { onError(error) } finally { setBusy(false) }
  }
  async function deleteEvent() {
    if (!deleteEventTarget || deleteEventTarget.automatic) return
    const target = deleteEventTarget
    setBusy(true)
    try { await request(`/schedule-events/${target.id}/delete`, {}); setEvents(current => current.filter(item => item.id !== target.id)); setDeleteEventTarget(null) }
    catch (error) { onError(error) } finally { setBusy(false) }
  }
  function moveMonth(amount: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1)
    setMonth(next); setSelected(isoDate(next))
  }
  return <section className="work-calendar">
    {deleteEventTarget && <ConfirmDialog title="Remover evento?" message={`Remover ${eventLabel(deleteEventTarget)} do calendário?`} confirmLabel="Remover evento" danger busy={busy} onConfirm={() => void deleteEvent()} onCancel={() => setDeleteEventTarget(null)} />}
    <div className="calendar-toolbar"><button type="button" className="secondary-button" onClick={() => moveMonth(-1)}>‹ Anterior</button><h2>{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month)}</h2><button type="button" className="secondary-button" onClick={() => moveMonth(1)}>Próximo ›</button></div>
    <p className="calendar-hint">Os números mostram quantas pessoas estão previstas para trabalhar. Feriados, folgas e emendas retiram pessoas da escala; trabalho extra as adiciona.</p>
    <div className="calendar-grid">{weekdays.map(day => <strong className="calendar-weekday" key={day}>{day.slice(0, 3)}</strong>)}{days.map(date => {
      const key = isoDate(date), todayEvents = eventsForDate(key)
      const regular = employees.filter(person => person.active && scheduleDays(person).includes(date.getDay()))
      const dayOffs = todayEvents.filter(event => ['Feriado', 'Feriado nacional', 'Folga', 'Emenda'].includes(event.kind))
      const offIds = new Set(dayOffs.some(event => event.employee_id === null) ? employees.filter(person => person.active).map(person => person.id) : dayOffs.map(event => event.employee_id as number))
      const workingIds = new Set(regular.filter(person => !offIds.has(person.id)).map(person => person.id))
      todayEvents.filter(event => event.kind === 'Trabalho extra').forEach(event => {
        const targets = event.employee_id === null ? employees.filter(person => person.active) : employees.filter(person => person.active && person.id === event.employee_id)
        targets.forEach(person => { if (!offIds.has(person.id)) workingIds.add(person.id) })
      })
      const count = workingIds.size
      return <button type="button" key={key} className={`calendar-day ${date.getMonth() !== month.getMonth() ? 'outside-month' : ''} ${selected === key ? 'selected-day' : ''}`} onClick={() => setSelected(key)}><span>{date.getDate()}</span>{count > 0 && <b>{count} na escala</b>}{todayEvents.map(event => <small key={event.id} className={`event-chip event-${event.kind === 'Trabalho extra' ? 'extra' : 'off'}`}>{event.kind}{event.employee_name ? ` · ${event.employee_name.split(' ')[0]}` : ''}</small>)}</button>
    })}</div>
    <section className="calendar-day-detail"><div><h3>{new Date(`${selected}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><p>{working.length} {working.length === 1 ? 'pessoa prevista' : 'pessoas previstas'} para trabalhar</p></div>
      {working.length ? <ul className="calendar-people">{working.map((person, index) => <li key={`${person.id}-${index}`}><strong>{person.name}</strong><span>{Math.floor(person.work_minutes / 60)}h{String(person.work_minutes % 60).padStart(2, '0')} previstas</span></li>)}</ul> : <p className="empty">Ninguém previsto para trabalhar nesta data.</p>}
      {dayEvents.length > 0 && <div className="calendar-events"><h4>Exceções desta data</h4>{dayEvents.map(event => <div className="calendar-event" key={event.id}><span>{eventLabel(event)}</span>{!event.automatic && <button type="button" className="text-button" disabled={busy} onClick={() => setDeleteEventTarget(event)}>Remover</button>}</div>)}</div>}
      <form className="settings-form calendar-event-form" onSubmit={addEvent}><h4>Adicionar feriado, folga ou emenda</h4><label>Tipo<select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value })}>{kinds.map(kind => <option key={kind}>{kind}</option>)}</select></label><label>Descrição<input required maxLength={120} placeholder="Ex.: Feriado municipal" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>Aplicar a<select value={form.employee_id} onChange={event => setForm({ ...form, employee_id: event.target.value })}><option value="">Toda a equipe</option>{employees.filter(employee => employee.active).map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><button className="primary-button" disabled={busy}>{busy ? 'Salvando…' : 'Salvar no calendário'}</button></form>
    </section>
  </section>
}
