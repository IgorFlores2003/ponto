import { useState } from 'react'
import { FiCheck, FiEdit2 } from 'react-icons/fi'
import { api, hours, day, type Employee } from './types'
import { monthlyScheduleMinutes, type ScheduleEvent } from '../shared/schedule.js'

const WEEKDAYS: [string, number][] = [
  ['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6],
]

interface Props {
  employee: Employee
  token: string
  monthEvents: ScheduleEvent[]
  onSaved: (updated: Employee) => void
  onError: (err: unknown) => void
}

function parseWorkdays(raw: string | undefined): number[] {
  try { return JSON.parse(raw || '[1,2,3,4,5]') as number[] } catch { return [1, 2, 3, 4, 5] }
}

/** Editor inline de jornada/escala do funcionário (função, horas, dias, intervalo). */
export default function EmployeeScheduleEditor({ employee, token, monthEvents, onSaved, onError }: Props) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    department: employee.department || '',
    job_title: employee.job_title || '',
    work_time: hours(employee.work_minutes || employee.target_hours * 60),
    workdays: parseWorkdays(employee.workdays),
    break_time: hours(employee.break_minutes ?? 60),
  })

  const inputClass = 'min-w-0 w-full rounded-lg border border-[#cbded2] bg-white p-2 text-xs text-[#315847] focus-visible:outline-2 focus-visible:outline-[#31835b]'
  const labelClass = 'grid gap-1 text-[11px] font-bold text-[#527566]'

  const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number)
    return h * 60 + m
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const updated: Employee = {
        ...employee,
        department: form.department,
        job_title: form.job_title,
        work_minutes: toMinutes(form.work_time),
        break_minutes: toMinutes(form.break_time),
        workdays: JSON.stringify(form.workdays),
        monthly_month: day().slice(0, 7),
      }
      updated.monthly_minutes = monthlyScheduleMinutes(updated, updated.monthly_month!, monthEvents)
      await api(`/employees/${employee.id}/schedule`, {
        ...form,
        monthly_time: hours(updated.monthly_minutes),
      }, token)
      setEditing(false)
      onSaved(updated)
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <form className="my-2 grid grid-cols-2 gap-2 rounded-xl border border-[#dce8e1] bg-white p-3" onSubmit={save}>
        <label className={labelClass}>
          Função
          <input maxLength={120} value={form.job_title} className={inputClass}
            onChange={e => setForm({ ...form, job_title: e.target.value })} />
        </label>
        <label className={labelClass}>
          Horas por dia
          <input required type="time" value={form.work_time} className={inputClass}
            onChange={e => setForm({ ...form, work_time: e.target.value })} />
        </label>
        <fieldset className="col-span-full flex flex-wrap gap-x-2.5 gap-y-1.5 rounded-lg border border-[#dce8e1] p-2">
          <legend className="px-1 text-[10px] font-bold text-[#527566]">Dias trabalhados</legend>
          {WEEKDAYS.map(([label, value]) => (
            <label key={value} className="flex cursor-pointer items-center gap-1 text-[11px] text-[#315847]">
              <input type="checkbox" className="size-3.5 rounded accent-[#317455]"
                checked={form.workdays.includes(value)}
                onChange={e => setForm(f => ({
                  ...f,
                  workdays: e.target.checked
                    ? [...f.workdays, value].sort()
                    : f.workdays.filter(d => d !== value),
                }))} />
              {label}
            </label>
          ))}
        </fieldset>
        <label className={labelClass}>
          Intervalo esperado
          <input required type="time" value={form.break_time} className={inputClass}
            onChange={e => setForm({ ...form, break_time: e.target.value })} />
        </label>
        <div className="col-span-full flex items-center justify-end gap-2 pt-1">
          <button type="button" disabled={busy}
            className="bg-transparent px-2 py-1 text-xs font-bold text-[#527566] hover:text-[#173d2f] disabled:opacity-55"
            onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button disabled={busy}
            className="flex items-center gap-1 rounded-lg bg-[#cef1d6] px-3 py-1.5 text-xs font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55">
            <FiCheck size={13} aria-hidden="true" /> Salvar
          </button>
        </div>
      </form>
    )
  }

  const workdayNames = parseWorkdays(employee.workdays)
    .map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d])
    .join(', ') || 'Por escala'

  return (
    <p className="mt-1 text-xs text-[#527566]">
      {employee.job_title || 'Função não informada'} · {hours(employee.work_minutes || employee.target_hours * 60)}/dia · {workdayNames} · {hours(employee.monthly_minutes ?? 0)} previstas em {employee.monthly_month?.split('-').reverse().join('/') || 'este mês'} · {hours(employee.break_minutes ?? 60)} de intervalo{' '}
      <button
        className="inline-flex items-center gap-0.5 bg-transparent font-bold text-[#317455] hover:text-[#173d2f]"
        onClick={() => {
          setForm({
            department: employee.department || '',
            job_title: employee.job_title || '',
            work_time: hours(employee.work_minutes),
            workdays: parseWorkdays(employee.workdays),
            break_time: hours(employee.break_minutes ?? 60),
          })
          setEditing(true)
        }}
      >
        <FiEdit2 size={11} aria-hidden="true" /> Editar funcionário
      </button>
    </p>
  )
}
