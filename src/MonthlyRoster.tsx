import { useState } from 'react'
import { weekdayDates, rosterDates, type MonthlyAssignment, type MonthlyRoster as Roster } from '../shared/monthly-roster.js'
import { scheduleForDate, type ScheduleEvent } from '../shared/schedule.js'
import { day, formatDate, INPUT_CLASS, LABEL_CLASS } from './types'

type Person = { id: number; name: string; work_minutes: number; workdays?: string; active: boolean }
type Settings = { first_date: string; count: number; interval: number }
type Props = { month: string; date: string; employees: Person[]; events: ScheduleEvent[]; busy: boolean; onSave: (roster: Roster) => Promise<void>; onClose: () => void }
const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const plurals = ['domingos', 'segundas-feiras', 'terças-feiras', 'quartas-feiras', 'quintas-feiras', 'sextas-feiras', 'sábados']

export default function MonthlyRoster({ month, date, employees, events, busy, onSave, onClose }: Props) {
  const today = day()
  const [scope, setScope] = useState('today')
  const [weekday, setWeekday] = useState(new Date(`${date}T12:00:00Z`).getUTCDay())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [common, setCommon] = useState<Settings | null>(null)
  const [settings, setSettings] = useState<Record<number, Settings>>({})
  const [kind, setKind] = useState<MonthlyAssignment['kind']>('Trabalho')
  const allDates = weekdayDates(month, weekday)
  const startDate = scope === 'month' || month > today.slice(0, 7) ? `${month}-01` : today
  const available = allDates.filter(value => value >= startDate)
  const people = employees.filter(person => person.active)
  const defaults: Settings = common || { first_date: available[0] || '', count: Math.min(2, Math.ceil(available.length / 2)), interval: 2 }
  const chosen = people.filter(person => selected.has(person.id))
  const getSettings = (id: number) => settings[id] || defaults
  const planned = (id: number) => {
    const config = getSettings(id)
    return available.length ? rosterDates(month, weekday, config.first_date, config.count, config.interval) : []
  }
  function clampSettings(config: Settings, patch: Partial<Settings>) {
    const next = { ...config, ...patch }
    const max = Math.ceil(available.filter(value => value >= next.first_date).length / next.interval)
    next.count = Math.max(1, Math.min(next.count, max))
    return next
  }
  function update(id: number, patch: Partial<Settings>) {
    setSettings(current => ({ ...current, [id]: clampSettings(getSettings(id), patch) }))
  }
  function updateCommon(patch: Partial<Settings>) {
    setCommon(clampSettings(defaults, patch)); setSettings({})
  }
  const preserved = chosen.reduce((sum, person) => sum + available.filter(value => scheduleForDate(person, value, events).reason === 'Atestado').length, 0)

  return <form className="my-3 grid min-w-0 gap-4 rounded-2xl border border-[#c7d8cd] bg-white p-4 sm:p-5"
    onSubmit={event => {
      event.preventDefault()
      if (!chosen.length || !available.length) return
      void onSave({ month, start_date: startDate, weekday, assignments: chosen.map(person => ({ employee_id: person.id, ...getSettings(person.id), kind })) })
    }}>
    <div>
      <h3 className="text-lg font-bold text-[#234c37]">Dias de trabalho · {month.split('-').reverse().join('/')}</h3>
      <p className="mt-1 text-base text-[#527566]">Escolha o dia da semana, os funcionários e quantas vezes cada um vai trabalhar neste mês.</p>
    </div>
    <fieldset disabled={busy} className="grid min-w-0 gap-4">
      <h4 className="text-lg font-bold text-[#234c37]">1. Escolha o período e o dia da semana</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL_CLASS}>Período a configurar
          <select value={scope} className={INPUT_CLASS} onChange={event => { setScope(event.target.value); setCommon(null); setSettings({}) }}>
            <option value="today">A partir de hoje ({formatDate(today)})</option>
            <option value="month">Mês inteiro</option>
          </select>
        </label>
        <label className={LABEL_CLASS}>Escolha um dia da semana
          <select value={weekday} className={INPUT_CLASS} onChange={event => { setWeekday(Number(event.target.value)); setCommon(null); setSettings({}) }}>
            {weekdays.map((label, index) => <option key={label} value={index}>{label}</option>)}
          </select>
        </label>
      </div>
      <p className="text-base text-[#315847]" role="status">Este mês tem <strong>{allDates.length} {plurals[weekday]}</strong>: {allDates.map(formatDate).join(', ')}. <strong>{available.length} disponíveis</strong> no período escolhido.</p>
      {!available.length && <p className="text-base text-[#913939]">Não há datas restantes. Escolha outro dia, outro mês no calendário ou a opção “Mês inteiro”.</p>}
      <label className={LABEL_CLASS}>É trabalho normal ou hora extra?
        <select value={kind} className={INPUT_CLASS} onChange={event => setKind(event.target.value as MonthlyAssignment['kind'])}>
          <option value="Trabalho">Trabalho normal — entra nas horas previstas</option>
          <option value="Trabalho extra">Trabalho extra — conta as horas batidas como extras</option>
        </select>
      </label>
      {available.length > 0 && <div className="grid gap-3 rounded-xl bg-[#eaf5ee] p-3">
        <h4 className="text-base font-bold text-[#234c37]">2. Quantas vezes vão trabalhar?</h4>
        <p className="text-base text-[#527566]">Defina o padrão aqui e, se precisar, ajuste cada funcionário abaixo. Alterar este padrão reaplica a configuração a todos.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={LABEL_CLASS}>Primeiro dia de trabalho
            <select className={INPUT_CLASS} value={defaults.first_date} onChange={event => updateCommon({ first_date: event.target.value })}>
              {available.map(value => <option key={value} value={value}>{formatDate(value)}</option>)}
            </select>
          </label>
          <label className={LABEL_CLASS}>Frequência
            <select className={INPUT_CLASS} value={defaults.interval} onChange={event => updateCommon({ interval: Number(event.target.value) })}>
              <option value={1}>Toda semana</option><option value={2}>Um sim, um não</option>
            </select>
          </label>
          <label className={LABEL_CLASS}>Quantos dias por funcionário?
            <select className={INPUT_CLASS} value={defaults.count} onChange={event => updateCommon({ count: Number(event.target.value) })}>
              {Array.from({ length: Math.ceil(available.filter(value => value >= defaults.first_date).length / defaults.interval) }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
        </div>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-bold text-[#234c37]">3. Marque os funcionários ({chosen.length})</h4>
        <button type="button" className="min-h-12 text-base font-bold text-[#317455]" onClick={() => setSelected(chosen.length === people.length ? new Set() : new Set(people.map(person => person.id)))}>{chosen.length === people.length ? 'Desmarcar todos' : 'Selecionar todos'}</button>
      </div>
      <div className="grid gap-3">
        {people.map(person => {
          const checked = selected.has(person.id)
          const config = getSettings(person.id)
          const dates = checked ? planned(person.id) : []
          const max = Math.ceil(available.filter(value => value >= config.first_date).length / config.interval)
          return <div key={person.id} className={`min-w-0 rounded-xl border p-3 ${checked ? 'border-[#8bbb9b] bg-[#f0f8f3]' : 'border-[#dce8e1]'}`}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base font-bold text-[#234c37]">
              <input type="checkbox" className="size-5 accent-[#317455]" checked={checked} onChange={event => setSelected(current => {
                const next = new Set(current)
                if (event.target.checked) next.add(person.id); else next.delete(person.id)
                return next
              })} />{person.name}
            </label>
            {checked && available.length > 0 && <div className="mt-2 grid gap-3">
              <details className="rounded-xl border border-[#9fbaa9] bg-white p-3">
                <summary className="min-h-12 cursor-pointer content-center text-base font-bold text-[#23573d]">Mudar os dias só de {person.name}</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className={LABEL_CLASS}>Primeiro dia de trabalho
                  <select className={INPUT_CLASS} value={config.first_date} onChange={event => update(person.id, { first_date: event.target.value })}>
                    {available.map(value => <option key={value} value={value}>{formatDate(value)}</option>)}
                  </select>
                </label>
                <label className={LABEL_CLASS}>Frequência
                  <select className={INPUT_CLASS} value={config.interval} onChange={event => update(person.id, { interval: Number(event.target.value) })}>
                    <option value={1}>Toda semana</option><option value={2}>Um sim, um não</option>
                  </select>
                </label>
                <label className={LABEL_CLASS}>Quantos dias? (máximo {max})
                  <select className={INPUT_CLASS} value={config.count} onChange={event => update(person.id, { count: Number(event.target.value) })}>
                    {Array.from({ length: max }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count}</option>)}
                  </select>
                </label>
              </div>
              </details>
              <p className="text-base leading-relaxed text-[#315847]">Datas escolhidas: {dates.map(value => `${formatDate(value)}${scheduleForDate(person, value, events).reason === 'Atestado' ? ' (atestado mantido)' : ''}`).join(', ')}.</p>
              <p className="text-base text-[#527566]">Folga: {available.filter(value => !dates.includes(value) && scheduleForDate(person, value, events).reason !== 'Atestado').map(formatDate).join(', ') || 'nenhuma'}. Outros dias da semana mantêm a escala atual.</p>
            </div>}
          </div>
        })}
      </div>
      <h4 className="text-lg font-bold text-[#234c37]">4. Confira as datas acima e salve</h4>
      <p className="text-base leading-relaxed text-[#527566]">A alteração vale apenas para os funcionários selecionados e para {plurals[weekday]} deste mês no período escolhido. As datas escolhidas serão de trabalho; as demais serão folgas. {preserved > 0 ? `${preserved} data(s) com atestado serão preservadas, sem transferir o trabalho para outro dia.` : 'Atestados existentes serão preservados.'}</p>
      <button type="submit" disabled={busy || !chosen.length || !available.length} className="min-h-12 rounded-xl bg-[#cef1d6] px-4 py-3 text-base font-bold text-[#173d2f] disabled:opacity-55">{busy ? 'Salvando…' : `Salvar escala de ${chosen.length} funcionário(s)`}</button>
      <button type="button" className="min-h-12 text-base font-bold text-[#527566]" onClick={onClose}>Cancelar</button>
    </fieldset>
  </form>
}
