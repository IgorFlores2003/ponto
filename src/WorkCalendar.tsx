import { FiChevronLeft, FiChevronRight, FiCalendar, FiUsers, FiClock, FiTrash2, FiHelpCircle, FiCheck } from 'react-icons/fi'
import { useEffect, useMemo, useState } from 'react'
import { brazilNationalHolidays } from '../shared/brazil-holidays.js'
import { scheduleForDate, monthlyScheduleMinutes, type ScheduleEvent } from '../shared/schedule.js'
import ConfirmDialog from './ConfirmDialog'
import DayRoster from './DayRoster'
import SuccessToast from './SuccessToast'

type Person = { id: number; name: string; work_minutes: number; workdays?: string; active: boolean }
type Event = ScheduleEvent & { id: number | string; title: string; employee_name?: string | null }
type Props = { employees: Person[]; request: <T>(path: string, body?: unknown) => Promise<T>; onError: (error: unknown) => void; onChanged: () => void }
const kinds = ['Folga', 'Trabalho', 'Feriado', 'Emenda']
const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const formatMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
const eventLabel = (event: Event) => `${event.kind}: ${event.title} · ${event.employee_name || 'Toda a equipe'}${event.starts_at ? ` · ${event.starts_at}–${event.ends_at}` : ''}`

export default function WorkCalendar({ employees, request, onError, onChanged }: Props) {
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState(() => isoDate(new Date()))
  const [events, setEvents] = useState<Event[]>([])
  const [personId, setPersonId] = useState('')
  const [form, setForm] = useState({ kind: 'Folga', title: '', repeat: 'once', customHours: false, starts_at: '07:00', ends_at: '11:00', break_time: '00:00' })
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<'roster' | 'exception' | null>(null)
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

  const inputClass = "min-w-0 w-full rounded-xl border border-[#cbded2] bg-white p-3 text-sm text-[#315847] focus-visible:outline-2 focus-visible:outline-[#31835b]"
  const labelClass = "grid gap-1.5 text-xs font-bold text-[#527566]"

  useEffect(() => {
    let active = true
    setLoading(true); setLoadFailed(false); setEvents([])
    request<Event[]>(`/schedule-events?from=${from}&to=${to}`).then(data => { if (active) setEvents(data) })
      .catch(error => { if (active) { setLoadFailed(true); onError(error) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [from, to])
  const people = employees.filter(person => person.active && (!personId || person.id === Number(personId)))
  const eventsForDate = (date: string): Event[] => {
    const officialName = brazilNationalHolidays(Number(date.slice(0, 4))).get(date)
    return [...events.filter(event => event.event_date.slice(0, 10) === date && (!personId || event.employee_id === null || event.employee_id === Number(personId))),
      ...(officialName ? [{ id: `national-${date}`, event_date: date, kind: 'Feriado nacional', title: officialName, employee_id: null, automatic: true } as Event] : [])]
  }
  const dayEvents = eventsForDate(selected)
  const plans = people.map(person => ({ person, plan: scheduleForDate(person, selected, events) }))
  const working = plans.filter(({ plan }) => plan.workMinutes > 0)
  const off = plans.filter(({ plan }) => plan.workMinutes === 0)
  const plannedDates: string[] = []
  for (let cursor = new Date(`${selected}T12:00:00`); cursor.getMonth() === new Date(`${selected}T12:00:00`).getMonth(); cursor.setDate(cursor.getDate() + (form.repeat === 'weekly' ? 7 : 14))) {
    plannedDates.push(isoDate(cursor))
    if (form.repeat === 'once') break
  }
  async function addEvent(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('')
    try {
      const created = await request<Event[]>('/schedule-events', {
        event_date: selected, kind: form.kind, title: form.title.trim() || (form.kind === 'Trabalho' ? 'Escala de trabalho' : form.kind === 'Folga' ? 'Folga prevista' : form.kind),
        employee_id: personId ? Number(personId) : null, repeat: form.repeat,
        ...(form.kind === 'Trabalho' && form.customHours ? { starts_at: form.starts_at, ends_at: form.ends_at, break_time: form.break_time } : {})
      })
      setEvents(current => [...current, ...created]); setForm(current => ({ ...current, title: '' }))
      setEditing(null); setNotice(`${created.length} ${created.length === 1 ? 'data salva' : 'datas salvas'} na escala.`); onChanged()
    } catch (error) { onError(error) } finally { setBusy(false) }
  }
  async function saveRoster(assignments: { employee_id: number; working: boolean }[]) {
    setBusy(true); setNotice('')
    try {
      const created = await request<Event[]>('/schedule-day', { event_date: selected, assignments })
      setEvents(current => [...current, ...created]); setEditing(null); setNotice('Escala do dia salva. Horas do mês recalculadas.'); onChanged()
    } catch (error) { onError(error) } finally { setBusy(false) }
  }
  function nextWeekendDay(weekday: number) {
    const date = new Date()
    date.setDate(date.getDate() + (weekday - date.getDay() + 7) % 7)
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelected(isoDate(date)); setEditing('roster'); setNotice('')
  }
  async function deleteEvent() {
    if (!deleteEventTarget || deleteEventTarget.automatic) return
    const target = deleteEventTarget
    setBusy(true)
    try { await request(`/schedule-events/${target.id}/delete`, {}); setEvents(current => current.filter(item => item.id !== target.id)); setDeleteEventTarget(null); setNotice('Evento removido desta data.'); onChanged() }
    catch (error) { onError(error) } finally { setBusy(false) }
  }
  function moveMonth(amount: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1)
    setMonth(next); setSelected(isoDate(next)); setEditing(null); setNotice('')
  }
  return (
    <section>
      {deleteEventTarget && <ConfirmDialog title="Remover evento?" message={`Remover ${eventLabel(deleteEventTarget)} somente desta data? A regra anterior volta a valer.`} confirmLabel="Remover evento" danger busy={busy} onConfirm={() => void deleteEvent()} onCancel={() => setDeleteEventTarget(null)} />}
      
      <div className="mt-2 mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-2 max-[600px]:gap-1">
        <button
          type="button"
          className="flex items-center gap-1 rounded-[10px] bg-[#e1f3e7] px-3 py-2 text-xs font-bold text-[#23573d] transition hover:bg-[#d0ebd8] disabled:opacity-55"
          disabled={busy}
          onClick={() => moveMonth(-1)}
        >
          <FiChevronLeft size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <h2 className="text-center font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31] capitalize max-[600px]:text-base">
          {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month)}
        </h2>
        <button
          type="button"
          className="flex items-center gap-1 rounded-[10px] bg-[#e1f3e7] px-3 py-2 text-xs font-bold text-[#23573d] transition hover:bg-[#d0ebd8] disabled:opacity-55"
          disabled={busy}
          onClick={() => moveMonth(1)}
        >
          <span className="hidden sm:inline">Próximo</span>
          <FiChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="my-3.5 flex flex-wrap gap-2.5">
        <button
          type="button"
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#dceee2] px-3.5 py-2 text-xs font-bold text-[#23573d] transition hover:bg-[#cee6d5] disabled:opacity-55"
          disabled={busy}
          onClick={() => nextWeekendDay(6)}
        >
          <FiCalendar size={15} aria-hidden="true" />
          Escalar próximo sábado
        </button>
        <button
          type="button"
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#dceee2] px-3.5 py-2 text-xs font-bold text-[#23573d] transition hover:bg-[#cee6d5] disabled:opacity-55"
          disabled={busy}
          onClick={() => nextWeekendDay(0)}
        >
          <FiCalendar size={15} aria-hidden="true" />
          Escalar próximo domingo
        </button>
      </div>

      <label className="mb-5 grid gap-1.5 text-xs font-bold text-[#527566]">
        Visualizar escala de
        <select disabled={busy} value={personId} className={inputClass} onChange={event => { setPersonId(event.target.value); setNotice('') }}>
          <option value="">Toda a equipe</option>
          {employees.filter(person => person.active).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>

      <p className="mt-2 mb-4 text-xs leading-normal text-[#668174]">
        Selecione um dia para ver a equipe e configurar trabalho ou folga, inclusive aos sábados e domingos.
      </p>

      <details className="mb-4 rounded-xl border border-[#dce8e1] bg-white p-3 text-[13px] leading-relaxed text-[#315847]">
        <summary className="flex cursor-pointer items-center gap-1.5 font-bold text-[#23573d]">
          <FiHelpCircle size={16} aria-hidden="true" />
          Como configurar fins de semana, folgas e feriados
        </summary>
        <p className="mt-2 mb-1">
          Quem trabalha todo sábado ou domingo deve ter esses dias marcados em Funcionários → Editar funcionário → Dias trabalhados. Para uma data específica, selecione o dia e marque quem trabalha na lista da equipe.
        </p>
        <p className="my-1">
          Para domingos alternados, mantenha domingo nos dias trabalhados, selecione o primeiro domingo de folga e repita a cada 14 dias. As repetições vão até o fim do mês escolhido.
        </p>
        <p className="my-1">
          No feriado, use Trabalho para quem estará na escala. A exceção individual prevalece sobre a da equipe; entre exceções da mesma pessoa, vale a última salva.
        </p>
      </details>

      <div className="my-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#466451]">
        <span><b className="mr-1 text-base font-bold text-[#bd2727]">15</b> Número vermelho: feriado</span>
        <span>Sábado e domingo seguem a escala de cada pessoa.</span>
      </div>

      <SuccessToast message={notice} onClose={() => setNotice('')} />

      {loading ? (
        <p role="status" className="py-4 text-xs text-[#668174]">Carregando escala…</p>
      ) : loadFailed ? (
        <p role="alert" className="py-4 text-xs text-[#bd2727]">Não foi possível carregar a escala. Troque o mês para tentar novamente.</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2 max-[600px]:gap-1">
            {weekdays.map(day => (
              <strong className="py-2 text-center text-xs font-bold text-[#315847]" key={day}>
                {day.slice(0, 3)}
              </strong>
            ))}
            {days.map(date => {
              const key = isoDate(date), todayEvents = eventsForDate(key)
              const count = people.filter(person => scheduleForDate(person, key, events).workMinutes > 0).length
              const isHoliday = todayEvents.some(event => ['Feriado', 'Feriado nacional'].includes(event.kind))
              const isCurrentMonth = date.getMonth() === month.getMonth()
              const isSelected = selected === key
              const dateLabel = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

              return (
                <button
                  type="button"
                  disabled={busy}
                  key={key}
                  aria-pressed={isSelected}
                  aria-label={`${dateLabel}${isHoliday ? ', feriado' : ''}, ${count} na escala`}
                  className={`flex min-h-[120px] min-w-0 flex-col items-start gap-1 rounded-xl border p-2 text-left transition focus-visible:outline-2 focus-visible:outline-[#215ca0] max-[600px]:min-h-[96px] max-[600px]:p-1 ${
                    isSelected
                      ? 'border-[#23573d] bg-[#e5f3e9] shadow-[inset_0_0_0_2px_#23573d]'
                      : isCurrentMonth
                      ? 'border-[#c7d8cd] bg-white'
                      : 'border-dashed border-[#dce8e1] bg-[#edf1ef]'
                  }`}
                  onClick={() => {
                    setSelected(key)
                    setEditing('roster')
                    if (date.getMonth() !== month.getMonth()) setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
                    setNotice('')
                  }}
                >
                  <span className={`text-2xl font-extrabold leading-none max-[600px]:text-xl ${isHoliday ? 'text-[#bd2727]' : isCurrentMonth ? 'text-[#143f31]' : 'text-[#82958b]'}`}>
                    {date.getDate()}
                  </span>
                  <b className="text-[11px] text-[#23573d]">
                    {personId ? (count ? 'Trabalha' : 'Folga') : `${count} na escala`}
                  </b>
                  {todayEvents.map(event => (
                    <small
                      key={event.id}
                      className={`max-w-full truncate text-[10px] font-semibold ${
                        ['Trabalho', 'Trabalho extra'].includes(event.kind) ? 'text-[#317455]' : 'text-[#9a4f3d]'
                      }`}
                    >
                      {event.kind}{event.employee_name ? ` · ${event.employee_name.split(' ')[0]}` : ''}
                    </small>
                  ))}
                </button>
              )
            })}
          </div>

          <section className="mt-5 rounded-2xl bg-[#f5f8f6] p-4 sm:p-5">
            <div>
              <h3 className="text-base font-bold capitalize text-[#143f31]">
                {new Date(`${selected}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <p className="mt-1 text-xs text-[#668174]">
                {working.length} {working.length === 1 ? 'pessoa prevista' : 'pessoas previstas'} para trabalhar
              </p>
            </div>

            <div className="my-3.5 flex flex-wrap gap-2.5">
              <button
                type="button"
                className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#dceee2] px-3.5 py-2 text-xs font-bold text-[#23573d] transition hover:bg-[#cee6d5] disabled:opacity-55"
                disabled={busy}
                onClick={() => setEditing('roster')}
              >
                <FiUsers size={15} aria-hidden="true" />
                Editar quem trabalha
              </button>
              <button
                type="button"
                className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#dceee2] px-3.5 py-2 text-xs font-bold text-[#23573d] transition hover:bg-[#cee6d5] disabled:opacity-55"
                disabled={busy}
                onClick={() => setEditing('exception')}
              >
                <FiClock size={15} aria-hidden="true" />
                Configurar horário ou folga
              </button>
            </div>

            {editing === 'roster' && (
              <>
                <DayRoster
                  key={`${selected}:${events.map(event => event.id).join(',')}:${employees.map(person => `${person.id}-${person.active}-${person.workdays}`).join(',')}`}
                  date={selected}
                  employees={employees}
                  events={events}
                  busy={busy}
                  onSave={saveRoster}
                />
                <button
                  type="button"
                  className="mt-2 bg-transparent text-xs font-bold text-[#527566] hover:text-[#173d2f] disabled:opacity-55"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Cancelar edição
                </button>
              </>
            )}

            {working.length > 0 && (
              <ul className="my-3.5 list-none divide-y divide-[#dce8e1] p-0">
                {working.map(({ person, plan }) => (
                  <li key={person.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <strong className="text-[#143f31]">{person.name}</strong>
                    <span className="text-[#668174]">
                      {plan.startsAt ? `${plan.startsAt} às ${plan.endsAt} · ` : ''}
                      {formatMinutes(plan.workMinutes)} de trabalho{plan.startsAt && plan.endsAt && plan.endsAt < plan.startsAt ? ' · saída no dia seguinte' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {off.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-bold text-[#527566]">De folga</h4>
                <ul className="my-2 list-none divide-y divide-[#dce8e1] p-0">
                  {off.map(({ person, plan }) => (
                    <li key={person.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <strong className="text-[#143f31]">{person.name}</strong>
                      <span className="text-[#668174]">{plan.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dayEvents.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-bold text-[#315847]">Exceções desta data</h4>
                <div className="divide-y divide-[#dce8e1]">
                  {dayEvents.map(event => (
                    <div className="flex items-center justify-between gap-3 py-2 text-xs" key={event.id}>
                      <span className="text-[#315847]">{eventLabel(event)}</span>
                      {!event.automatic && (
                        <button
                          type="button"
                          className="flex items-center gap-1 bg-transparent text-[11px] font-bold text-[#a24636] hover:text-[#7f2d20] disabled:opacity-55"
                          disabled={busy}
                          onClick={() => setDeleteEventTarget(event)}
                        >
                          <FiTrash2 size={12} aria-hidden="true" />
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editing === 'exception' && (
              <form className="mt-4 mb-2 grid gap-3.5 border-t border-[#dce8e1] pt-4" onSubmit={addEvent}>
                <h4 className="text-sm font-bold text-[#315847]">
                  Configurar {personId ? employees.find(person => person.id === Number(personId))?.name : 'toda a equipe'}
                </h4>
                <fieldset disabled={busy} className="m-0 grid min-w-0 gap-3.5 border-0 p-0">
                  <label className={labelClass}>
                    Tipo
                    <select value={form.kind} className={inputClass} onChange={event => setForm({ ...form, kind: event.target.value })}>
                      {kinds.map(kind => <option key={kind}>{kind}</option>)}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Repetir
                    <select value={form.repeat} className={inputClass} onChange={event => setForm({ ...form, repeat: event.target.value })}>
                      <option value="once">Somente nesta data</option>
                      <option value="weekly">Toda semana até o fim do mês</option>
                      <option value="fortnightly">A cada 14 dias até o fim do mês</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    Descrição (opcional)
                    <input maxLength={120} placeholder="Ex.: Folga de domingo, escala do feriado" value={form.title} className={inputClass} onChange={event => setForm({ ...form, title: event.target.value })} />
                  </label>
                  {form.kind === 'Trabalho' && (
                    <>
                      <label className="flex items-center gap-2 text-xs font-semibold text-[#527566]">
                        <input type="checkbox" className="size-4 rounded accent-[#317455]" checked={form.customHours} onChange={event => setForm({ ...form, customHours: event.target.checked })} />
                        Definir horário específico
                      </label>
                      {form.customHours ? (
                        <div className="grid grid-cols-3 gap-2.5">
                          <label className={labelClass}>
                            Entrada
                            <input required type="time" value={form.starts_at} className={inputClass} onChange={event => setForm({ ...form, starts_at: event.target.value })} />
                          </label>
                          <label className={labelClass}>
                            Saída
                            <input required type="time" value={form.ends_at} className={inputClass} onChange={event => setForm({ ...form, ends_at: event.target.value })} />
                          </label>
                          <label className={labelClass}>
                            Intervalo
                            <input required type="time" value={form.break_time} className={inputClass} onChange={event => setForm({ ...form, break_time: event.target.value })} />
                          </label>
                        </div>
                      ) : (
                        <p className="text-xs text-[#668174]">Usa a quantidade de horas e o intervalo do cadastro de cada pessoa.</p>
                      )}
                    </>
                  )}
                  <p className="text-xs text-[#668174]">
                    {plannedDates.length} {plannedDates.length === 1 ? 'data' : 'datas'}: {plannedDates.map(date => date.slice(8) + '/' + date.slice(5, 7)).join(', ')}. {form.kind === 'Trabalho' ? 'Essas horas entram como previstas no relatório.' : 'As folgas efetivas não geram horas devidas; exceções individuais continuam tendo prioridade.'}
                  </p>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#cef1d6] p-3.5 font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55"
                    disabled={busy}
                  >
                    <FiCheck size={18} aria-hidden="true" />
                    {busy ? 'Salvando…' : 'Salvar escala'}
                  </button>
                </fieldset>
                <button
                  type="button"
                  className="bg-transparent text-xs font-bold text-[#527566] hover:text-[#173d2f] disabled:opacity-55"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Cancelar edição
                </button>
              </form>
            )}
          </section>

          <section className="mt-5 rounded-[14px] bg-[#eaf5ee] p-4 sm:p-5">
            <h3 className="text-base font-bold text-[#234c37]">Horas previstas no mês</h3>
            <p className="mt-1 mb-3 text-xs text-[#527566]">
              Calculadas automaticamente para o mês inteiro, incluindo dias futuros, folgas, feriados e horários específicos.
            </p>
            <ul className="list-none divide-y divide-[#dce8e1] p-0">
              {people.map(person => (
                <li key={person.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <strong className="text-[#143f31]">{person.name}</strong>
                  <span className="font-semibold text-[#246841]">{formatMinutes(monthlyScheduleMinutes(person, isoDate(first).slice(0, 7), events))}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </section>
  )
}

