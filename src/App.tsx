import {
  FiClock, FiCheck, FiAlertCircle, FiX, FiLogIn, FiLogOut,
  FiUserPlus, FiRefreshCw, FiFileText, FiDownload, FiKey,
  FiUserX, FiUserCheck, FiTrash2, FiEdit2, FiSmartphone
} from 'react-icons/fi'
import { useEffect, useRef, useState } from 'react'
import Dashboard from './Dashboard'
import BottomNav from './BottomNav'
import type { DashboardFilters } from './DashboardFiltersModal'
import SuccessToast from './SuccessToast'
import FormModal from './FormModal'
import { monthlyScheduleMinutes, type ScheduleEvent } from '../shared/schedule.js'
import EmployeePhoto, { Avatar } from './EmployeePhoto'
import ActionIcon from './ActionIcon'
import WorkCalendar from './WorkCalendar'
import PasswordInput from './PasswordInput'
import ConfirmDialog from './ConfirmDialog'
import { jsPDF } from 'jspdf'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

type Employee = { id: number; name: string; registration: string; department: string; job_title: string; photo: string | null; target_hours: number; work_minutes: number; break_minutes: number; monthly_minutes?: number; monthly_month?: string; workdays?: string; has_pin: boolean; active: boolean }
type Entry = { id: number; kind: string; break_name?: string | null; occurred_at: string }
type ReportRow = Employee & { work_seconds: number; break_seconds: number; expected_seconds: number; expected_break_seconds: number; debt_seconds: number; extra_break_seconds: number; current_since: string | null; current_break_name: string | null; break_totals: { name: string; seconds: number }[]; minutes: number; punches: number; status: string }
type Report = { from: string; to: string; generated_at: string; rows: ReportRow[] }
const configuredApiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const base = configuredApiBase ? configuredApiBase.endsWith('/api') ? configuredApiBase : `${configuredApiBase}/api` : '/api'
class ApiError extends Error { constructor(message: string, public status: number) { super(message) } }
async function api<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.error || `Falha na operação (HTTP ${response.status}).`, response.status)
  if (data === null) throw new ApiError('O servidor retornou uma resposta inválida.', response.status)
  return data
}
const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const monthStart = () => `${day().slice(0, 7)}-01`
const timestamp = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const hours = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível acessar o servidor.'
async function deliverFile(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => {
          const result = String(reader.result)
          resolve(result.split(',')[1] || '')
        }

        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })

      const saved = await Filesystem.writeFile({
        path: `reports/${filename}`,
        data: base64,
        directory: Directory.Cache,
        recursive: true
      })

      await Share.share({
        title: filename,
        files: [saved.uri],
        dialogTitle: 'Abrir ou compartilhar relatório'
      })

      window.dispatchEvent(
        new CustomEvent('file-downloaded', {
          detail: { filename }
        })
      )

      return
    } catch (error) {
      // Closing the system chooser is a normal user action.
      if (error && typeof error === 'object' && 'message' in error &&
        /\b(cancelled|canceled)\b/i.test(String(error.message))) return
      console.error('Erro ao baixar arquivo:', error)

      window.dispatchEvent(
        new CustomEvent('file-download-error')
      )

      return
    }
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isMobile && navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type.split(';')[0] })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // If sharing is blocked by the browser, keep the download available.
      }
    }
  }

  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function App() {
  const [admin, setAdmin] = useState(location.hash.startsWith('#/admin'))
  useEffect(() => { const change = () => setAdmin(location.hash.startsWith('#/admin')); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change) }, [])
  return (
    <main className={`min-h-screen bg-[#e9f0ec] bg-[radial-gradient(circle_at_15%_0%,#f7fbf8,transparent_35%)] px-4 py-7 ${admin ? '' : 'min-h-dvh px-2.5 pt-[max(10px,env(safe-area-inset-top))] pb-[max(10px,env(safe-area-inset-bottom))]'}`}>
      <div className={`relative mx-auto rounded-[34px] border border-[#dce8e1] bg-[#f9fbfa] shadow-[0_22px_70px_rgba(155,183,167,0.25)] ${
        admin
          ? 'max-w-[860px] p-6 pb-[calc(116px+env(safe-area-inset-bottom))]'
          : 'max-w-[460px] p-5 sm:p-7'
      }`}>
        <header className="mb-6 flex items-center gap-3">
          <img
            src="/icon-admin.png"
            alt="Ponto Digital"
            className="size-[42px] rounded-[13px] object-cover shadow-sm"
          />
          <div>
            <span className="mb-1 block text-[10px] font-bold tracking-[0.14em] text-[#789185]">
              PONTO DIGITAL
            </span>
            <h1 className="font-['Manrope',sans-serif] text-lg font-extrabold text-[#143f31]">
              {admin ? 'Área administrativa' : 'Terminal de ponto'}
            </h1>
          </div>
        </header>
        {admin ? <Admin /> : <Terminal />}
      </div>
    </main>
  )
}

function Terminal() {
  const [pin, setPin] = useState('')
  const [kind, setKind] = useState('Entrada')
  const [intervalType, setIntervalType] = useState<'lunch' | 'coffee'>('lunch')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<{ employee_name: string; kind: string; break_name?: string | null; occurred_at: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const pending = useRef<string | null>(null)

  useEffect(() => { if (!receipt) return; const timer = setTimeout(() => setReceipt(null), 6000); return () => clearTimeout(timer) }, [receipt])

  async function punch(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setReceipt(null)
    pending.current ||= crypto.randomUUID()
    try {
      setReceipt(await api('/terminal/punch', { pin, kind, interval_type: kind === 'start_break' ? intervalType : undefined, request_id: pending.current }))
      pending.current = null; setKind('Entrada'); setIntervalType('lunch')
    } catch (err) { setError(message(err)); if (err instanceof ApiError) pending.current = null }
    finally { setPin(''); setBusy(false); lock.current = false; input.current?.blur() }
  }

  return (
    <>
      <section className="rounded-[25px] bg-linear-to-br from-[#1e5944] to-[#10382d] p-6 text-center text-[#f7fffa] shadow-[0_15px_26px_rgba(23,75,57,0.25)]">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full border border-[#8fceb1]/60 text-[#bce9c9]">
          <FiClock size={32} aria-hidden="true" />
        </div>
        <span className="mb-1 block text-[10px] font-bold tracking-[0.14em] text-[#a9d6b9]">
          REGISTRE SUA JORNADA
        </span>
        <h2 className="font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-white">
          Digite seu PIN
        </h2>
        <p className="mx-auto mt-1 max-w-[260px] text-xs leading-normal text-[#c1ddcb]">
          Digite seu PIN e marque o ponto. Use o PIN a cada batida.
        </p>

        <form onSubmit={punch} className="mt-5 grid gap-3 text-left">
          <label htmlFor="terminal-pin" className="text-xs font-semibold text-[#d7f1df]">
            PIN de 4 números
          </label>
          <PasswordInput
            ref={input}
            id="terminal-pin"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            minLength={4}
            required
            autoComplete="off"
            value={pin}
            disabled={busy}
            className="rounded-xl border border-[#8fceb1] bg-white p-3 text-center font-['Manrope',sans-serif] text-3xl font-bold tracking-[0.4em] text-[#143229] focus-visible:outline-2 focus-visible:outline-[#cef1d6]"
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          />

          <label htmlFor="punch-kind" className="text-xs font-semibold text-[#d7f1df]">
            Tipo de batida
          </label>
          <select
            id="punch-kind"
            value={kind}
            disabled={busy}
            className="w-full rounded-xl border border-[#8fceb1]/40 bg-white p-3 text-sm text-[#143229] focus-visible:outline-2 focus-visible:outline-[#cef1d6]"
            onChange={e => { setKind(e.target.value); pending.current = null }}
          >
            <option value="Entrada">Entrar</option>
            <option value="Saída">Sair</option>
            <option value="start_break">Iniciar intervalo</option>
            <option value="end_break">Fim intervalo</option>
          </select>

          {kind === 'start_break' && (
            <>
              <label htmlFor="interval-type" className="text-xs font-semibold text-[#d7f1df]">
                Tipo de intervalo
              </label>
              <select
                id="interval-type"
                value={intervalType}
                disabled={busy}
                className="w-full rounded-xl border border-[#8fceb1]/40 bg-white p-3 text-sm text-[#143229] focus-visible:outline-2 focus-visible:outline-[#cef1d6]"
                onChange={e => { setIntervalType(e.target.value as 'lunch' | 'coffee'); pending.current = null }}
              >
                <option value="lunch">Almoço</option>
                <option value="coffee">Café</option>
              </select>
            </>
          )}

          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#cef1d6] p-3.5 text-base font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55"
            disabled={busy || pin.length !== 4}
          >
            <FiCheck size={18} aria-hidden="true" />
            {busy ? 'Registrando…' : 'Marcar ponto'}
          </button>
        </form>
        <small className="mt-3 block text-[10px] text-[#a9d6b9]">
          No fim do intervalo, o sistema identifica automaticamente se era almoço ou café.
        </small>
      </section>

      {error && (
        <p className="mt-4 rounded-xl border border-[#e5b8b8] bg-[#fff0f0] p-3 text-[13px] text-[#913939]" role="alert">
          {error}
        </p>
      )}

      {receipt && (
        <section className="my-4 rounded-2xl bg-[#e1f3e7] p-4 text-[#195235]" role="status">
          <div className="flex items-center gap-3">
            <ActionIcon kind={receipt.kind} breakName={receipt.break_name} />
            <h2 className="font-['Manrope',sans-serif] text-lg font-bold text-[#143f31]">{receipt.employee_name}</h2>
          </div>
          <p className="mt-2 text-xs text-[#246841]">{receipt.kind}{receipt.break_name ? ` · ${receipt.break_name}` : ''} registrada</p>
          <strong className="mt-1 block text-sm font-bold">{timestamp(receipt.occurred_at)}</strong>
        </section>
      )}

      <p className="mt-6 text-center text-xs text-[#82958b]">
        Horário de Brasília ·{' '}
        <a href="#/admin" className="font-semibold text-[#317455] hover:text-[#173d2f]">
          Acesso do administrador
        </a>
      </p>
    </>
  )
}
function Admin() {
  const REMEMBER_DURATION = 8 * 60 * 60 * 1000 // 8 horas

  const [token, setToken] = useState<string | null>(() => {
    const savedToken = localStorage.getItem('admin_token')
    const expiresAt = localStorage.getItem('admin_token_expires')

    if (!savedToken || !expiresAt) {
      return null
    }

    if (Date.now() >= Number(expiresAt)) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_token_expires')
      return null
    }

    return savedToken
  })

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function login(event: React.FormEvent) {
    event.preventDefault()

    setBusy(true)
    setError('')

    try {
      const result = await api<{ token: string }>(
        '/auth/login',
        {
          username,
          password
        }
      )

      setToken(result.token)

      if (rememberMe) {
        const expiresAt = Date.now() + REMEMBER_DURATION

        localStorage.setItem('admin_token', result.token)
        localStorage.setItem(
          'admin_token_expires',
          String(expiresAt)
        )
      } else {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_token_expires')
      }

      setPassword('')
    } catch (err) {
      setError(message(err))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  function exitAdmin() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_token_expires')
    setToken(null)
  }

  if (token) {
    return (
      <AdminPanel
        token={token}
        onExit={exitAdmin}
      />
    )
  }

  const inputClass = "min-w-0 w-full rounded-xl border border-[#cbded2] bg-white p-3 text-sm text-[#315847] focus-visible:outline-2 focus-visible:outline-[#31835b]"
  const labelClass = "grid gap-1.5 text-xs font-bold text-[#527566]"

  return (
    <section className="py-2">
      <span className="mb-1 block text-[10px] font-bold tracking-[0.14em] text-[#789185]">
        ACESSO RESTRITO
      </span>

      <h2 className="font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]">
        Entrar como administrador
      </h2>

      <p className="mt-1 mb-6 text-xs text-[#82958b]">
        Gerencie funcionários e acompanhe as horas da equipe.
      </p>

      <form className="mb-5 grid gap-3.5" onSubmit={login}>
        <label className={labelClass}>
          Usuário
          <input
            required
            autoComplete="username"
            value={username}
            className={inputClass}
            onChange={e => setUsername(e.target.value)}
          />
        </label>

        <label className={labelClass}>
          Senha
          <PasswordInput
            required
            autoComplete="current-password"
            value={password}
            className={inputClass}
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-[#527566]">
          <input
            type="checkbox"
            className="size-4.5 rounded accent-[#317455]"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
          />
          <span>Lembrar de mim por 8 horas</span>
        </label>

        <button
          type="submit"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#cef1d6] p-3.5 text-base font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55"
          disabled={busy}
        >
          <FiLogIn size={18} aria-hidden="true" />
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-[#e5b8b8] bg-[#fff0f0] p-3 text-[13px] text-[#913939]"
        >
          {error}
        </p>
      )}

      <a href="#/terminal" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#317455] hover:text-[#173d2f]">
        <FiSmartphone size={14} aria-hidden="true" />
        Voltar ao terminal de ponto
      </a>
    </section>
  )
}
function AdminPanel({ token, onExit }: { token: string; onExit: () => void }) {
  const [tab, setTab] = useState<'dashboard' | 'calendario' | 'funcionarios' | 'relatorios'>('dashboard')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [monthEvents, setMonthEvents] = useState<ScheduleEvent[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [receivedAt, setReceivedAt] = useState(0)
  const [syncError, setSyncError] = useState(false)
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(day())
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilters>(() => ({ name: '', employeeId: '', job: '', status: '', from: monthStart(), to: day() }))
  const reportFrom = tab === 'relatorios' ? from : dashboardFilters.from
  const reportTo = tab === 'relatorios' ? to : dashboardFilters.to
  const [selected, setSelected] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState({ name: '', registration: '', department: '', job_title: '', photo: null as string | null, work_time: '07:20', break_time: '01:00', workdays: [1, 2, 3, 4, 5] as number[], pin: '' })
  const [photoBusy, setPhotoBusy] = useState(false)
  const [creatingEmployee, setCreatingEmployee] = useState(false)
  const [createError, setCreateError] = useState('')
  const [pinEmployee, setPinEmployee] = useState('')
  const [employeeConfirmation, setEmployeeConfirmation] = useState<{ employee: Employee; action: 'status' | 'delete' } | null>(null)
  const [newPin, setNewPin] = useState('')
  const [downloadNotice, setDownloadNotice] = useState<{
  type: 'success' | 'error'
  filename?: string
} | null>(null)
  const sequence = useRef(0)
  function fail(err: unknown) { if (err instanceof ApiError && err.status === 401) onExit(); else setError(message(err)) }
  useEffect(() => {
    let active = true, fetching = false
    setLoading(true); setError(''); setReport(null); setSyncError(false)
    async function refresh() {
      if (fetching) return
      fetching = true
      try {
        const month = day().slice(0, 7)
        const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()
        const [people, data, events] = await Promise.all([api<Employee[]>('/employees', undefined, token), api<Report>(`/reports?from=${reportFrom}&to=${reportTo}`, undefined, token), api<ScheduleEvent[]>(`/schedule-events?from=${month}-01&to=${month}-${monthEnd}`, undefined, token)])
        // Derive the display from actual days and exceptions, never from the legacy fixed monthly field.
        const calculated = people.map(person => ({ ...person, monthly_month: month, monthly_minutes: monthlyScheduleMinutes(person, month, events) }))
        if (active) { setMonthEvents(events); setEmployees(calculated); setReport(data); setReceivedAt(performance.now()); setSyncError(false); setError('') }
      } catch (err) { if (active) { setSyncError(true); fail(err) } }
      finally { fetching = false; if (active) setLoading(false) }
    }
    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 10000)
    const resume = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', resume)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', resume) }
  }, [token, reportFrom, reportTo, version])
  useEffect(() => {
  function downloaded(event: Event) {
    const customEvent = event as CustomEvent<{ filename: string }>

    setDownloadNotice({
      type: 'success',
      filename: customEvent.detail.filename
    })
  }

  function downloadError() {
    setDownloadNotice({
      type: 'error'
    })
  }

  window.addEventListener('file-downloaded', downloaded)
  window.addEventListener('file-download-error', downloadError)

  return () => {
    window.removeEventListener('file-downloaded', downloaded)
    window.removeEventListener('file-download-error', downloadError)
  }
}, [])

useEffect(() => {
  if (!downloadNotice) return

  const timer = window.setTimeout(() => {
    setDownloadNotice(null)
  }, 4000)

  return () => window.clearTimeout(timer)
}, [downloadNotice])
  useEffect(() => {
    const current = ++sequence.current; setEntries([])
    if (!selected) { setLoadingHistory(false); return }
    setLoadingHistory(true)
    api<Entry[]>(`/employees/${selected}/entries`, undefined, token).then(data => { if (current === sequence.current) setEntries(data) }).catch(err => { if (current === sequence.current) fail(err) }).finally(() => { if (current === sequence.current) setLoadingHistory(false) })
    return () => { sequence.current++ }
  }, [selected, token, version])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer) }, [notice])
  async function saveEmployee(event: React.FormEvent) {
    event.preventDefault(); if (busy || photoBusy) return; setBusy(true); setError(''); setCreateError('')
    try { await api('/employees', { ...form }, token); setForm({ name: '', registration: '', department: '', job_title: '', photo: null as string | null, work_time: '07:20', break_time: '01:00', workdays: [1, 2, 3, 4, 5] as number[], pin: '' }); setVersion(v => v + 1); setCreatingEmployee(false); setNotice('Funcionário cadastrado.') }
    catch (err) { setCreateError(message(err)); if (err instanceof ApiError && err.status === 401) fail(err) } finally { setBusy(false) }
  }
  function changeEmployee(employee: Employee, action: 'status' | 'delete') {
    setEmployeeConfirmation({ employee, action })
  }
  async function confirmEmployeeChange() {
    if (!employeeConfirmation) return
    const { employee, action } = employeeConfirmation
    const deleting = action === 'delete'
    setBusy(true); setError(''); setNotice('')
    try {
      await api(`/employees/${employee.id}/${action}`, deleting ? {} : { active: !employee.active }, token)
      setEmployees(current => deleting ? current.filter(item => item.id !== employee.id) : current.map(item => item.id === employee.id ? { ...item, active: !item.active } : item))
      if (deleting && selected === String(employee.id)) { setSelected(''); setEntries([]) }
      if (pinEmployee === String(employee.id)) { setPinEmployee(''); setNewPin('') }
      setVersion(v => v + 1)
      setNotice(deleting ? 'Funcionário excluído junto com o histórico de batidas.' : employee.active ? 'Funcionário desativado.' : 'Funcionário reativado.')
      setEmployeeConfirmation(null)
    } catch (err) { fail(err) } finally { setBusy(false) }
  }
  async function savePin(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await api(`/employees/${pinEmployee}/pin`, { pin: newPin }, token); setNewPin(''); setPinEmployee(''); setVersion(v => v + 1); setNotice('PIN atualizado.') } catch (err) { fail(err) } finally { setBusy(false) }
  }
  
async function logout() {
  setBusy(true)
  try {
    await api('/auth/logout', {}, token)
  } catch (err) {
    fail(err)
  } finally {
    setBusy(false)
    onExit()
  }
}  function exportCsv() {
    if (!report) return
    const quote = (value: unknown) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`
    const rows = [['Funcionário', 'Matrícula', 'Departamento', 'Função', 'De', 'Até', 'Horas previstas', 'Horas trabalhadas', 'Horas devidas', 'Horas de intervalo', 'Batidas'], ...report.rows.filter(row => !selected || String(row.id) === selected).map(row => [row.name, row.registration, row.department, row.job_title, report.from, report.to, hours(Math.floor(row.expected_seconds / 60)), hours(row.minutes), hours(Math.floor(row.debt_seconds / 60)), hours(Math.floor(row.break_seconds / 60)), row.punches])]
    void deliverFile(new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `horas-${report.from}-${report.to}.csv`)
  }
  function exportExcel() {
    if (!report) return
    const rows = [['Funcionário', 'Matrícula', 'Departamento', 'Função', 'Período', 'Horas previstas', 'Horas trabalhadas', 'Horas devidas', 'Intervalo realizado', 'Intervalo a mais', 'Batidas'], ...report.rows.filter(row => !selected || String(row.id) === selected).map(row => [row.name, row.registration, row.department, row.job_title, `${report.from} a ${report.to}`, hours(Math.floor(row.expected_seconds / 60)), hours(row.minutes), hours(Math.floor(row.debt_seconds / 60)), hours(Math.floor(row.break_seconds / 60)), hours(Math.floor(row.extra_break_seconds / 60)), row.punches])]
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Relatório"><Table>${rows.map(row => `<Row>${row.map(value => `<Cell><Data ss:Type="String">${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`
    void deliverFile(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }), `relatorio-horas-${report.from}-${report.to}.xls`)
  }
  function exportPdf() {
    if (!report) return
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); const filtered = report.rows.filter(row => !selected || String(row.id) === selected)
    pdf.setFontSize(18); pdf.text('Relatório de horas', 14, 16); pdf.setFontSize(10); pdf.text(`Período: ${report.from} a ${report.to}`, 14, 23)
    const headers = ['Funcionário', 'Função', 'Previstas', 'Trabalhadas', 'Devidas', 'Intervalo', 'A mais']; const x = [14, 75, 145, 175, 205, 235, 265]
    pdf.setFillColor(20, 63, 49); pdf.setTextColor(255, 255, 255); pdf.rect(10, 29, 277, 8, 'F'); pdf.setFontSize(9); headers.forEach((header, index) => pdf.text(header, x[index], 34)); pdf.setTextColor(30, 48, 40); let y = 44
    filtered.forEach(row => { if (y > 190) { pdf.addPage('a4', 'landscape'); y = 18 } pdf.text(String(row.name).slice(0, 28), x[0], y); pdf.text(String(row.job_title || 'Sem função').slice(0, 24), x[1], y); pdf.text(hours(Math.floor(row.expected_seconds / 60)), x[2], y); pdf.text(hours(row.minutes), x[3], y); pdf.text(hours(Math.floor(row.debt_seconds / 60)), x[4], y); pdf.text(hours(Math.floor(row.break_seconds / 60)), x[5], y); pdf.text(hours(Math.floor(row.extra_break_seconds / 60)), x[6], y); y += 8 })
    pdf.setFontSize(8); pdf.setTextColor(90, 105, 96); pdf.text('Horas devidas = previstas menos trabalhadas. Intervalo a mais = pausas acima do esperado.', 14, 202); void deliverFile(pdf.output('blob'), `relatorio-horas-${report.from}-${report.to}.pdf`)
  }
  const rows = report?.rows.filter(row => !selected || String(row.id) === selected) || []
  const visibleEntries = entries.filter(entry => { const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(entry.occurred_at)); return date >= from && date <= to }).slice().reverse()
  const inputClass = "min-w-0 w-full rounded-xl border border-[#cbded2] bg-white p-3 text-sm text-[#315847] focus-visible:outline-2 focus-visible:outline-[#31835b]"
  const labelClass = "grid gap-1.5 text-xs font-bold text-[#527566]"

  return (
    <>
      {downloadNotice && (
        <div
          className={`fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-[9999] flex w-[calc(100%-32px)] max-w-[390px] -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#143f31]/12 bg-white px-4 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.12)]`}
          role="status"
        >
          <div className={`flex size-[38px] min-w-[38px] items-center justify-center rounded-full text-xl font-bold text-white ${downloadNotice.type === 'success' ? 'bg-[#143f31]' : 'bg-[#a43b3b]'}`}>
            {downloadNotice.type === 'success' ? <FiCheck size={20} aria-hidden="true" /> : <FiAlertCircle size={20} aria-hidden="true" />}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <strong className={`text-sm font-bold ${downloadNotice.type === 'success' ? 'text-[#143f31]' : 'text-[#a43b3b]'}`}>
              {downloadNotice.type === 'success' ? 'Relatório compartilhado' : 'Erro ao exportar'}
            </strong>

            <span className="text-[13px] text-[#59665f]">
              {downloadNotice.type === 'success' ? 'Arquivo enviado ao aplicativo escolhido.' : 'Não foi possível abrir as opções do relatório.'}
            </span>

            {downloadNotice.filename && (
              <small className="mt-0.75 truncate text-[11px] text-[#8a948f]">{downloadNotice.filename}</small>
            )}
          </div>

          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-transparent p-0 text-[#758079] transition hover:bg-[#f0f3f1]"
            onClick={() => setDownloadNotice(null)}
            aria-label="Fechar"
          >
            <FiX size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <a href="#/terminal" className="flex items-center gap-1.5 text-xs font-bold text-[#317455] hover:text-[#173d2f]">
          <FiSmartphone size={16} aria-hidden="true" />
          Terminal de ponto
        </a>
        <button
          type="button"
          className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f] disabled:opacity-55"
          disabled={busy}
          onClick={logout}
        >
          <FiLogOut size={14} aria-hidden="true" />
          Sair da conta
        </button>
      </div>

      <BottomNav active={tab} onChange={setTab} />

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-[#e5b8b8] bg-[#fff0f0] p-3 text-[13px] text-[#913939]">
          {error}
          <button className="mt-2 block bg-transparent text-inherit underline" onClick={() => setVersion(v => v + 1)}>
            Tentar novamente
          </button>
        </div>
      )}

      {notice ? <SuccessToast message={notice} onClose={() => setNotice('')} /> : null}

      {tab === 'calendario' ? (
        <WorkCalendar employees={employees} onChanged={() => setVersion(v => v + 1)} request={<T,>(path: string, body?: unknown) => api<T>(path, body, token)} onError={fail} />
      ) : tab === 'funcionarios' ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]">Equipe ({employees.length})</h2>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-4 py-2.5 text-xs font-bold text-[#173d2f] transition hover:bg-[#e1f9e6]"
              onClick={() => { setCreateError(''); setCreatingEmployee(true) }}
            >
              <FiUserPlus size={16} aria-hidden="true" />
              Criar funcionário
            </button>
          </div>

          {creatingEmployee && (
            <FormModal title="Criar funcionário" busy={busy || photoBusy} onClose={() => setCreatingEmployee(false)}>
              {createError && (
                <p className="mb-4 rounded-xl border border-[#e5b8b8] bg-[#fff0f0] p-3 text-[13px] text-[#913939]" role="alert">
                  {createError}
                </p>
              )}
              <form className="mt-4 grid gap-3.5 sm:grid-cols-2" onSubmit={saveEmployee}>
                <fieldset className="contents" disabled={busy || photoBusy}>
                  <label className={labelClass}>
                    Nome completo
                    <input autoFocus required maxLength={120} value={form.name} className={inputClass} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </label>
                  <label className={labelClass}>
                    Função
                    <input required maxLength={120} placeholder="Ex.: cozinheiro, atendente" value={form.job_title} className={inputClass} onChange={e => setForm({ ...form, job_title: e.target.value })} />
                  </label>
                  <label className={labelClass}>
                    Horas de trabalho por dia
                    <input required type="time" step="60" value={form.work_time} className={inputClass} onChange={e => setForm({ ...form, work_time: e.target.value })} />
                  </label>
                  <p className="sm:col-span-2 text-xs leading-normal text-[#668174]">
                    As horas do mês são calculadas automaticamente pela jornada e pela escala do calendário.
                  </p>
                  <fieldset className="col-span-full flex flex-wrap gap-x-3 gap-y-2 rounded-xl border border-[#dce8e1] p-3">
                    <legend className="px-1 text-xs font-bold text-[#527566]">Dias da semana trabalhados</legend>
                    {[['Domingo', 0], ['Segunda', 1], ['Terça', 2], ['Quarta', 3], ['Quinta', 4], ['Sexta', 5], ['Sábado', 6]].map(([label, value]) => (
                      <label key={value} className="flex cursor-pointer items-center gap-1.5 text-xs text-[#315847]">
                        <input
                          type="checkbox"
                          className="size-4 rounded accent-[#317455]"
                          checked={form.workdays.includes(Number(value))}
                          onChange={e => setForm(current => ({ ...current, workdays: e.target.checked ? [...current.workdays, Number(value)].sort() : current.workdays.filter(day => day !== Number(value)) }))}
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <label className={labelClass}>
                    Tempo esperado de almoço/intervalo
                    <input required type="time" step="60" value={form.break_time} className={inputClass} onChange={e => setForm({ ...form, break_time: e.target.value })} />
                  </label>
                  <label className={labelClass}>
                    PIN exclusivo de 4 números
                    <PasswordInput required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" value={form.pin} className={inputClass} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} />
                  </label>
                  <div className="sm:col-span-2">
                    <EmployeePhoto name={form.name || 'Funcionário'} photo={form.photo} disabled={busy} onBusyChange={setPhotoBusy} onChange={photo => setForm(current => ({ ...current, photo }))} />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-2">
                    <button type="button" className="bg-transparent px-3 py-2 text-xs font-bold text-[#527566] hover:text-[#173d2f]" disabled={busy || photoBusy} onClick={() => setCreatingEmployee(false)}>
                      Cancelar
                    </button>
                    <button className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-5 py-3 font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55" disabled={busy || photoBusy}>
                      <FiUserPlus size={16} aria-hidden="true" />
                      {busy ? 'Salvando…' : 'Criar funcionário'}
                    </button>
                  </div>
                </fieldset>
              </form>
            </FormModal>
          )}

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
                        setEmployees(current => current.map(item => item.id === employee.id ? { ...item, photo } : item))
                        setVersion(v => v + 1)
                        setNotice('Foto atualizada.')
                      } catch (err) { fail(err); throw err }
                    }}
                  />
                  <EmployeeScheduleEditor
                    employee={employee}
                    token={token}
                    monthEvents={monthEvents}
                    onSaved={updated => {
                      setEmployees(current => current.map(person => person.id === updated.id ? updated : person))
                      setVersion(v => v + 1)
                      setNotice('Funcionário salvo. Horas do mês recalculadas.')
                    }}
                    onError={fail}
                  />
                  <p className="mt-1 text-xs text-[#789185]">
                    {employee.has_pin ? 'PIN cadastrado' : 'PIN pendente: defina para liberar as batidas'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f]" onClick={() => { setSelected(String(employee.id)); setVersion(v => v + 1); setTab('relatorios') }}>
                    <FiClock size={13} aria-hidden="true" />
                    Histórico
                  </button>
                  <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f]" onClick={() => { setPinEmployee(String(employee.id)); setNewPin('') }}>
                    <FiKey size={13} aria-hidden="true" />
                    Definir PIN
                  </button>
                  <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f] disabled:opacity-55" disabled={busy} onClick={() => changeEmployee(employee, 'status')}>
                    {employee.active ? <><FiUserX size={13} aria-hidden="true" /> Desativar</> : <><FiUserCheck size={13} aria-hidden="true" /> Reativar</>}
                  </button>
                  <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#a24636] hover:text-[#7f2d20] disabled:opacity-55" disabled={busy} onClick={() => changeEmployee(employee, 'delete')}>
                    <FiTrash2 size={13} aria-hidden="true" />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>

          {pinEmployee && (
            <form className="mt-5 rounded-2xl bg-[#eaf1ed] p-5 grid gap-3.5" onSubmit={savePin}>
              <h3 className="text-sm font-semibold text-[#143f31]">
                Definir PIN de {employees.find(e => String(e.id) === pinEmployee)?.name}
              </h3>
              <label className={labelClass}>
                Novo PIN
                <PasswordInput required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" value={newPin} className={inputClass} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
              </label>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-5 py-3 font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55" disabled={busy}>
                  <FiKey size={16} aria-hidden="true" />
                  Salvar PIN
                </button>
                <button type="button" className="bg-transparent text-xs font-bold text-[#527566] hover:text-[#173d2f]" onClick={() => setPinEmployee('')}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]">
              {tab === 'dashboard' ? 'Dashboard de horas' : 'Relatório de horas'}
            </h2>
            <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f] disabled:opacity-55" disabled={loading} onClick={() => setVersion(v => v + 1)}>
              <FiRefreshCw size={13} aria-hidden="true" />
              Atualizar
            </button>
          </div>

          {tab === 'relatorios' && (
            <div className="my-5 grid grid-cols-2 gap-3">
              <label className={labelClass}>
                De
                <input type="date" value={from} className={inputClass} onChange={e => setFrom(e.target.value)} />
              </label>
              <label className={labelClass}>
                Até
                <input type="date" value={to} className={inputClass} onChange={e => setTo(e.target.value)} />
              </label>
            </div>
          )}

          {loading ? (
            <p className="px-1 py-4 text-xs text-[#668174]" role="status">Carregando dados…</p>
          ) : report && (
            <>
              {tab === 'dashboard' ? (
                <Dashboard filters={dashboardFilters} onFiltersChange={setDashboardFilters} report={report} receivedAt={receivedAt} syncError={syncError} onHistory={id => { setSelected(String(id)); setVersion(v => v + 1); setTab('relatorios') }} />
              ) : (
                <>
                  <label className="mb-5 grid gap-1.5 text-xs font-bold text-[#527566]">
                    Funcionário
                    <select value={selected} className={inputClass} onChange={e => setSelected(e.target.value)}>
                      <option value="">Todos os funcionários</option>
                      {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.registration}</option>)}
                    </select>
                  </label>

                  <div className="mb-4 flex flex-wrap items-center gap-2.5">
                    <button className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-4 py-2.5 text-xs font-bold text-[#173d2f] transition hover:bg-[#e1f9e6]" onClick={exportExcel}>
                      <FiFileText size={15} aria-hidden="true" />
                      Baixar Excel
                    </button>
                    <button className="flex items-center gap-1.5 rounded-[13px] border border-[#7eae91] bg-[#2a674f] px-4 py-2.5 text-xs font-bold text-[#d7f1df] transition hover:bg-[#347a5e]" onClick={exportPdf}>
                      <FiDownload size={15} aria-hidden="true" />
                      Baixar PDF
                    </button>
                    <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f]" onClick={exportCsv}>
                      <FiDownload size={13} aria-hidden="true" />
                      CSV
                    </button>
                  </div>

                  <div className="my-5 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-[#dce8e1] text-[#527566]">
                          <th className="px-2.5 py-3.5">Funcionário</th>
                          <th className="px-2.5 py-3.5">Previstas</th>
                          <th className="px-2.5 py-3.5">Serviço</th>
                          <th className="px-2.5 py-3.5">Devidas</th>
                          <th className="px-2.5 py-3.5">Intervalo</th>
                          <th className="px-2.5 py-3.5">Batidas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => (
                          <tr key={row.id} className="border-b border-[#dce8e1]">
                            <td className="px-2.5 py-3.5 font-medium text-[#143f31]">
                              {row.name}
                              <small className="mt-1 block text-xs text-[#789185]">{row.registration} · {row.job_title || 'Sem função'}</small>
                            </td>
                            <td className="px-2.5 py-3.5 tabular-nums">{hours(Math.floor(row.expected_seconds / 60))}</td>
                            <td className="px-2.5 py-3.5 tabular-nums">{hours(row.minutes)}</td>
                            <td className={`px-2.5 py-3.5 font-bold tabular-nums ${row.debt_seconds ? 'text-[#a24636]' : ''}`}>{hours(Math.floor(row.debt_seconds / 60))}</td>
                            <td className="px-2.5 py-3.5 tabular-nums">{hours(Math.floor(row.break_seconds / 60))}</td>
                            <td className="px-2.5 py-3.5 tabular-nums">{row.punches}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selected && (
                    <section className="pt-2">
                      <div className="mt-4 mb-3 flex items-center gap-3">
                        <Avatar name={employees.find(e => String(e.id) === selected)?.name || 'Funcionário'} photo={employees.find(e => String(e.id) === selected)?.photo} />
                        <div>
                          <h3 className="text-sm font-semibold text-[#143f31]">Histórico de {employees.find(e => String(e.id) === selected)?.name}</h3>
                          <p className="mt-0.5 text-[11px] text-[#82958b]">Batidas no período selecionado</p>
                        </div>
                      </div>
                      {loadingHistory ? (
                        <p className="px-1 py-4 text-xs text-[#668174]">Carregando batidas…</p>
                      ) : visibleEntries.length === 0 ? (
                        <p className="px-1 py-4 text-xs text-[#668174]">Nenhuma batida no período.</p>
                      ) : (
                        visibleEntries.map(entry => (
                          <div className="flex items-center gap-2.5 border-b border-[#edf0ee] px-1 py-3" key={entry.id}>
                            <ActionIcon kind={entry.kind} breakName={entry.break_name} />
                            <div>
                              <strong className="block text-xs text-[#143f31]">{entry.kind}{entry.break_name ? ` · ${entry.break_name}` : ''}</strong>
                              <span className="block text-[11px] text-[#82958b]">{timestamp(entry.occurred_at)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </section>
                  )}
                </>
              )}

              {report.rows.length === 0 && (
                <p className="px-1 py-4 text-xs text-[#668174]">Cadastre funcionários para começar.</p>
              )}
              <p className="mt-6 text-[11px] leading-relaxed text-[#82958b]">
                Inclui jornadas em andamento e desconta intervalos. Horário de Brasília. Atualizado em {timestamp(report.generated_at)}.
              </p>
            </>
          )}
        </>
      )}

      {employeeConfirmation && (
        <ConfirmDialog
          title={employeeConfirmation.action === 'delete' ? 'Excluir funcionário?' : employeeConfirmation.employee.active ? 'Desativar funcionário?' : 'Reativar funcionário?'}
          message={employeeConfirmation.action === 'delete' ? `Excluir ${employeeConfirmation.employee.name} removerá o cadastro e todas as batidas e registros de escala associados. Essa ação não pode ser desfeita.` : employeeConfirmation.employee.active ? `Desativar ${employeeConfirmation.employee.name}? O cadastro e o histórico serão mantidos, e novas batidas ficarão bloqueadas.` : `Reativar ${employeeConfirmation.employee.name} e liberar novas batidas?`}
          confirmLabel={employeeConfirmation.action === 'delete' ? 'Excluir permanentemente' : employeeConfirmation.employee.active ? 'Desativar funcionário' : 'Reativar funcionário'}
          danger={employeeConfirmation.action === 'delete'}
          busy={busy}
          onConfirm={() => void confirmEmployeeChange()}
          onCancel={() => setEmployeeConfirmation(null)}
        />
      )}
    </>
  )
}

function JobTitleEditor({ employee, token, onSaved, onError }: { employee: Employee; token: string; onSaved: () => void; onError: (error: unknown) => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(employee.job_title || '')
  const [busy, setBusy] = useState(false)
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try { await api(`/employees/${employee.id}/job-title`, { job_title: title }, token); setEditing(false); onSaved() }
    catch (err) { onError(err) } finally { setBusy(false) }
  }
  return editing ? (
    <form className="my-2 flex flex-wrap items-end gap-2" onSubmit={save}>
      <label className="grid gap-1 text-xs font-bold text-[#527566]">
        Função de {employee.name}
        <input maxLength={120} value={title} className="min-w-0 rounded-lg border border-[#cbded2] bg-white p-2 text-xs text-[#315847] focus-visible:outline-2 focus-visible:outline-[#31835b]" onChange={e => setTitle(e.target.value)} />
      </label>
      <button className="flex items-center gap-1 rounded-lg bg-[#cef1d6] px-3 py-2 text-xs font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55" disabled={busy}>
        <FiCheck size={14} aria-hidden="true" />
        Salvar
      </button>
      <button type="button" className="rounded-lg bg-transparent px-2 py-2 text-xs font-bold text-[#527566] hover:text-[#173d2f] disabled:opacity-55" disabled={busy} onClick={() => setEditing(false)}>
        Cancelar
      </button>
    </form>
  ) : (
    <p className="mt-1 text-xs text-[#789185]">
      {employee.job_title || 'Função não informada'}{' '}
      <button className="inline-flex items-center gap-0.5 bg-transparent font-bold text-[#317455] hover:text-[#173d2f]" onClick={() => { setTitle(employee.job_title || ''); setEditing(true) }}>
        <FiEdit2 size={11} aria-hidden="true" />
        Editar função
      </button>
    </p>
  )
}

function EmployeeScheduleEditor({ employee, token, monthEvents, onSaved, onError }: { employee: Employee; token: string; monthEvents: ScheduleEvent[]; onSaved: (employee: Employee) => void; onError: (error: unknown) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ department: employee.department || '', job_title: employee.job_title || '', work_time: hours(employee.work_minutes || employee.target_hours * 60), workdays: (() => { try { return JSON.parse(employee.workdays || '[1,2,3,4,5]') as number[] } catch { return [1,2,3,4,5] } })(), break_time: hours(employee.break_minutes ?? 60) })
  const [busy, setBusy] = useState(false)

  const inputClass = "min-w-0 w-full rounded-lg border border-[#cbded2] bg-white p-2 text-xs text-[#315847] focus-visible:outline-2 focus-visible:outline-[#31835b]"
  const labelClass = "grid gap-1 text-[11px] font-bold text-[#527566]"

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try {
      const minutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m }
      const updated = { ...employee, department: form.department, job_title: form.job_title, work_minutes: minutes(form.work_time), break_minutes: minutes(form.break_time), workdays: JSON.stringify(form.workdays), monthly_month: day().slice(0, 7) }
      updated.monthly_minutes = monthlyScheduleMinutes(updated, updated.monthly_month, monthEvents)
      // Older servers require this field; it is computed, never entered by the user.
      await api(`/employees/${employee.id}/schedule`, { ...form, monthly_time: hours(updated.monthly_minutes) }, token)
      setEditing(false); onSaved(updated)
    } catch (err) { onError(err) } finally { setBusy(false) }
  }
  return editing ? (
    <form className="my-2 grid grid-cols-2 gap-2 rounded-xl border border-[#dce8e1] bg-white p-3" onSubmit={save}>
      <label className={labelClass}>
        Função
        <input maxLength={120} value={form.job_title} className={inputClass} onChange={e => setForm({ ...form, job_title: e.target.value })} />
      </label>
      <label className={labelClass}>
        Horas por dia
        <input required type="time" value={form.work_time} className={inputClass} onChange={e => setForm({ ...form, work_time: e.target.value })} />
      </label>
      <fieldset className="col-span-full flex flex-wrap gap-x-2.5 gap-y-1.5 rounded-lg border border-[#dce8e1] p-2">
        <legend className="px-1 text-[10px] font-bold text-[#527566]">Dias trabalhados</legend>
        {[['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6]].map(([label, value]) => (
          <label key={value} className="flex cursor-pointer items-center gap-1 text-[11px] text-[#315847]">
            <input
              type="checkbox"
              className="size-3.5 rounded accent-[#317455]"
              checked={form.workdays.includes(Number(value))}
              onChange={e => setForm(current => ({ ...current, workdays: e.target.checked ? [...current.workdays, Number(value)].sort() : current.workdays.filter(day => day !== Number(value)) }))}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label className={labelClass}>
        Intervalo esperado
        <input required type="time" value={form.break_time} className={inputClass} onChange={e => setForm({ ...form, break_time: e.target.value })} />
      </label>
      <div className="col-span-full flex items-center justify-end gap-2 pt-1">
        <button type="button" className="bg-transparent px-2 py-1 text-xs font-bold text-[#527566] hover:text-[#173d2f] disabled:opacity-55" disabled={busy} onClick={() => setEditing(false)}>
          Cancelar
        </button>
        <button className="flex items-center gap-1 rounded-lg bg-[#cef1d6] px-3 py-1.5 text-xs font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55" disabled={busy}>
          <FiCheck size={13} aria-hidden="true" />
          Salvar
        </button>
      </div>
    </form>
  ) : (
    <p className="mt-1 text-xs text-[#527566]">
      {employee.job_title || 'Função não informada'} · {hours(employee.work_minutes || employee.target_hours * 60)}/dia · {(() => { try { return (JSON.parse(employee.workdays || '[1,2,3,4,5]') as number[]).map(day => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][day]).join(', ') || 'Por escala'; } catch { return 'Dias não informados'; } })()} · {hours(employee.monthly_minutes ?? 0)} previstas em {employee.monthly_month?.split('-').reverse().join('/') || 'este mês'} · {hours(employee.break_minutes ?? 60)} de intervalo{' '}
      <button className="inline-flex items-center gap-0.5 bg-transparent font-bold text-[#317455] hover:text-[#173d2f]" onClick={() => { setForm({ department: employee.department || '', job_title: employee.job_title || '', work_time: hours(employee.work_minutes), workdays: JSON.parse(employee.workdays || '[1,2,3,4,5]'), break_time: hours(employee.break_minutes ?? 60) }); setEditing(true) }}>
        <FiEdit2 size={11} aria-hidden="true" />
        Editar funcionário
      </button>
    </p>
  )
}
