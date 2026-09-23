import { useEffect, useRef, useState } from 'react'
import Dashboard from './Dashboard'
import EmployeePhoto, { Avatar } from './EmployeePhoto'
import ActionIcon from './ActionIcon'
import WorkCalendar from './WorkCalendar'
import PasswordInput from './PasswordInput'
import ConfirmDialog from './ConfirmDialog'
import { jsPDF } from 'jspdf'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

type Employee = { id: number; name: string; registration: string; department: string; job_title: string; photo: string | null; target_hours: number; work_minutes: number; break_minutes: number; monthly_minutes?: number; workdays?: string; has_pin: boolean; active: boolean }
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

      await Filesystem.writeFile({
        path: `Download/${filename}`,
        data: base64,
        directory: Directory.ExternalStorage,
        recursive: true
      })

      window.dispatchEvent(
        new CustomEvent('file-downloaded', {
          detail: { filename }
        })
      )

      return
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error)

      window.dispatchEvent(
        new CustomEvent('file-download-error')
      )

      return
    }
  }

  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}

export default function App() {
  const [admin, setAdmin] = useState(location.hash.startsWith('#/admin'))
  useEffect(() => { const change = () => setAdmin(location.hash.startsWith('#/admin')); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change) }, [])
  return <main className={`app-shell ${admin ? '' : 'terminal-shell'}`}><div className={`phone-frame ${admin ? 'admin-frame' : 'terminal-frame'}`}><header className="topbar"><div className="brand-mark">PD</div><div><span className="eyebrow">PONTO DIGITAL</span><h1>{admin ? 'Área administrativa' : 'Terminal de ponto'}</h1></div></header>{admin ? <Admin /> : <Terminal />}</div></main>
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
  return <><section className="clock-card"><div className="fingerprint">◷</div><span className="eyebrow light">REGISTRE SUA JORNADA</span><h2>Digite seu PIN</h2><p className="muted light-muted">Digite seu PIN e marque o ponto. Use o PIN a cada batida.</p>
    <form onSubmit={punch} className="pin-form"><label htmlFor="terminal-pin">PIN de 4 números</label><PasswordInput ref={input} id="terminal-pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} minLength={4} required autoComplete="off" value={pin} disabled={busy} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
      <label htmlFor="punch-kind">Tipo de batida</label><select id="punch-kind" value={kind} disabled={busy} onChange={e => { setKind(e.target.value); pending.current = null }}><option value="Entrada">Entrar</option><option value="Saída">Sair</option><option value="start_break">Iniciar intervalo</option><option value="end_break">Fim intervalo</option></select>
      {kind === 'start_break' && <><label htmlFor="interval-type">Tipo de intervalo</label><select id="interval-type" value={intervalType} disabled={busy} onChange={e => { setIntervalType(e.target.value as 'lunch' | 'coffee'); pending.current = null }}><option value="lunch">Almoço</option><option value="coffee">Café</option></select></>}
      <button className="primary-button" disabled={busy || pin.length !== 4}>{busy ? 'Registrando…' : 'Marcar ponto'}</button></form><small>No fim do intervalo, o sistema identifica automaticamente se era almoço ou café.</small></section>
    {error && <p className="error-message feedback" role="alert">{error}</p>}
    {receipt && <section className="receipt" role="status"><div className="receipt-heading"><ActionIcon kind={receipt.kind} breakName={receipt.break_name} /><h2>{receipt.employee_name}</h2></div><p>{receipt.kind}{receipt.break_name ? ` · ${receipt.break_name}` : ''} registrada</p><strong>{timestamp(receipt.occurred_at)}</strong></section>}
    <p className="muted terminal-footer">Horário de Brasília · <a href="#/admin">Acesso do administrador</a></p></>
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

  return (
    <section className="login-page">
      <span className="eyebrow">
        ACESSO RESTRITO
      </span>

      <h2>Entrar como administrador</h2>

      <p className="muted">
        Gerencie funcionários e acompanhe as horas da equipe.
      </p>

      <form
        className="settings-form"
        onSubmit={login}
      >
        <label>
          Usuário

          <input
            required
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </label>

        <label>
          Senha

          <PasswordInput
            required
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        <label className="remember-me">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
          />

          <span>Lembrar de mim por 8 horas</span>
        </label>

        <button
          className="primary-button"
          disabled={busy}
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="error-message"
        >
          {error}
        </p>
      )}

      <a href="#/terminal">
        Voltar ao terminal de ponto
      </a>
    </section>
  )
}
function AdminPanel({ token, onExit }: { token: string; onExit: () => void }) {
  const [tab, setTab] = useState<'dashboard' | 'calendario' | 'funcionarios' | 'relatorios'>('dashboard')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [receivedAt, setReceivedAt] = useState(0)
  const [syncError, setSyncError] = useState(false)
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(day())
  const [selected, setSelected] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState({ name: '', registration: '', department: '', job_title: '', photo: null as string | null, work_time: '07:20', monthly_time: '161:20', break_time: '01:00', workdays: [1, 2, 3, 4, 5] as number[], pin: '' })
  const [photoBusy, setPhotoBusy] = useState(false)
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
        const [people, data] = await Promise.all([api<Employee[]>('/employees', undefined, token), api<Report>(`/reports?from=${from}&to=${to}`, undefined, token)])
        if (active) { setEmployees(people); setReport(data); setReceivedAt(performance.now()); setSyncError(false); setError('') }
      } catch (err) { if (active) { setSyncError(true); fail(err) } }
      finally { fetching = false; if (active) setLoading(false) }
    }
    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 10000)
    const resume = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', resume)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', resume) }
  }, [token, from, to, version])
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
    event.preventDefault(); if (photoBusy) return; setBusy(true); setError('')
    try { await api('/employees', { ...form }, token); setForm({ name: '', registration: '', department: '', job_title: '', photo: null as string | null, work_time: '07:20', monthly_time: '161:20', break_time: '01:00', workdays: [1, 2, 3, 4, 5] as number[], pin: '' }); setVersion(v => v + 1); setNotice('Funcionário cadastrado.') }
    catch (err) { fail(err) } finally { setBusy(false) }
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
  return <>
  {downloadNotice && (
    <div
      className={`download-toast ${
        downloadNotice.type === 'error' ? 'download-toast-error' : ''
      }`}
      role="status"
    >
      <div className="download-toast-icon">
        {downloadNotice.type === 'success' ? '✓' : '!'}
      </div>

      <div className="download-toast-content">
        <strong>
          {downloadNotice.type === 'success'
            ? 'Relatório baixado'
            : 'Erro ao baixar'}
        </strong>

        <span>
          {downloadNotice.type === 'success'
            ? 'Arquivo salvo em Downloads'
            : 'Não foi possível salvar o relatório.'}
        </span>

        {downloadNotice.filename && (
          <small>{downloadNotice.filename}</small>
        )}
      </div>

      <button
        type="button"
        className="download-toast-close"
        onClick={() => setDownloadNotice(null)}
        aria-label="Fechar"
      >
        ×
      </button>
    </div>
  )}

  <div className="admin-toolbar"><a href="#/terminal">Terminal de ponto</a><button className="text-button" disabled={busy} onClick={logout}>Sair da conta</button></div><nav className="admin-tabs">{(['dashboard', 'calendario', 'funcionarios', 'relatorios'] as const).map(key => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{key === 'dashboard' ? 'Dashboard' : key === 'calendario' ? 'Calendário' : key === 'funcionarios' ? 'Funcionários' : 'Relatórios'}</button>)}</nav>
    {error && <div role="alert" className="error-message">{error}<button onClick={() => setVersion(v => v + 1)}>Tentar novamente</button></div>}{notice && <p role="status" className="receipt">{notice}</p>}
    {tab === 'calendario' ? <WorkCalendar employees={employees} request={<T,>(path: string, body?: unknown) => api<T>(path, body, token)} onError={fail} /> : tab === 'funcionarios' ? <><h2>Cadastrar funcionário</h2><form className="settings-form employee-form" onSubmit={saveEmployee}><label>Nome completo<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Função<input required maxLength={120} placeholder="Ex.: cozinheiro, atendente" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></label><label>Horas de trabalho por dia<input required type="time" step="60" value={form.work_time} onChange={e => setForm({ ...form, work_time: e.target.value })} /></label><label>Horas contratadas por mês<input required type="text" inputMode="numeric" pattern="[0-9]{1,3}:[0-5][0-9]" placeholder="Ex.: 176:00" value={form.monthly_time} onChange={e => setForm({ ...form, monthly_time: e.target.value })} /></label><fieldset className="workdays-field"><legend>Dias da semana trabalhados</legend>{[['Domingo',0],['Segunda',1],['Terça',2],['Quarta',3],['Quinta',4],['Sexta',5],['Sábado',6]].map(([label, value]) => <label key={value}><input type="checkbox" checked={form.workdays.includes(Number(value))} onChange={e => setForm(current => ({ ...current, workdays: e.target.checked ? [...current.workdays, Number(value)].sort() : current.workdays.filter(day => day !== Number(value)) }))} />{label}</label>)}</fieldset><label>Tempo esperado de almoço/intervalo<input required type="time" step="60" value={form.break_time} onChange={e => setForm({ ...form, break_time: e.target.value })} /></label><label>PIN exclusivo de 4 números<PasswordInput required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} /></label><EmployeePhoto name={form.name || 'Funcionário'} photo={form.photo} disabled={busy} onBusyChange={setPhotoBusy} onChange={photo => setForm(current => ({ ...current, photo }))} /><button className="primary-button" disabled={busy || photoBusy}>Cadastrar funcionário</button></form><h2>Equipe ({employees.length})</h2>
      {employees.map(employee => <div className="employee-card" key={employee.id}><div><strong>{employee.name}</strong><p>{employee.active ? 'Ativo' : 'Desativado · novas batidas bloqueadas'}</p><EmployeePhoto name={employee.name} photo={employee.photo} onChange={async photo => { try { await api(`/employees/${employee.id}/photo`, { photo }, token); setEmployees(current => current.map(item => item.id === employee.id ? { ...item, photo } : item)); setVersion(v => v + 1); setNotice('Foto atualizada.') } catch (err) { fail(err); throw err } }} /><EmployeeScheduleEditor employee={employee} token={token} onSaved={() => { setVersion(v => v + 1); setNotice('Funcionário atualizado.') }} onError={fail} /><p>{employee.has_pin ? 'PIN cadastrado' : 'PIN pendente: defina para liberar as batidas'}</p></div><div className="employee-actions"><button className="text-button" onClick={() => { setSelected(String(employee.id)); setVersion(v => v + 1); setTab('relatorios') }}>Histórico</button><button className="text-button" onClick={() => { setPinEmployee(String(employee.id)); setNewPin('') }}>Definir PIN</button><button className="text-button" disabled={busy} onClick={() => changeEmployee(employee, 'status')}>{employee.active ? 'Desativar' : 'Reativar'}</button><button className="text-button" disabled={busy} onClick={() => changeEmployee(employee, 'delete')}>Excluir</button></div></div>)}
      {pinEmployee && <form className="settings-form pin-reset" onSubmit={savePin}><h3>Definir PIN de {employees.find(e => String(e.id) === pinEmployee)?.name}</h3><label>Novo PIN<PasswordInput required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} /></label><button className="primary-button" disabled={busy}>Salvar PIN</button><button type="button" className="text-button" onClick={() => setPinEmployee('')}>Cancelar</button></form>}
    </> : <><div className="section-head"><h2>{tab === 'dashboard' ? 'Dashboard de horas' : 'Relatório de horas'}</h2><button className="text-button" disabled={loading} onClick={() => setVersion(v => v + 1)}>Atualizar</button></div><div className="report-filters"><label>De<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Até<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
      {loading ? <p className="empty" role="status">Carregando dados…</p> : report && <>{tab === 'dashboard' ? <Dashboard report={report} receivedAt={receivedAt} syncError={syncError} onHistory={id => { setSelected(String(id)); setVersion(v => v + 1); setTab('relatorios') }} /> : <><label className="employee-selector">Funcionário<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Todos os funcionários</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.registration}</option>)}</select></label><div className="export-actions"><button className="primary-button export-button" onClick={exportExcel}>Baixar Excel</button><button className="secondary-button export-button" onClick={exportPdf}>Baixar PDF</button><button className="text-button" onClick={exportCsv}>CSV</button></div><div className="table-scroll"><table><thead><tr><th>Funcionário</th><th>Previstas</th><th>Serviço</th><th>Devidas</th><th>Intervalo</th><th>Batidas</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.name}<small>{row.registration} · {row.job_title || 'Sem função'}</small></td><td>{hours(Math.floor(row.expected_seconds / 60))}</td><td>{hours(row.minutes)}</td><td className={row.debt_seconds ? 'debt-value' : ''}>{hours(Math.floor(row.debt_seconds / 60))}</td><td>{hours(Math.floor(row.break_seconds / 60))}</td><td>{row.punches}</td></tr>)}</tbody></table></div>{selected && <section className="history-page"><div className="history-employee"><Avatar name={employees.find(e => String(e.id) === selected)?.name || 'Funcionário'} photo={employees.find(e => String(e.id) === selected)?.photo} /><div><h3>Histórico de {employees.find(e => String(e.id) === selected)?.name}</h3><p className="muted">Batidas no período selecionado</p></div></div>{loadingHistory ? <p className="empty">Carregando batidas…</p> : visibleEntries.length === 0 ? <p className="empty">Nenhuma batida no período.</p> : visibleEntries.map(entry => <div className="entry" key={entry.id}><ActionIcon kind={entry.kind} breakName={entry.break_name} /><div><strong>{entry.kind}{entry.break_name ? ` · ${entry.break_name}` : ''}</strong><span>{timestamp(entry.occurred_at)}</span></div></div>)}</section>}</>}
      {report.rows.length === 0 && <p className="empty">Cadastre funcionários para começar.</p>}<p className="muted report-note">Inclui jornadas em andamento e desconta intervalos. Horário de Brasília. Atualizado em {timestamp(report.generated_at)}.</p></>}
    </>}
    {employeeConfirmation && <ConfirmDialog title={employeeConfirmation.action === 'delete' ? 'Excluir funcionário?' : employeeConfirmation.employee.active ? 'Desativar funcionário?' : 'Reativar funcionário?'} message={employeeConfirmation.action === 'delete' ? `Excluir ${employeeConfirmation.employee.name} removerá o cadastro e todas as batidas e registros de escala associados. Essa ação não pode ser desfeita.` : employeeConfirmation.employee.active ? `Desativar ${employeeConfirmation.employee.name}? O cadastro e o histórico serão mantidos, e novas batidas ficarão bloqueadas.` : `Reativar ${employeeConfirmation.employee.name} e liberar novas batidas?`} confirmLabel={employeeConfirmation.action === 'delete' ? 'Excluir permanentemente' : employeeConfirmation.employee.active ? 'Desativar funcionário' : 'Reativar funcionário'} danger={employeeConfirmation.action === 'delete'} busy={busy} onConfirm={() => void confirmEmployeeChange()} onCancel={() => setEmployeeConfirmation(null)} />}
    </>
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
  return editing ? <form className="job-editor" onSubmit={save}><label>Função de {employee.name}<input maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label><button disabled={busy}>Salvar</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button></form> : <p>{employee.job_title || 'Função não informada'} <button className="text-button" onClick={() => { setTitle(employee.job_title || ''); setEditing(true) }}>Editar função</button></p>
}

function EmployeeScheduleEditor({ employee, token, onSaved, onError }: { employee: Employee; token: string; onSaved: () => void; onError: (error: unknown) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ department: employee.department || '', job_title: employee.job_title || '', work_time: hours(employee.work_minutes || employee.target_hours * 60), monthly_time: hours(employee.monthly_minutes ?? 9600), workdays: (() => { try { return JSON.parse(employee.workdays || '[1,2,3,4,5]') as number[] } catch { return [1,2,3,4,5] } })(), break_time: hours(employee.break_minutes ?? 60) })
  const [busy, setBusy] = useState(false)
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try { await api(`/employees/${employee.id}/schedule`, form, token); setEditing(false); onSaved() } catch (err) { onError(err) } finally { setBusy(false) }
  }
  return editing ? <form className="schedule-editor" onSubmit={save}><label>Função<input maxLength={120} value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></label><label>Horas por dia<input required type="time" value={form.work_time} onChange={e => setForm({ ...form, work_time: e.target.value })} /></label><label>Horas por mês<input required type="text" pattern="[0-9]{1,3}:[0-5][0-9]" value={form.monthly_time} onChange={e => setForm({ ...form, monthly_time: e.target.value })} /></label><fieldset className="workdays-field"><legend>Dias trabalhados</legend>{[['Dom',0],['Seg',1],['Ter',2],['Qua',3],['Qui',4],['Sex',5],['Sáb',6]].map(([label, value]) => <label key={value}><input type="checkbox" checked={form.workdays.includes(Number(value))} onChange={e => setForm(current => ({ ...current, workdays: e.target.checked ? [...current.workdays, Number(value)].sort() : current.workdays.filter(day => day !== Number(value)) }))} />{label}</label>)}</fieldset><label>Intervalo esperado<input required type="time" value={form.break_time} onChange={e => setForm({ ...form, break_time: e.target.value })} /></label><button disabled={busy}>Salvar</button><button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button></form> : <p>{employee.job_title || 'Função não informada'} · {hours(employee.work_minutes || employee.target_hours * 60)}/dia · {hours(employee.monthly_minutes ?? 9600)}/mês · {hours(employee.break_minutes ?? 60)} de intervalo <button className="text-button" onClick={() => setEditing(true)}>Editar funcionário</button></p>
}
