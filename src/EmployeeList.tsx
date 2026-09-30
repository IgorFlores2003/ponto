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
  work_time: '07:20', break_time: '01:00', overtime_rate: '',
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
  const [search, setSearch] = useState('')
  const [creatingEmployee, setCreatingEmployee] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [pinEmployee, setPinEmployee] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [confirmation, setConfirmation] = useState<{ employee: Employee; action: 'status' | 'delete' } | null>(null)
  const [localBusy, setLocalBusy] = useState(false)

  const isBusy = busy || localBusy
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  const visibleEmployees = employees.filter(employee => normalize(`${employee.name} ${employee.job_title}`).includes(normalize(search.trim())))

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
    setLocalBusy(true); setPinError('')
    try {
      await api(`/employees/${pinEmployee}/pin`, { pin: newPin }, token)
      setNewPin('')
      setPinEmployee('')
      onVersionBump()
      onNotice('Senha do ponto atualizada.')
    } catch (err) {
      setPinError(errorMessage(err)); onError(err)
    } finally {
      setLocalBusy(false)
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]">
          Cadastro de funcionários
        </h2>
        <button
          type="button"
          className="flex min-h-12 items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-4 py-2.5 text-sm font-bold text-[#173d2f] transition hover:bg-[#e1f9e6]"
          onClick={() => { setCreateError(''); setCreatingEmployee(true) }}
        >
          <FiUserPlus size={16} aria-hidden="true" /> Cadastrar funcionário
        </button>
      </div>

      <p className="mb-4 text-base leading-relaxed text-[#315847]">Cadastre uma pessoa nova ou encontre um funcionário para alterar os dias e as horas de trabalho.</p>
      <label className={`${LABEL_CLASS} mb-5`}>
        Procurar funcionário
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} className={INPUT_CLASS} placeholder="Digite o nome ou a função" />
      </label>
      <p className="mb-3 text-sm text-[#315847]" role="status">{visibleEmployees.length} funcionário(s) encontrado(s)</p>
      {visibleEmployees.length === 0 && <p className="rounded-xl bg-[#eaf5ee] p-4 text-base text-[#315847]">{employees.length ? 'Nenhum nome encontrado. Tente outro nome ou apague a busca.' : 'Comece pelo botão “Cadastrar funcionário” acima.'}</p>}

      {/* Modal de criação */}
      {creatingEmployee && (
        <FormModal title="Cadastrar funcionário" busy={isBusy || photoBusy} onClose={() => setCreatingEmployee(false)}>
          {createError && (
            <p className="mb-4 rounded-xl border border-[#e5b8b8] bg-[#fff0f0] p-3 text-base text-[#913939]" role="alert">
              {createError}
            </p>
          )}
          <p className="mt-2 text-base leading-relaxed text-[#315847]">Preencha as três partes abaixo. Os campos opcionais estão identificados.</p>
          {pinError && <p role="alert" className="rounded-xl bg-[#fff0f0] p-3 text-base text-[#913939]">{pinError}</p>}
        <form className="mt-5 grid gap-5 sm:grid-cols-2" onSubmit={saveEmployee}>
            <fieldset className="contents" disabled={isBusy || photoBusy}>
              <h3 className="col-span-full rounded-xl bg-[#eaf5ee] p-3 text-lg font-bold text-[#234c37]">1. Quem é o funcionário?</h3>
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
              <h3 className="col-span-full mt-2 rounded-xl bg-[#eaf5ee] p-3 text-lg font-bold text-[#234c37]">2. Qual é a rotina de trabalho?</h3>
              <label className={LABEL_CLASS}>
                Quantas horas trabalha por dia?
                <input required type="time" step="60" value={form.work_time} className={INPUT_CLASS}
                  onChange={e => setForm({ ...form, work_time: e.target.value })} />
                <span className="font-normal">Exemplo: 07:20 significa 7 horas e 20 minutos de trabalho, sem contar o intervalo.</span>
              </label>
              <p className="text-sm leading-normal text-[#466451] sm:col-span-2">
                As horas do mês são calculadas automaticamente pela jornada e pela escala do calendário.
              </p>
              <fieldset className="col-span-full flex flex-wrap gap-x-3 gap-y-2 rounded-xl border border-[#dce8e1] p-3">
                <legend className="px-1 text-sm font-bold text-[#527566]">Em quais dias costuma trabalhar?</legend>
                {WEEKDAYS.map(([label, value]) => (
                  <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[#9fbaa9] bg-white px-3 text-base text-[#315847] has-[:checked]:bg-[#e1f3e7]">
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
              <p className="col-span-full text-sm leading-relaxed text-[#315847]">Marque os dias habituais. Para sábados alternados e mudanças só neste mês, use o Calendário depois de cadastrar.</p>
              <label className={LABEL_CLASS}>
                Quanto tempo tem de intervalo?
                <input required type="time" step="60" value={form.break_time} className={INPUT_CLASS}
                  onChange={e => setForm({ ...form, break_time: e.target.value })} />
              </label>
              <label className={LABEL_CLASS}>
                Valor de uma hora extra (opcional)
                <input inputMode="decimal" pattern="[0-9]{1,6}([.,][0-9]{1,2})?" placeholder="Ex.: 25,50" value={form.overtime_rate}
                  className={INPUT_CLASS} onChange={e => setForm({ ...form, overtime_rate: e.target.value })} />
                <span className="font-normal">Valor final por hora trabalhada na folga. Opcional.</span>
              </label>
              <h3 className="col-span-full mt-2 rounded-xl bg-[#eaf5ee] p-3 text-lg font-bold text-[#234c37]">3. Senha para bater o ponto</h3>
              <label className={LABEL_CLASS}>
                Crie uma senha de 4 números
                <PasswordInput required inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
                  autoComplete="new-password" value={form.pin} className={INPUT_CLASS}
                  onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
                <span className="font-normal">O funcionário digita essa senha para registrar entrada e saída. Cada pessoa precisa ter uma senha diferente.</span>
              </label>
              <div className="sm:col-span-2">
                <h4 className="text-base font-bold text-[#315847]">Foto do funcionário (opcional)</h4>
                <EmployeePhoto name={form.name || 'Funcionário'} photo={form.photo}
                  disabled={isBusy} onBusyChange={setPhotoBusy}
                  onChange={photo => setForm(f => ({ ...f, photo }))} />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 sm:col-span-2">
                <button type="button" disabled={isBusy || photoBusy}
                  className="min-h-12 rounded-xl border border-[#cbded2] bg-white px-4 py-3 text-sm font-bold text-[#527566] hover:text-[#173d2f]"
                  onClick={() => setCreatingEmployee(false)}>
                  Cancelar
                </button>
                <button disabled={isBusy || photoBusy}
                  className="flex min-h-12 items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-5 py-3 font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55">
                  <FiUserPlus size={16} aria-hidden="true" />
                  {isBusy ? 'Salvando…' : 'Salvar cadastro'}
                </button>
              </div>
            </fieldset>
          </form>
        </FormModal>
      )}

      {/* Lista de funcionários */}
      <div className="min-w-0 divide-y divide-[#e2ebe5]">
        {visibleEmployees.map(employee => (
          <div className="mb-4 flex min-w-0 flex-col items-stretch gap-3 rounded-2xl border border-[#cbded2] bg-white p-4" key={employee.id}>
            <div className="min-w-0">
              <strong className="block min-w-0 [overflow-wrap:anywhere] text-lg font-semibold text-[#143f31]">{employee.name}</strong>
              <p className="mt-0.5 text-sm text-[#527566]">
                {employee.active ? 'Ativo' : 'Desativado · novas batidas bloqueadas'}
              </p>
              <details className="my-3 rounded-xl border border-[#cbded2] bg-white p-3">
                <summary className="min-h-12 cursor-pointer content-center text-base font-bold text-[#315847]">Ver ou alterar a foto</summary>
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
              </details>
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
              <p className="mt-1 text-sm text-[#527566]">
                {employee.has_pin ? 'Senha do ponto cadastrada' : 'Falta cadastrar a senha para bater o ponto'}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
              <button className="flex min-h-12 items-center gap-1 bg-transparent text-sm font-bold text-[#317455] hover:text-[#173d2f]"
                onClick={() => onHistory(employee.id)}>
                <FiClock size={13} aria-hidden="true" /> Ver batidas de ponto
              </button>
              <button className="flex min-h-12 items-center gap-1 bg-transparent text-sm font-bold text-[#317455] hover:text-[#173d2f]"
                onClick={() => { setPinEmployee(String(employee.id)); setNewPin(''); setPinError('') }}>
                <FiKey size={13} aria-hidden="true" /> Alterar senha do ponto
              </button>
              <details className="w-full rounded-xl border border-[#dce8e1] p-3">
                <summary className="min-h-12 cursor-pointer content-center text-base font-bold text-[#527566]">Outras opções: desativar ou excluir</summary>
                <div className="flex flex-wrap gap-4 pt-2">
              <button disabled={isBusy}
                className="flex min-h-12 items-center gap-1 bg-transparent text-sm font-bold text-[#317455] hover:text-[#173d2f] disabled:opacity-55"
                onClick={() => setConfirmation({ employee, action: 'status' })}>
                {employee.active
                  ? <><FiUserX size={13} aria-hidden="true" /> Desativar</>
                  : <><FiUserCheck size={13} aria-hidden="true" /> Reativar</>}
              </button>
              <button disabled={isBusy}
                className="flex min-h-12 items-center gap-1 bg-transparent text-sm font-bold text-[#a24636] hover:text-[#7f2d20] disabled:opacity-55"
                onClick={() => setConfirmation({ employee, action: 'delete' })}>
                <FiTrash2 size={13} aria-hidden="true" /> Excluir
              </button>
                </div>
              </details>
            </div>
          </div>
        ))}
      </div>

      {/* Formulário de PIN */}
      {pinEmployee && (
        <FormModal title="Alterar senha do ponto" busy={isBusy} onClose={() => setPinEmployee('')}>
        {pinError && <p role="alert" className="rounded-xl bg-[#fff0f0] p-3 text-base text-[#913939]">{pinError}</p>}
        <form className="mt-5 grid gap-3.5 rounded-2xl bg-[#eaf1ed] p-5" onSubmit={savePin}>
          <h3 className="min-w-0 [overflow-wrap:anywhere] text-sm font-semibold text-[#143f31]">
            Senha de {employees.find(e => String(e.id) === pinEmployee)?.name}
          </h3>
          <label className={LABEL_CLASS}>
            Nova senha de 4 números
            <PasswordInput required disabled={isBusy} inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
              autoComplete="new-password" value={newPin} className={INPUT_CLASS}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
          </label>
          <div className="flex min-h-12 items-center gap-3">
            <button disabled={isBusy}
              className="flex min-h-12 items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-5 py-3 font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55">
              <FiKey size={16} aria-hidden="true" /> Salvar senha
            </button>
            <button type="button" disabled={isBusy} className="min-h-12 rounded-xl border border-[#9fbaa9] px-4 text-sm font-bold text-[#527566] hover:text-[#173d2f]"
              onClick={() => setPinEmployee('')}>
              Cancelar
            </button>
          </div>
        </form>
        </FormModal>
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
