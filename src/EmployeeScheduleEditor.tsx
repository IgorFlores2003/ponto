import { useState } from 'react'
import FormModal from './FormModal'
import { FiCheck, FiEdit2 } from 'react-icons/fi'
import { api, hours, day, money, errorMessage, INPUT_CLASS, LABEL_CLASS, type Employee } from './types'
import { parseHourlyRate } from '../shared/money.js'
import { monthlyScheduleMinutes, type ScheduleEvent } from '../shared/schedule.js'

const WEEKDAYS: [string, number][] = [
  ['Domingo', 0], ['Segunda', 1], ['Terça', 2], ['Quarta', 3], ['Quinta', 4], ['Sexta', 5], ['Sábado', 6],
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
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    overtime_rate: employee.overtime_rate_cents == null ? '' : (employee.overtime_rate_cents / 100).toFixed(2).replace('.', ','),
    department: employee.department || '',
    job_title: employee.job_title || '',
    work_time: hours(employee.work_minutes || employee.target_hours * 60),
    workdays: parseWorkdays(employee.workdays),
    break_time: hours(employee.break_minutes ?? 60),
  })

  const inputClass = INPUT_CLASS
  const labelClass = LABEL_CLASS

  const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number)
    return h * 60 + m
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const updated: Employee = {
        ...employee,
        overtime_rate_cents: parseHourlyRate(form.overtime_rate) ?? null,
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
      setError(errorMessage(err)); onError(err)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <FormModal title={`Rotina de ${employee.name}`} busy={busy} onClose={() => setEditing(false)}>
      <p className="mt-2 text-base text-[#315847]">Altere os dias habituais e a quantidade de horas. Para mudanças de uma data específica, use o Calendário.</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-[#fff0f0] p-3 text-base text-[#913939]">{error}</p>}
      <form className="my-3" onSubmit={save}>
        <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Função
          <input maxLength={120} value={form.job_title} className={inputClass}
            onChange={e => setForm({ ...form, job_title: e.target.value })} />
        </label>
        <label className={labelClass}>
          Quantas horas trabalha por dia?
          <input required type="time" value={form.work_time} className={inputClass}
            onChange={e => setForm({ ...form, work_time: e.target.value })} />
          <span className="font-normal">07:20 = 7 horas e 20 minutos, sem o intervalo.</span>
        </label>
        <fieldset className="col-span-full flex min-w-0 flex-wrap gap-x-2.5 gap-y-1.5 rounded-lg border border-[#dce8e1] p-2">
          <legend className="px-1 text-sm font-bold text-[#527566]">Em quais dias costuma trabalhar?</legend>
          {WEEKDAYS.map(([label, value]) => (
            <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[#9fbaa9] px-3 text-base text-[#315847] has-[:checked]:bg-[#e1f3e7]">
              <input type="checkbox" className="size-5 rounded accent-[#317455]"
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
          Quanto tempo tem de intervalo?
          <input required type="time" value={form.break_time} className={inputClass}
            onChange={e => setForm({ ...form, break_time: e.target.value })} />
        </label>
        <label className={labelClass}>
          Valor da hora extra (R$/h)
          <input inputMode="decimal" pattern="[0-9]{1,6}([.,][0-9]{1,2})?" placeholder="Ex.: 25,50" value={form.overtime_rate} className={inputClass}
            onChange={e => setForm({ ...form, overtime_rate: e.target.value })} />
        </label>
        <p className="col-span-full text-sm text-[#466451]">Informe o valor final de uma hora extra na folga. O relatório multiplica as horas por esse valor, sem acrescentar percentuais. Alterar o valor recalcula também os relatórios de períodos anteriores.</p>
        <div className="col-span-full flex items-center justify-end gap-2 pt-1">
          <button type="button" disabled={busy}
            className="min-h-12 rounded-xl border border-[#9fbaa9] bg-white px-4 py-3 text-sm font-bold text-[#527566] hover:text-[#173d2f] disabled:opacity-55"
            onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button disabled={busy}
            className="flex min-h-12 items-center gap-2 rounded-lg bg-[#cef1d6] px-3 py-1.5 text-sm font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55">
            <FiCheck size={13} aria-hidden="true" /> Salvar alterações
          </button>
        </div>
        </fieldset>
      </form>
      </FormModal>
    )
  }

  const workdayNames = parseWorkdays(employee.workdays)
    .map(d => WEEKDAYS.find(([, value]) => value === d)?.[0])
    .join(', ') || 'Por escala'

  return (
    <div className="mt-3 min-w-0 text-base leading-relaxed text-[#315847]">
      <p className="font-semibold">{employee.job_title || 'Função não informada'}</p>
      <dl className="mt-2 grid gap-2">
        <div><dt className="inline font-bold">Trabalha: </dt><dd className="inline">{workdayNames}</dd></div>
        <div><dt className="inline font-bold">Horas por dia: </dt><dd className="inline">{hours(employee.work_minutes || employee.target_hours * 60)}</dd></div>
        <div><dt className="inline font-bold">Intervalo: </dt><dd className="inline">{hours(employee.break_minutes ?? 60)}</dd></div>
      </dl>
      <details className="my-2">
        <summary className="min-h-12 cursor-pointer content-center font-bold">Ver horas do mês e valor da hora extra</summary>
        <p>{hours(employee.monthly_minutes ?? 0)} horas previstas em {employee.monthly_month?.split('-').reverse().join('/') || 'este mês'}.</p>
        <p>Hora extra: {money(employee.overtime_rate_cents)}.</p>
      </details>
      <button
        className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#e1f3e7] px-4 py-3 font-bold text-[#317455] hover:text-[#173d2f]"
        onClick={() => {
          setForm({
            overtime_rate: employee.overtime_rate_cents == null ? '' : (employee.overtime_rate_cents / 100).toFixed(2).replace('.', ','),
            department: employee.department || '',
            job_title: employee.job_title || '',
            work_time: hours(employee.work_minutes),
            workdays: parseWorkdays(employee.workdays),
            break_time: hours(employee.break_minutes ?? 60),
          })
          setError(''); setEditing(true)
        }}
      >
        <FiEdit2 size={18} aria-hidden="true" /> Alterar dias e horas de trabalho
      </button>
    </div>
  )
}
