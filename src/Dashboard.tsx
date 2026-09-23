import { useEffect, useState } from 'react'
import { Avatar } from './EmployeePhoto'

export type DashboardRow = { id: number; name: string; registration?: string; photo?: string | null; job_title: string; work_seconds: number; break_seconds: number; expected_seconds: number; expected_break_seconds: number; debt_seconds: number; extra_break_seconds: number; status: string; current_since: string | null; current_break_name: string | null; break_totals: { name: string; seconds: number }[] }
export type DashboardReport = { from: string; to: string; generated_at: string; rows: DashboardRow[] }
const clock = (seconds: number) => { const total = Math.max(0, Math.floor(seconds)); return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(n => String(n).padStart(2, '0')).join(':') }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

export default function Dashboard({ report, receivedAt, syncError, onHistory }: { onHistory: (id: number) => void; report: DashboardReport; receivedAt: number; syncError: boolean }) {
  const [tick, setTick] = useState(performance.now())
  const [name, setName] = useState('')
  const [job, setJob] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => { const timer = window.setInterval(() => setTick(performance.now()), 1000); return () => clearInterval(timer) }, [])
  const elapsed = Math.max(0, tick - receivedAt)
  const stale = syncError || elapsed > 30000
  const serverTime = Date.parse(report.generated_at)
  // Para de estimar quando a sincronização falha. Datas passadas não continuam contando.
  const now = serverTime + (stale ? 0 : elapsed)
  const from = Date.parse(`${report.from}T00:00:00-03:00`)
  const until = Date.parse(`${report.to}T00:00:00-03:00`) + 86400000
  const jobs = [...new Set(report.rows.map(row => row.job_title).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const rows = report.rows.filter(row => normalize(`${row.name} ${row.job_title || ''} ${row.registration || ''}`).includes(normalize(name.trim())) && (!employeeId || String(row.id) === employeeId) && (!job || (job === '__empty' ? !row.job_title?.trim() : row.job_title === job)) && (!status || row.status === status)).map(row => {
    const extra = row.current_since ? Math.floor(Math.max(0, Math.min(now, until) - Math.max(serverTime, from, Date.parse(row.current_since))) / 1000) : 0
    const work = row.work_seconds + (row.status === 'Em expediente' ? extra : 0)
    const debt = Math.max(0, row.expected_seconds - work)
    const pause = row.break_seconds + (row.status === 'Em intervalo' ? extra : 0)
    return { ...row, work, debt, pause, extraPause: Math.max(0, pause - (row.expected_break_seconds || 0)), pauses: row.break_totals.map(item => ({ ...item, seconds: item.seconds + (row.status === 'Em intervalo' && row.current_break_name === item.name ? extra : 0) })) }
  })
  return <section className="live-dashboard">
    <div className={`sync-status ${stale ? 'stale' : ''}`} role="status">{stale ? 'Sem sincronização: exibindo a última leitura do servidor.' : 'Contadores a cada segundo · novas batidas sincronizadas a cada 10 segundos'}</div>
    <div className="dashboard-filters"><label>Buscar por nome, função ou matrícula<input type="search" placeholder="Digite para filtrar" value={name} onChange={e => setName(e.target.value)} /></label><label>Funcionário<select value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">Todos os funcionários</option>{report.rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>Função<select value={job} onChange={e => setJob(e.target.value)}><option value="">Todas as funções</option><option value="__empty">Sem função definida</option>{jobs.map(title => <option key={title} value={title}>{title}</option>)}</select></label><label>Situação<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Todas as situações</option><option value="Em expediente">Em serviço</option><option value="Em intervalo">Em intervalo</option><option value="Fora do expediente">Fora do expediente</option></select></label><button className="text-button dashboard-clear-filters" type="button" onClick={() => { setName(''); setEmployeeId(''); setJob(''); setStatus('') }}>Limpar filtros</button></div>
    <p className="dashboard-context">{rows.length} de {report.rows.length} funcionários · totais do período selecionado</p>
    <section className="metrics dashboard-metrics">
      <div className="metric"><div><span>Tempo em serviço</span><strong>{clock(rows.reduce((sum, row) => sum + row.work, 0))}</strong><span>Intervalos descontados</span></div></div>
      <div className="metric"><div><span>Tempo total em pausas</span><strong>{clock(rows.reduce((sum, row) => sum + row.pause, 0))}</strong><span>Separado do serviço</span></div></div>
      <div className="metric"><div><span>Em serviço agora</span><strong>{rows.filter(row => row.status === 'Em expediente').length}</strong><span>Dos funcionários filtrados</span></div></div>
      <div className="metric"><div><span>Em pausa agora</span><strong>{rows.filter(row => row.status === 'Em intervalo').length}</strong><span>Dos funcionários filtrados</span></div></div>
      <div className="metric debt-metric"><div><span>Horas devidas no mês</span><strong>{clock(rows.reduce((sum, row) => sum + row.debt, 0))}</strong><span>{report.from.endsWith('-01') ? 'Previstas menos trabalhadas desde o início do mês' : 'Previstas menos trabalhadas no período filtrado'}</span></div></div>
    </section>
    <h3>Acompanhamento por funcionário</h3><p className="muted">Os tempos seguem o período escolhido. A situação indica a última batida atual.</p>
    <div className="worker-grid">{rows.map(row => <article className="worker-card clickable-worker" key={row.id}><button className="worker-card-link" type="button" aria-label={`Ver histórico de ${row.name}`} onClick={() => onHistory(row.id)} /><div className="worker-heading"><div className="worker-identity"><Avatar name={row.name} photo={row.photo} /><div><h3>{row.name}</h3><p>{row.job_title || 'Função não informada'}</p></div></div><span className={`worker-status ${row.status === 'Em intervalo' ? 'paused' : row.status === 'Em expediente' ? 'working' : 'off'}`}>{row.status === 'Em intervalo' ? `EM PAUSA: ${row.current_break_name || 'Intervalo'}` : row.status === 'Em expediente' ? 'EM SERVIÇO' : 'FORA DO EXPEDIENTE'}</span></div>
      <div className="worker-times"><div><span>Previstas</span><strong>{clock(row.expected_seconds)}</strong></div><div><span>Trabalhadas</span><strong>{clock(row.work)}</strong></div><div><span>Horas devidas</span><strong className={row.debt ? 'debt-text' : ''}>{clock(row.debt)}</strong></div><div><span>Intervalo a mais</span><strong className={row.extraPause ? 'debt-text' : ''}>{clock(row.extraPause)}</strong></div></div>
      {row.pauses.length > 0 && <dl className="pause-breakdown">{row.pauses.map(item => <div key={item.name}><dt>{item.name}</dt><dd>{clock(item.seconds)}</dd></div>)}</dl>}
      {row.current_since && <p className="worker-since">{row.status === 'Em intervalo' ? (row.current_break_name || 'Intervalo') : 'Serviço'} desde {new Date(row.current_since).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>}
      <span className="history-hint">Ver histórico de batidas ›</span>
    </article>)}</div>
    {rows.length === 0 && <p className="empty">Nenhum funcionário encontrado com esses filtros.</p>}
  </section>
}
