import { useState } from 'react'
import { FiCheck, FiUsers } from 'react-icons/fi'
import { scheduleForDate, type ScheduleEvent } from '../shared/schedule.js'

type Person = { id: number; name: string; work_minutes: number; workdays?: string; active: boolean }
type Props = {
  date: string; employees: Person[]; events: ScheduleEvent[]; busy: boolean;
  onSave: (assignments: { employee_id: number; working: boolean }[]) => Promise<void>
}

export default function DayRoster({ date, employees, events, busy, onSave }: Props) {
  const active = employees.filter(person => person.active)
  const [selected, setSelected] = useState(() => new Set(active.filter(person => scheduleForDate(person, date, events).workMinutes > 0).map(person => person.id)))

  return (
    <form
      className="my-5 rounded-[14px] border border-[#c7d8cd] bg-white p-4"
      onSubmit={event => { event.preventDefault(); void onSave(active.map(person => ({ employee_id: person.id, working: selected.has(person.id) }))) }}
    >
      <div className="flex items-center gap-2">
        <FiUsers size={18} className="text-[#234c37]" aria-hidden="true" />
        <h4 className="text-lg font-bold text-[#234c37]">Quem trabalha neste dia?</h4>
      </div>
      <p className="mt-2 mb-3.5 text-[13px] leading-normal text-[#527566]">
        Marque quem vai trabalhar. Quem ficar desmarcado estará de folga somente nesta data. A seleção inclui toda a equipe.
      </p>
      <fieldset disabled={busy} className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-2.5 text-xs font-semibold text-[#527566]">
          Equipe de {date.split('-').reverse().join('/')}
        </legend>
        {active.map(person => {
          const isWorking = selected.has(person.id)
          return (
            <label
              key={person.id}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border p-3 text-sm transition ${
                isWorking ? 'border-[#8bbb9b] bg-[#eaf5ee] text-[#1e4d35]' : 'border-[#dce8e1] bg-white text-[#527566]'
              }`}
            >
              <input
                type="checkbox"
                className="size-5 shrink-0 rounded accent-[#317455]"
                checked={isWorking}
                onChange={event => setSelected(current => {
                  const next = new Set(current)
                  if (event.target.checked) next.add(person.id)
                  else next.delete(person.id)
                  return next
                })}
              />
              <span className="flex-1 break-words font-medium">{person.name}</span>
              <strong className={`text-xs ${isWorking ? 'text-[#246841]' : 'text-[#789185]'}`}>
                {isWorking ? 'Trabalha' : 'Folga'}
              </strong>
            </label>
          )
        })}
      </fieldset>
      <button
        type="submit"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#cef1d6] p-3.5 font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55"
        disabled={busy || !active.length}
      >
        <FiCheck size={18} aria-hidden="true" />
        {busy ? 'Salvando…' : `Salvar escala de ${date.slice(8)}/${date.slice(5, 7)}`}
      </button>
    </form>
  )
}

