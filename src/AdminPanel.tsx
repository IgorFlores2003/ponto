import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { FiSmartphone, FiLogOut, FiRefreshCw } from 'react-icons/fi'
import BottomNav from './BottomNav'
import SuccessToast from './SuccessToast'
import EmployeeList from './EmployeeList'
import ReportTab from './ReportTab'
import DownloadToast, { type DownloadNotice } from './DownloadToast'
import { api, ApiError, errorMessage, day, monthStart, INPUT_CLASS, LABEL_CLASS, type Employee, type Entry, type Report } from './types'
import { monthlyScheduleMinutes, type ScheduleEvent } from '../shared/schedule.js'

const Dashboard = lazy(() => import('./Dashboard'))
const WorkCalendar = lazy(() => import('./WorkCalendar'))

type Tab = 'dashboard' | 'calendario' | 'funcionarios' | 'relatorios'

interface Props {
  token: string
  onExit: () => void
}

/** Painel administrativo completo: busca dados, gerencia abas e delega a subcomponentes. */
export default function AdminPanel({ token, onExit }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [monthEvents, setMonthEvents] = useState<ScheduleEvent[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [receivedAt, setReceivedAt] = useState(0)
  const [syncError, setSyncError] = useState(false)
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(day())
  const [dashboardFilters, setDashboardFilters] = useState(() => ({
    name: '', employeeId: '', job: '', status: '', from: monthStart(), to: day(),
  }))
  const [selected, setSelected] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [downloadNotice, setDownloadNotice] = useState<DownloadNotice | null>(null)
  const sequence = useRef(0)

  const reportFrom = tab === 'relatorios' ? from : dashboardFilters.from
  const reportTo = tab === 'relatorios' ? to : dashboardFilters.to

  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onExit()
    else setError(errorMessage(err))
  }

  // ─── Polling de dados ───────────────────────────────────────────────────────
  useEffect(() => {
    let active = true, fetching = false
    setLoading(true); setError(''); setReport(null); setSyncError(false)

    async function refresh() {
      if (fetching) return
      fetching = true
      try {
        const month = day().slice(0, 7)
        const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()
        const [people, data, events] = await Promise.all([
          api<Employee[]>('/employees', undefined, token),
          api<Report>(`/reports?from=${reportFrom}&to=${reportTo}`, undefined, token),
          api<ScheduleEvent[]>(`/schedule-events?from=${month}-01&to=${month}-${monthEnd}`, undefined, token),
        ])
        const calculated = people.map(p => ({
          ...p, monthly_month: month, monthly_minutes: monthlyScheduleMinutes(p, month, events),
        }))
        if (active) { setMonthEvents(events); setEmployees(calculated); setReport(data); setReceivedAt(performance.now()); setSyncError(false); setError('') }
      } catch (err) {
        if (active) { setSyncError(true); fail(err) }
      } finally {
        fetching = false
        if (active) setLoading(false)
      }
    }

    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 10000)
    const resume = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', resume)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', resume) }
  }, [token, reportFrom, reportTo, version])

  // ─── Escuta eventos de download ─────────────────────────────────────────────
  useEffect(() => {
    function onDownloaded(e: Event) {
      setDownloadNotice({ type: 'success', filename: (e as CustomEvent<{ filename: string }>).detail.filename })
    }
    function onError() { setDownloadNotice({ type: 'error' }) }
    window.addEventListener('file-downloaded', onDownloaded)
    window.addEventListener('file-download-error', onError)
    return () => { window.removeEventListener('file-downloaded', onDownloaded); window.removeEventListener('file-download-error', onError) }
  }, [])

  useEffect(() => {
    if (!downloadNotice) return
    const timer = window.setTimeout(() => setDownloadNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [downloadNotice])

  // ─── Histórico de batidas ───────────────────────────────────────────────────
  useEffect(() => {
    const current = ++sequence.current
    setEntries([])
    if (!selected) { setLoadingHistory(false); return }
    setLoadingHistory(true)
    api<Entry[]>(`/employees/${selected}/entries`, undefined, token)
      .then(data => { if (current === sequence.current) setEntries(data) })
      .catch(err => { if (current === sequence.current) fail(err) })
      .finally(() => { if (current === sequence.current) setLoadingHistory(false) })
    return () => { sequence.current++ }
  }, [selected, token, version])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  async function logout() {
    setBusy(true)
    try { await api('/auth/logout', {}, token) } catch (err) { fail(err) } finally { setBusy(false); onExit() }
  }

  function goToHistory(id: number) {
    setSelected(String(id))
    setVersion(v => v + 1)
    setTab('relatorios')
  }

  const isReportOrDashboard = tab === 'dashboard' || tab === 'relatorios'

  return (
    <>
      {downloadNotice && <DownloadToast notice={downloadNotice} onClose={() => setDownloadNotice(null)} />}

      {/* Barra superior */}
      <div className="mb-6 flex items-center justify-between">
        <a href="#/terminal" className="flex items-center gap-1.5 text-xs font-bold text-[#317455] hover:text-[#173d2f]">
          <FiSmartphone size={16} aria-hidden="true" /> Terminal de ponto
        </a>
        <button type="button" disabled={busy}
          className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f] disabled:opacity-55"
          onClick={logout}>
          <FiLogOut size={14} aria-hidden="true" /> Sair da conta
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

      {/* Tab: Calendário */}
      {tab === 'calendario' ? (
        <Suspense fallback={<p className="px-1 py-4 text-xs text-[#668174]" role="status">Carregando calendário…</p>}>
          <WorkCalendar
            employees={employees}
            onChanged={() => setVersion(v => v + 1)}
            request={<T,>(path: string, body?: unknown) => api<T>(path, body, token)}
            onError={fail}
          />
        </Suspense>

      /* Tab: Funcionários */
      ) : tab === 'funcionarios' ? (
        <EmployeeList
          employees={employees}
          monthEvents={monthEvents}
          token={token}
          busy={busy}
          onEmployeesChange={setEmployees}
          onNotice={setNotice}
          onError={fail}
          onHistory={goToHistory}
          onVersionBump={() => setVersion(v => v + 1)}
        />

      /* Tabs: Dashboard + Relatórios */
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]">
              {tab === 'dashboard' ? 'Dashboard de horas' : 'Relatório de horas'}
            </h2>
            <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f] disabled:opacity-55"
              disabled={loading} onClick={() => setVersion(v => v + 1)}>
              <FiRefreshCw size={13} aria-hidden="true" /> Atualizar
            </button>
          </div>

          {tab === 'relatorios' && (
            <div className="my-5 grid grid-cols-2 gap-3">
              <label className={LABEL_CLASS}>
                De
                <input type="date" value={from} className={INPUT_CLASS} onChange={e => setFrom(e.target.value)} />
              </label>
              <label className={LABEL_CLASS}>
                Até
                <input type="date" value={to} className={INPUT_CLASS} onChange={e => setTo(e.target.value)} />
              </label>
            </div>
          )}

          {loading ? (
            <p className="px-1 py-4 text-xs text-[#668174]" role="status">Carregando dados…</p>
          ) : report && (
            <>
              {tab === 'dashboard' ? (
                <Suspense fallback={<p className="px-1 py-4 text-xs text-[#668174]" role="status">Carregando dashboard…</p>}>
                  <Dashboard
                    filters={dashboardFilters}
                    onFiltersChange={setDashboardFilters}
                    report={report}
                    receivedAt={receivedAt}
                    syncError={syncError}
                    onHistory={goToHistory}
                  />
                </Suspense>
              ) : (
                <ReportTab
                  report={report}
                  employees={employees}
                  entries={entries}
                  selected={selected}
                  from={from}
                  to={to}
                  loadingHistory={loadingHistory}
                  onSelectEmployee={setSelected}
                />
              )}
            </>
          )}
        </>
      )}
    </>
  )
}
