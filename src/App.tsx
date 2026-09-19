import { useEffect, useRef, useState } from 'react'
import Dashboard from './Dashboard'
import BreakSettings from './BreakSettings'
import PasswordInput from './PasswordInput'

type Employee = { id: number; name: string; registration: string; department: string; job_title: string; target_hours: number; has_pin: boolean }
type Entry = { id: number; kind: string; break_name?: string | null; occurred_at: string }
type ReportRow = Employee & { work_seconds: number; break_seconds: number; current_since: string | null; current_break_name: string | null; break_totals: { name: string; seconds: number }[]; minutes: number; punches: number; status: string }
type Report = { from: string; to: string; generated_at: string; rows: ReportRow[] }
const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
class ApiError extends Error { constructor(message: string, public status: number) { super(message) } }
async function api<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  if (response.status === 204) return undefined as T
  const data = await response.json()
  if (!response.ok) throw new ApiError(data.error || 'Falha na operação.', response.status)
  return data
}
const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const timestamp = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const hours = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível acessar o servidor.'

export default function App() {
  const [admin, setAdmin] = useState(location.hash.startsWith('#/admin'))
  useEffect(() => { const change = () => setAdmin(location.hash.startsWith('#/admin')); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change) }, [])
  return <main className={`app-shell ${admin ? '' : 'terminal-shell'}`}><div className={`phone-frame ${admin ? 'admin-frame' : 'terminal-frame'}`}><header className="topbar"><div className="brand-mark">PD</div><div><span className="eyebrow">PONTO DIGITAL</span><h1>{admin ? 'Área administrativa' : 'Terminal de ponto'}</h1></div></header>{admin ? <Admin /> : <Terminal />}</div></main>
}
function Terminal() {
  const [pin, setPin] = useState('')
  const [kind, setKind] = useState('auto')
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
      setReceipt(await api('/terminal/punch', { pin, kind, request_id: pending.current }))
      pending.current = null; setKind('auto')
    } catch (err) { setError(message(err)); if (err instanceof ApiError) pending.current = null }
    finally { setPin(''); setBusy(false); lock.current = false; input.current?.blur() }
  }
  return <><section className="clock-card"><div className="fingerprint">◷</div><span className="eyebrow light">REGISTRE SUA JORNADA</span><h2>Digite seu PIN</h2><p className="muted light-muted">Digite seu PIN e marque o ponto. Use o PIN a cada batida.</p>
    <form onSubmit={punch} className="pin-form"><label htmlFor="terminal-pin">PIN de 4 números</label><PasswordInput ref={input} id="terminal-pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} minLength={4} required autoComplete="off" value={pin} disabled={busy} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
      <label htmlFor="punch-kind">Tipo de batida</label><select id="punch-kind" value={kind} disabled={busy} onChange={e => { setKind(e.target.value); pending.current = null }}><option value="auto">Automático: jornada e pausas</option><option value="Entrada">Entrada</option><option value="Saída">Saída</option><option value="Início do intervalo">Iniciar intervalo</option><option value="Fim do intervalo">Voltar do intervalo</option></select>
      <button className="primary-button" disabled={busy || pin.length !== 4}>{busy ? 'Registrando…' : 'Marcar ponto'}</button></form><small>No automático, as pausas seguem os horários cadastrados. A próxima batida registra o retorno.</small></section>
    {error && <p className="error-message feedback" role="alert">{error}</p>}
    {receipt && <section className="receipt" role="status"><h2>✓ {receipt.employee_name}</h2><p>{receipt.kind}{receipt.break_name ? ` · ${receipt.break_name}` : ''} registrada</p><strong>{timestamp(receipt.occurred_at)}</strong></section>}
    <p className="muted terminal-footer">Horário de Brasília · <a href="#/admin">Acesso do administrador</a></p></>
}
function Admin() {
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { const result = await api<{ token: string }>('/auth/login', { username, password }); setToken(result.token); setPassword('') }
    catch (err) { setError(message(err)); setPassword('') } finally { setBusy(false) }
  }
  if (token) return <AdminPanel token={token} onExit={() => setToken(null)} />
  return <section className="login-page"><span className="eyebrow">ACESSO RESTRITO</span><h2>Entrar como administrador</h2><p className="muted">Gerencie funcionários e acompanhe as horas da equipe.</p><form className="settings-form" onSubmit={login}><label>Usuário<input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} /></label><label>Senha<PasswordInput required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label><button className="primary-button" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button></form>{error && <p role="alert" className="error-message">{error}</p>}<a href="#/terminal">Voltar ao terminal de ponto</a></section>
}
function AdminPanel({ token, onExit }: { token: string; onExit: () => void }) {
  const [tab, setTab] = useState<'dashboard' | 'funcionarios' | 'relatorios' | 'pausas'>('dashboard')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [receivedAt, setReceivedAt] = useState(0)
  const [syncError, setSyncError] = useState(false)
  const [from, setFrom] = useState(day())
  const [to, setTo] = useState(day())
  const [selected, setSelected] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState({ name: '', registration: '', department: '', job_title: '', target_hours: '8', pin: '' })
  const [pinEmployee, setPinEmployee] = useState('')
  const [newPin, setNewPin] = useState('')
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
    const current = ++sequence.current; setEntries([])
    if (!selected) { setLoadingHistory(false); return }
    setLoadingHistory(true)
    api<Entry[]>(`/employees/${selected}/entries`, undefined, token).then(data => { if (current === sequence.current) setEntries(data) }).catch(err => { if (current === sequence.current) fail(err) }).finally(() => { if (current === sequence.current) setLoadingHistory(false) })
    return () => { sequence.current++ }
  }, [selected, token, version])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer) }, [notice])
  async function saveEmployee(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await api('/employees', { ...form, target_hours: Number(form.target_hours) }, token); setForm({ name: '', registration: '', department: '', job_title: '', target_hours: '8', pin: '' }); setVersion(v => v + 1); setNotice('Funcionário cadastrado.') }
    catch (err) { fail(err) } finally { setBusy(false) }
  }
  async function savePin(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await api(`/employees/${pinEmployee}/pin`, { pin: newPin }, token); setNewPin(''); setPinEmployee(''); setVersion(v => v + 1); setNotice('PIN atualizado.') } catch (err) { fail(err) } finally { setBusy(false) }
  }
  async function logout() { setBusy(true); try { await api('/auth/logout', {}, token); onExit() } catch (err) { fail(err) } finally { setBusy(false) } }
  function exportCsv() {
    if (!report) return
    const quote = (value: unknown) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`
    const rows = [['Funcionário', 'Matrícula', 'Departamento', 'Função', 'De', 'Até', 'Horas trabalhadas', 'Horas de intervalo', 'Batidas'], ...report.rows.filter(row => !selected || String(row.id) === selected).map(row => [row.name, row.registration, row.department, row.job_title, report.from, report.to, hours(row.minutes), hours(Math.floor(row.break_seconds / 60)), row.punches])]
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = `horas-${report.from}-${report.to}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const rows = report?.rows.filter(row => !selected || String(row.id) === selected) || []
  const visibleEntries = entries.filter(entry => { const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(entry.occurred_at)); return date >= from && date <= to }).slice().reverse()
  return <><div className="admin-toolbar"><a href="#/terminal">Terminal de ponto</a><button className="text-button" disabled={busy} onClick={logout}>Sair da conta</button></div><nav className="admin-tabs">{(['dashboard', 'funcionarios', 'relatorios', 'pausas'] as const).map(key => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{key === 'dashboard' ? 'Dashboard' : key === 'funcionarios' ? 'Funcionários' : key === 'pausas' ? 'Pausas' : 'Relatórios'}</button>)}</nav>
    {error && <div role="alert" className="error-message">{error}<button onClick={() => setVersion(v => v + 1)}>Tentar novamente</button></div>}{notice && <p role="status" className="receipt">{notice}</p>}
    {tab === 'pausas' ? <BreakSettings request={<T,>(path: string, body?: unknown) => api<T>(path, body, token)} onError={fail} /> : tab === 'funcionarios' ? <><h2>Cadastrar funcionário</h2><form className="settings-form employee-form" onSubmit={saveEmployee}><label>Nome completo<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Matrícula<input required maxLength={40} value={form.registration} onChange={e => setForm({ ...form, registration: e.target.value })} /></label><label>Função<input maxLength={120} placeholder="Ex.: cozinheiro, atendente" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} /></label><label>Departamento<input maxLength={120} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></label><label>Jornada diária (horas)<input required type="number" min="1" max="24" step="0.5" value={form.target_hours} onChange={e => setForm({ ...form, target_hours: e.target.value })} /></label><label>PIN exclusivo de 4 números<PasswordInput required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} /></label><button className="primary-button" disabled={busy}>Cadastrar funcionário</button></form><h2>Equipe ({employees.length})</h2>
      {employees.map(employee => <div className="employee-card" key={employee.id}><div><strong>{employee.name}</strong><p>{employee.registration} · {employee.department || 'Sem departamento'} · {employee.target_hours}h/dia</p><JobTitleEditor employee={employee} token={token} onSaved={() => { setVersion(v => v + 1); setNotice('Função atualizada.') }} onError={fail} /><p>{employee.has_pin ? 'PIN cadastrado' : 'PIN pendente: defina para liberar as batidas'}</p></div><div className="employee-actions"><button className="text-button" onClick={() => { setSelected(String(employee.id)); setTab('relatorios') }}>Histórico</button><button className="text-button" onClick={() => { setPinEmployee(String(employee.id)); setNewPin('') }}>Definir PIN</button></div></div>)}
      {pinEmployee && <form className="settings-form pin-reset" onSubmit={savePin}><h3>Definir PIN de {employees.find(e => String(e.id) === pinEmployee)?.name}</h3><label>Novo PIN<PasswordInput required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} /></label><button className="primary-button" disabled={busy}>Salvar PIN</button><button type="button" className="text-button" onClick={() => setPinEmployee('')}>Cancelar</button></form>}
    </> : <><div className="section-head"><h2>{tab === 'dashboard' ? 'Dashboard de horas' : 'Relatório de horas'}</h2><button className="text-button" disabled={loading} onClick={() => setVersion(v => v + 1)}>Atualizar</button></div><div className="report-filters"><label>De<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Até<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
      {loading ? <p className="empty" role="status">Carregando dados…</p> : report && <>{tab === 'dashboard' ? <Dashboard report={report} receivedAt={receivedAt} syncError={syncError} /> : <><label className="employee-selector">Funcionário<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Todos os funcionários</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.registration}</option>)}</select></label><button className="primary-button export-button" onClick={exportCsv}>Exportar CSV</button><div className="table-scroll"><table><thead><tr><th>Funcionário</th><th>Serviço</th><th>Intervalo</th><th>Batidas</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.name}<small>{row.registration} · {row.job_title || 'Sem função'}</small></td><td>{hours(row.minutes)}</td><td>{hours(Math.floor(row.break_seconds / 60))}</td><td>{row.punches}</td></tr>)}</tbody></table></div>{selected && <section className="history-page"><h3>Batidas no período</h3>{loadingHistory ? <p className="empty">Carregando batidas…</p> : visibleEntries.length === 0 ? <p className="empty">Nenhuma batida no período.</p> : visibleEntries.map(entry => <div className="entry" key={entry.id}><span className="entry-dot entry-in">◷</span><div><strong>{entry.kind}{entry.break_name ? ` · ${entry.break_name}` : ''}</strong><span>{timestamp(entry.occurred_at)}</span></div></div>)}</section>}</>}
      {report.rows.length === 0 && <p className="empty">Cadastre funcionários para começar.</p>}<p className="muted report-note">Inclui jornadas em andamento e desconta intervalos. Horário de Brasília. Atualizado em {timestamp(report.generated_at)}.</p></>}
    </>}</>
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
