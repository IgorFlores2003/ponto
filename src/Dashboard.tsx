import { useEffect, useState } from 'react'

export type DashboardRow = { id: number; name: string; job_title: string; work_seconds: number; break_seconds: number; status: string; current_since: string | null }
export type DashboardReport = { from: string; to: string; generated_at: string; rows: DashboardRow[] }
const clock = (seconds: number) => { const total = Math.max(0, Math.floor(seconds)); return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(n => String(n).padStart(2, '0')).join(':') }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

export default function Dashboard({ report, receivedAt, syncError }: { report: DashboardReport; receivedAt: number; syncError: boolean }) {
  const [tick, setTick] = useState(performance.now())
  const [name, setName] = useState('')
  const [job, setJob] = useState('')
  useEffect(() => { const timer = window.setInterval(() => setTick(performance.now()), 1000); return () => clearInterval(timer) }, [])
  const elapsed = Math.max(0, tick - receivedAt)
  const stale = syncError || elapsed > 30000
  const serverTime = Date.parse(report.generated_at)
  // Para de estimar quando a sincronização falha. Datas passadas não continuam contando.
  const now = serverTime + (stale ? 0 : elapsed)
  const from = Date.parse(`${report.from}T00:00:00-03:00`)
  const until = Date.parse(`${report.to}T00:00:00-03:00`) + 86400000
  const jobs = [...new Set(report.rows.map(row => row.job_title).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const rows = report.rows.filter(row => normalize(row.name).includes(normalize(name.trim())) && (!job || (job === '__empty' ? !row.job_title : row.job_title === job))).map(row => {
    const extra = row.current_since ? Math.floor(Math.max(0, Math.min(now, until) - Math.max(serverTime, from, Date.parse(row.current_since))) / 1000) : 0
    return { ...row, work: row.work_seconds + (row.status === 'Em expediente' ? extra : 0), pause: row.break_seconds + (row.status === 'Em intervalo' ? extra : 0) }
  })
  return <section className="live-dashboard">
    <div className={`sync-status ${stale ? 'stale' : ''}`} role="status">{stale ? 'Sem sincronização: exibindo a última leitura do servidor.' : 'Contadores a cada segundo · novas batidas sincronizadas a cada 10 segundos'}</div>
    <div className="dashboard-filters"><label>Buscar funcionário<input type="search" placeholder="Digite o nome" value={name} onChange={e => setName(e.target.value)} /></label><label>Função<select value={job} onChange={e => setJob(e.target.value)}><option value="">Todas as funções</option><option value="__empty">Sem função definida</option>{jobs.map(title => <option key={title} value={title}>{title}</option>)}</select></label></div>
    <p className="dashboard-context">{rows.length} de {report.rows.length} funcionários · totais do período selecionado</p>
    <section className="metrics dashboard-metrics">
      <div className="metric"><div><span>Tempo em serviço</span><strong>{clock(rows.reduce((sum, row) => sum + row.work, 0))}</strong><span>Intervalos descontados</span></div></div>
      <div className="metric"><div><span>Tempo em almoço / intervalo</span><strong>{clock(rows.reduce((sum, row) => sum + row.pause, 0))}</strong><span>Separado do serviço</span></div></div>
      <div className="metric"><div><span>Em serviço agora</span><strong>{rows.filter(row => row.status === 'Em expediente').length}</strong><span>Dos funcionários filtrados</span></div></div>
      <div className="metric"><div><span>Em almoço / intervalo agora</span><strong>{rows.filter(row => row.status === 'Em intervalo').length}</strong><span>Dos funcionários filtrados</span></div></div>
    </section>
    <h3>Acompanhamento por funcionário</h3><p className="muted">Os tempos seguem o período escolhido. A situação indica a última batida atual.</p>
    <div className="worker-grid">{rows.map(row => <article className="worker-card" key={row.id}><div className="worker-heading"><div><h3>{row.name}</h3><p>{row.job_title || 'Função não informada'}</p></div><span className={`worker-status ${row.status === 'Em intervalo' ? 'paused' : row.status === 'Em expediente' ? 'working' : 'off'}`}>{row.status === 'Em intervalo' ? 'Almoço / intervalo' : row.status === 'Em expediente' ? 'Em serviço' : 'Fora do expediente'}</span></div>
      <div className="worker-times"><div><span>Em serviço</span><strong>{clock(row.work)}</strong></div><div><span>Almoço / intervalo</span><strong>{clock(row.pause)}</strong></div></div>
      {row.current_since && <p className="worker-since">{row.status === 'Em intervalo' ? 'Intervalo' : 'Serviço'} desde {new Date(row.current_since).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>}
    </article>)}</div>
    {rows.length === 0 && <p className="empty">Nenhum funcionário encontrado com esses filtros.</p>}
  </section>
}
