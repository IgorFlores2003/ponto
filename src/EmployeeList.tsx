import { useState } from 'react'
import { FiUserPlus, FiClock, FiKey, FiUserX, FiUserCheck, FiTrash2 } from 'react-icons/fi'
import EmployeePhoto from './EmployeePhoto'
import EmployeeScheduleEditor from './EmployeeScheduleEditor'
import PasswordInput from './PasswordInput'
import FormModal from './FormModal'
import ConfirmDialog from './ConfirmDialog'
import { api, errorMessage, ApiError, INPUT_CLASS, LABEL_CLASS, type Employee } from './types'
import type { ScheduleEvent } from '../shared/schedule.js'

interface Props {
  employees: Employee[]
  monthEvents: ScheduleEvent[]
  token: string
  busy: boolean
  onEmployeesChange: (employees: Employee[]) => void
  onNotice: (msg: string) => void
  onError: (err: unknown) => void
  onHistory: (id: number) => void
  onVersionBump: () => void
}

const EMPTY_FORM = {
  name: '', registration: '', department: '', job_title: '',
  photo: null as string | null,
  work_time: '07:20', break_time: '01:00',
  workdays: [1, 2, 3, 4, 5] as number[], pin: '',
}

const WEEKDAYS: [string, number][] = [
  ['Domingo', 0], ['Segunda', 1], ['Terça', 2], ['Quarta', 3],
  ['Quinta', 4], ['Sexta', 5], ['Sábado', 6],
]

/** Tab de gestão de funcionários: listagem, criação, PIN e ações de status. */
export default function EmployeeList({
  employees, monthEvents, token, busy, onEmployeesChange, onNotice, onError, onHistory, onVersionBump,
}: Props) {
  const [creatingEmployee, setCreatingEmployee] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [pinEmployee, setPinEmployee] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmation, setConfirmation] = useState<{ employee: Employee; action: 'status' | 'delete' } | null>(null)
  const [localBusy, setLocalBusy] = useState(false)

  const isBusy = busy || localBusy

  async function saveEmployee(event: React.FormEvent) {
    event.preventDefault()
    if (isBusy || photoBusy) return
    setLocalBusy(true)
    setCreateError('')
    try {
      await api('/employees', { ...form }, token)
      setForm(EMPTY_FORM)
      onVersionBump()
      setCreatingEmployee(false)
      onNotice('Funcionário cadastrado.')
    } catch (err) {
      setCreateError(errorMessage(err))
      if (err instanceof ApiError && err.status === 401) onError(err)
    } finally {
      setLocalBusy(false)
    }
  }

  async function confirmChange() {
    if (!confirmation) return
    const { employee, action } = confirmation
    const deleting = action === 'delete'
    setLocalBusy(true)
    try {
      await api(`/employees/${employee.id}/${action}`, deleting ? {} : { active: !employee.active }, token)
      if (deleting) {
        onEmployeesChange(employees.filter(e => e.id !== employee.id))
      } else {
        onEmployeesChange(employees.map(e => e.id === employee.id ? { ...e, active: !e.active } : e))
      }
      onVersionBump()
      onNotice(
        deleting
          ? 'Funcionário excluído junto com o histórico de batidas.'
          : employee.active
            ? 'Funcionário desativado.'
            : 'Funcionário reativado.',
      )
      setConfirmation(null)
    } catch (err) {
      onError(err)
    } finally {
      setLocalBusy(false)
    }
  }

  async function savePin(event: React.FormEvent) {
    event.preventDefault()
    setLocalBusy(true)
    try {
      await api(`/employees/${pinEmployee}/pin`, { pin: newPin }, token)
      setNewPin('')
      setPinEmployee('')
      onVersionBump()
      onNotice('PIN atualizado.')
    } catch (err) {
      onError(err)
    } finally {
      setLocalBusy(false)
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]">
          Equipe ({employees.length})
        </h2>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-4 py-2.5 text-xs font-bold text-[#173d2f] transition hover:bg-[#e1f9e6]"
          onClick={() => { setCreateError(''); setCreatingEmployee(true) }}
        >
          <FiUserPlus size={16} aria-hidden="true" /> Criar funcionário
        </button>
      </div>

      {/* Modal de criação */}
      {creatingEmployee && (
        <FormModal title="Criar funcionário" busy={isBusy || photoBusy} onClose={() => setCreatingEmployee(false)}>
          {createError && (
            <p className="mb-4 rounded-xl border border-[#e5b8b8] bg-[#fff0f0] p-3 text-[13px] text-[#913939]" role="alert">
              {createError}
            </p>
          )}
          <form className="mt-4 grid gap-3.5 sm:grid-cols-2" onSubmit={saveEmployee}>
            <fieldset className="contents" disabled={isBusy || photoBusy}>
              <label className={LABEL_CLASS}>
                Nome completo
                <input autoFocus required maxLength={120} value={form.name} className={INPUT_CLASS}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className={LABEL_CLASS}>
                Função
                <input required maxLength={120} placeholder="Ex.: cozinheiro, atendente" value={form.job_title}
                  className={INPUT_CLASS} onChange={e => setForm({ ...form, job_title: e.target.value })} />
              </label>
              <label className={LABEL_CLASS}>
                Horas de trabalho por dia
                <input required type="time" step="60" value={form.work_time} className={INPUT_CLASS}
                  onChange={e => setForm({ ...form, work_time: e.target.value })} />
              </label>
              <p className="text-xs leading-normal text-[#668174] sm:col-span-2">
                As horas do mês são calculadas automaticamente pela jornada e pela escala do calendário.
              </p>
              <fieldset className="col-span-full flex flex-wrap gap-x-3 gap-y-2 rounded-xl border border-[#dce8e1] p-3">
                <legend className="px-1 text-xs font-bold text-[#527566]">Dias da semana trabalhados</legend>
                {WEEKDAYS.map(([label, value]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-1.5 text-xs text-[#315847]">
                    <input type="checkbox" className="size-4 rounded accent-[#317455]"
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
              <label className={LABEL_CLASS}>
                Tempo esperado de almoço/intervalo
                <input required type="time" step="60" value={form.break_time} className={INPUT_CLASS}
                  onChange={e => setForm({ ...form, break_time: e.target.value })} />
              </label>
              <label className={LABEL_CLASS}>
                PIN exclusivo de 4 números
                <PasswordInput required inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
                  autoComplete="new-password" value={form.pin} className={INPUT_CLASS}
                  onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
              </label>
              <div className="sm:col-span-2">
                <EmployeePhoto name={form.name || 'Funcionário'} photo={form.photo}
                  disabled={isBusy} onBusyChange={setPhotoBusy}
                  onChange={photo => setForm(f => ({ ...f, photo }))} />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 sm:col-span-2">
                <button type="button" disabled={isBusy || photoBusy}
                  className="bg-transparent px-3 py-2 text-xs font-bold text-[#527566] hover:text-[#173d2f]"
                  onClick={() => setCreatingEmployee(false)}>
                  Cancelar
                </button>
                <button disabled={isBusy || photoBusy}
                  className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-5 py-3 font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55">
                  <FiUserPlus size={16} aria-hidden="true" />
                  {isBusy ? 'Salvando…' : 'Criar funcionário'}
                </button>
              </div>
            </fieldset>
          </form>
        </FormModal>
      )}

      {/* Lista de funcionários */}
      <div className="divide-y divide-[#e2ebe5]">
        {employees.map(employee => (
          <div className="flex flex-wrap items-center justify-between gap-3 py-4" key={employee.id}>
            <div className="min-w-0">
              <strong className="text-sm font-semibold text-[#143f31]">{employee.name}</strong>
              <p className="mt-0.5 text-xs text-[#789185]">
                {employee.active ? 'Ativo' : 'Desativado · novas batidas bloqueadas'}
              </p>
              <EmployeePhoto
                name={employee.name}
                photo={employee.photo}
                onChange={async photo => {
                  try {
                    await api(`/employees/${employee.id}/photo`, { photo }, token)
                    onEmployeesChange(employees.map(e => e.id === employee.id ? { ...e, photo } : e))
                    onVersionBump()
                    onNotice('Foto atualizada.')
                  } catch (err) { onError(err); throw err }
                }}
              />
              <EmployeeScheduleEditor
                employee={employee}
                token={token}
                monthEvents={monthEvents}
                onSaved={updated => {
                  onEmployeesChange(employees.map(e => e.id === updated.id ? updated : e))
                  onVersionBump()
                  onNotice('Funcionário salvo. Horas do mês recalculadas.')
                }}
                onError={onError}
              />
              <p className="mt-1 text-xs text-[#789185]">
                {employee.has_pin ? 'PIN cadastrado' : 'PIN pendente: defina para liberar as batidas'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f]"
                onClick={() => onHistory(employee.id)}>
                <FiClock size={13} aria-hidden="true" /> Histórico
              </button>
              <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f]"
                onClick={() => { setPinEmployee(String(employee.id)); setNewPin('') }}>
                <FiKey size={13} aria-hidden="true" /> Definir PIN
              </button>
              <button disabled={isBusy}
                className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f] disabled:opacity-55"
                onClick={() => setConfirmation({ employee, action: 'status' })}>
                {employee.active
                  ? <><FiUserX size={13} aria-hidden="true" /> Desativar</>
                  : <><FiUserCheck size={13} aria-hidden="true" /> Reativar</>}
              </button>
              <button disabled={isBusy}
                className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#a24636] hover:text-[#7f2d20] disabled:opacity-55"
                onClick={() => setConfirmation({ employee, action: 'delete' })}>
                <FiTrash2 size={13} aria-hidden="true" /> Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Formulário de PIN */}
      {pinEmployee && (
        <form className="mt-5 grid gap-3.5 rounded-2xl bg-[#eaf1ed] p-5" onSubmit={savePin}>
          <h3 className="text-sm font-semibold text-[#143f31]">
            Definir PIN de {employees.find(e => String(e.id) === pinEmployee)?.name}
          </h3>
          <label className={LABEL_CLASS}>
            Novo PIN
            <PasswordInput required inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
              autoComplete="new-password" value={newPin} className={INPUT_CLASS}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
          </label>
          <div className="flex items-center gap-3">
            <button disabled={isBusy}
              className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-5 py-3 font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55">
              <FiKey size={16} aria-hidden="true" /> Salvar PIN
            </button>
            <button type="button" className="bg-transparent text-xs font-bold text-[#527566] hover:text-[#173d2f]"
              onClick={() => setPinEmployee('')}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Diálogo de confirmação de ação */}
      {confirmation && (
        <ConfirmDialog
          title={
            confirmation.action === 'delete' ? 'Excluir funcionário?'
            : confirmation.employee.active ? 'Desativar funcionário?' : 'Reativar funcionário?'
          }
          message={
            confirmation.action === 'delete'
              ? `Excluir ${confirmation.employee.name} removerá o cadastro e todas as batidas e registros de escala associados. Essa ação não pode ser desfeita.`
              : confirmation.employee.active
                ? `Desativar ${confirmation.employee.name}? O cadastro e o histórico serão mantidos, e novas batidas ficarão bloqueadas.`
                : `Reativar ${confirmation.employee.name} e liberar novas batidas?`
          }
          confirmLabel={
            confirmation.action === 'delete' ? 'Excluir permanentemente'
            : confirmation.employee.active ? 'Desativar funcionário' : 'Reativar funcionário'
          }
          danger={confirmation.action === 'delete'}
          busy={isBusy}
          onConfirm={() => void confirmChange()}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </>
  )
}
