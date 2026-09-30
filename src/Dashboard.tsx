import { FiChevronRight, FiFilter, FiClock, FiCoffee, FiUserCheck, FiPauseCircle, FiAlertCircle } from 'react-icons/fi'
import { useEffect, useState } from 'react'
import { money } from './types'
import { Avatar } from './EmployeePhoto'
import DashboardFiltersModal, { type DashboardFilters } from './DashboardFiltersModal'

export type DashboardRow = { overtime_rate_cents: number | null; excused_seconds: number; fulfilled_seconds: number; current_excused_seconds: number; off_day_work_seconds: number; current_off_day: boolean; id: number; name: string; registration?: string; photo?: string | null; job_title: string; work_seconds: number; break_seconds: number; expected_seconds: number; expected_break_seconds: number; debt_seconds: number; extra_break_seconds: number; status: string; current_since: string | null; current_break_name: string | null; break_totals: { name: string; seconds: number }[] }
export type DashboardReport = { from: string; to: string; generated_at: string; rows: DashboardRow[] }
const clock = (seconds: number) => { const total = Math.max(0, Math.floor(seconds)); return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(n => String(n).padStart(2, '0')).join(':') }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

export default function Dashboard({ report, receivedAt, syncError, onHistory, filters, onFiltersChange }: { filters: DashboardFilters; onFiltersChange: (filters: DashboardFilters) => void; onHistory: (id: number) => void; report: DashboardReport; receivedAt: number; syncError: boolean }) {
  const [tick, setTick] = useState(performance.now())
  const { name, job, employeeId, status } = filters
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => { const timer = window.setInterval(() => setTick(performance.now()), 1000); return () => clearInterval(timer) }, [])
  const elapsed = Math.max(0, tick - receivedAt)
  const stale = syncError || elapsed > 30000
  const serverTime = Date.parse(report.generated_at)
  // Para de estimar quando a sincronização falha. Datas passadas não continuam contando.
  const now = serverTime + (stale ? 0 : elapsed)
  const from = Date.parse(`${report.from}T00:00:00-03:00`)
  const until = Date.parse(`${report.to}T00:00:00-03:00`) + 86400000
  const rows = report.rows.filter(row => normalize(`${row.name} ${row.job_title || ''} ${row.registration || ''}`).includes(normalize(name.trim())) && (!employeeId || String(row.id) === employeeId) && (!job || (job === '__empty' ? !row.job_title?.trim() : row.job_title === job)) && (!status || row.status === status)).map(row => {
    const extra = row.current_since ? Math.floor(Math.max(0, Math.min(now, until, Date.parse(new Date(serverTime - 3 * 3600000).toISOString().slice(0, 10) + 'T00:00:00-03:00') + 86400000) - Math.max(serverTime, from, Date.parse(row.current_since))) / 1000) : 0
    const work = row.work_seconds + (row.status === 'Em expediente' ? extra : 0)
    const workedExtra = row.status === 'Em expediente' ? extra : 0
    const excused = Math.max(0, row.excused_seconds - Math.min(workedExtra, row.current_excused_seconds))
    const fulfilled = work + excused
    const debt = Math.max(0, row.expected_seconds - (fulfilled - row.off_day_work_seconds - (row.current_off_day ? workedExtra : 0)))
    const offWork = row.off_day_work_seconds + (row.current_off_day ? workedExtra : 0)
    const extraPay = row.overtime_rate_cents == null ? null : Math.round(offWork * row.overtime_rate_cents / 3600)
    const pause = row.break_seconds + (row.status === 'Em intervalo' ? extra : 0)
    return { ...row, work, excused, fulfilled, offWork, extraPay, debt, pause, extraPause: Math.max(0, pause - (row.expected_break_seconds || 0)), pauses: row.break_totals.map(item => ({ ...item, seconds: item.seconds + (row.status === 'Em intervalo' && row.current_break_name === item.name ? extra : 0) })) }
  })

  return (
    <section className="min-w-0">
      <div className={`my-3.5 rounded-[10px] px-3.5 py-2.5 text-xs ${stale ? 'bg-[#fff0d7] text-[#815b1c]' : 'bg-[#e2f3e8] text-[#23573d]'}`} role="status">
        {stale ? 'Sem sincronização: exibindo a última leitura do servidor.' : 'Contadores a cada segundo · novas batidas sincronizadas a cada 10 segundos'}
      </div>

      <div className="my-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-normal text-[#527566]">
          {filters.from.split('-').reverse().join('/')} a {filters.to.split('-').reverse().join('/')}
          {[name, job, employeeId, status].filter(Boolean).length > 0 ? ` · ${[name, job, employeeId, status].filter(Boolean).length} filtros ativos` : ''}
        </p>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-4 py-2 text-xs font-bold text-[#173d2f] transition hover:bg-[#e1f9e6]"
          aria-haspopup="dialog"
          onClick={() => setFiltersOpen(true)}
        >
          <FiFilter size={14} aria-hidden="true" />
          Filtros
        </button>
      </div>

      {filtersOpen && <DashboardFiltersModal filters={filters} rows={report.rows} onClose={() => setFiltersOpen(false)} onApply={next => { onFiltersChange(next); setFiltersOpen(false) }} />}

      <p className="text-xs text-[#527566]">
        {rows.length} de {report.rows.length} funcionários · totais do período selecionado
      </p>

      <section className="mt-3.5 mb-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5 sm:gap-3.5">
        <div className="flex min-w-0 flex-col items-start gap-2.5 sm:gap-3 rounded-[17px] border border-[#e2ebe5] bg-white p-3 sm:p-3.5 overflow-hidden shadow-xs">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e1f3e7] text-[#246841]">
            <FiClock size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 w-full flex-1">
            <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Total cumprido</span>
            <strong className="block [overflow-wrap:anywhere] font-['Manrope',sans-serif] text-base sm:text-xl font-bold tabular-nums text-[#143f31]">
              {clock(rows.reduce((sum, row) => sum + row.fulfilled, 0))}
            </strong>
            <span className="block [overflow-wrap:anywhere] text-[9px] sm:text-[10px] text-[#82958b]" title="Horas trabalhadas + atestado">Trabalhadas + atestado</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-2.5 sm:gap-3 rounded-[17px] border border-[#e2ebe5] bg-white p-3 sm:p-3.5 overflow-hidden shadow-xs">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff0d7] text-[#8b5a18]">
            <FiCoffee size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 w-full flex-1">
            <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Tempo em pausas</span>
            <strong className="block [overflow-wrap:anywhere] font-['Manrope',sans-serif] text-base sm:text-xl font-bold tabular-nums text-[#143f31]">
              {clock(rows.reduce((sum, row) => sum + row.pause, 0))}
            </strong>
            <span className="block [overflow-wrap:anywhere] text-[9px] sm:text-[10px] text-[#82958b]" title="Separado do serviço">Separado do serviço</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-2.5 sm:gap-3 rounded-[17px] border border-[#e2ebe5] bg-white p-3 sm:p-3.5 overflow-hidden shadow-xs">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e1f3e7] text-[#246841]">
            <FiUserCheck size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 w-full flex-1">
            <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Em serviço agora</span>
            <strong className="block [overflow-wrap:anywhere] font-['Manrope',sans-serif] text-base sm:text-xl font-bold tabular-nums text-[#143f31]">
              {rows.filter(row => row.status === 'Em expediente').length}
            </strong>
            <span className="block [overflow-wrap:anywhere] text-[9px] sm:text-[10px] text-[#82958b]" title="Dos funcionários filtrados">Dos filtrados</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-2.5 sm:gap-3 rounded-[17px] border border-[#e2ebe5] bg-white p-3 sm:p-3.5 overflow-hidden shadow-xs">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff0d7] text-[#8b5a18]">
            <FiPauseCircle size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 w-full flex-1">
            <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Em pausa agora</span>
            <strong className="block [overflow-wrap:anywhere] font-['Manrope',sans-serif] text-base sm:text-xl font-bold tabular-nums text-[#143f31]">
              {rows.filter(row => row.status === 'Em intervalo').length}
            </strong>
            <span className="block [overflow-wrap:anywhere] text-[9px] sm:text-[10px] text-[#82958b]" title="Dos funcionários filtrados">Dos filtrados</span>
          </div>
        </div>

        <div className="col-span-full flex min-w-0 flex-col items-start gap-2.5 sm:gap-3 rounded-[17px] border border-[#f0d4b5] bg-[#fffaf3] p-3 sm:p-3.5 overflow-hidden sm:col-span-2 shadow-xs">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fbe9e3] text-[#a24636]">
            <FiAlertCircle size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 w-full flex-1">
            <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#815b1c]">Horas devidas no mês</span>
            <strong className="block [overflow-wrap:anywhere] font-['Manrope',sans-serif] text-base sm:text-xl font-bold tabular-nums text-[#a24636]">
              {clock(rows.reduce((sum, row) => sum + row.debt, 0))}
            </strong>
            <span className="block [overflow-wrap:anywhere] text-[9px] sm:text-[10px] text-[#82958b]" title={report.from.endsWith('-01') ? 'Previstas menos trabalhadas e atestado desde o início do mês' : 'Previstas menos trabalhadas e atestado no período filtrado'}>
              {report.from.endsWith('-01') ? 'Previstas menos trabalhadas e atestado no mês' : 'Previstas menos trabalhadas e atestado no período'}
            </span>
          </div>
        </div>
      </section>

      <h3 className="text-sm font-semibold text-[#143f31]">Acompanhamento por funcionário</h3>
      <p className="mt-0.5 text-[11px] text-[#82958b]">Clique em um funcionário para expandir ou recolher as horas do período. A situação indica a última batida atual.</p>

      <div className="mt-4 grid gap-3.5">
        {rows.map(row => (
          <details
            className="group min-w-0 overflow-hidden rounded-[18px] border border-[#dce8e1] bg-white p-4 sm:p-5 transition duration-150 hover:border-[#4b916d] hover:shadow-[0_4px_16px_rgba(20,63,49,0.08)]"
            key={row.id}
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#246841] [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 w-full items-center gap-3 sm:flex-1">
                  <Avatar name={row.name} photo={row.photo} />
                  <div className="min-w-0 flex-1">
                    <h3 className="[overflow-wrap:anywhere] text-sm sm:text-[15px] font-semibold text-[#143f31]">{row.name}</h3>
                    <p className="[overflow-wrap:anywhere] text-xs sm:text-[13px] text-[#527566]">{row.job_title || 'Função não informada'}</p>
                  </div>
                </div>
                <span
                  className={`max-w-full [overflow-wrap:anywhere] rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold ${
                    row.status === 'Em intervalo'
                      ? 'border border-[#e8b454] bg-[#ffe0a3] text-[#633a00]'
                      : row.status === 'Em expediente'
                      ? 'bg-[#246841] text-white'
                      : 'bg-[#edf0ee] text-[#59665e]'
                  }`}
                >
                  {row.status === 'Em intervalo' ? `EM PAUSA: ${row.current_break_name || 'Intervalo'}` : row.status === 'Em expediente' ? 'EM SERVIÇO' : 'FORA DO EXPEDIENTE'}
                </span>
              </div>

              <FiChevronRight size={20} aria-hidden="true" className="shrink-0 text-[#246841] transition-transform group-open:rotate-90" />
            </summary>

            <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,135px),1fr))] gap-2 sm:gap-3">
              <div className="min-w-0 overflow-hidden rounded-xl bg-[#f0f8f3] p-2.5 sm:p-3">
                <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Previstas</span>
                <strong className="block [overflow-wrap:anywhere] text-base sm:text-xl font-bold tabular-nums text-[#143f31]">{clock(row.expected_seconds)}</strong>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl bg-[#fff7ec] p-2.5 sm:p-3">
                <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Trabalhadas</span>
                <strong className="block [overflow-wrap:anywhere] text-base sm:text-xl font-bold tabular-nums text-[#143f31]">{clock(row.work)}</strong>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl bg-[#f0f8f3] p-2.5 sm:p-3">
                <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Atestado</span>
                <strong className="block [overflow-wrap:anywhere] text-base sm:text-xl font-bold tabular-nums text-[#143f31]">{clock(row.excused)}</strong>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl bg-[#f0f8f3] p-2.5 sm:p-3">
                <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Total cumprido</span>
                <strong className="block [overflow-wrap:anywhere] text-base sm:text-xl font-bold tabular-nums text-[#143f31]">{clock(row.fulfilled)}</strong>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl bg-[#fff7ec] p-2.5 sm:p-3">
                <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Horas devidas</span>
                <strong className={`block [overflow-wrap:anywhere] text-base sm:text-xl font-bold tabular-nums ${row.debt ? 'text-[#a24636]' : 'text-[#143f31]'}`}>{clock(row.debt)}</strong>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl bg-[#fff7ec] p-2.5 sm:p-3">
                <span className="block [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">Intervalo a mais</span>
                <strong className={`block [overflow-wrap:anywhere] text-base sm:text-xl font-bold tabular-nums ${row.extraPause ? 'text-[#a24636]' : 'text-[#143f31]'}`}>{clock(row.extraPause)}</strong>
              </div>
            </div>

            <p className="mt-3 min-w-0 [overflow-wrap:anywhere] text-xs text-[#527566]">
              Extras na folga: <strong>{clock(row.offWork)}</strong> · Total extras: <strong>{money(row.extraPay)}</strong>
            </p>

            {row.pauses.length > 0 && (
              <dl className="mt-3 grid gap-1 text-xs sm:text-[13px]">
                {row.pauses.map(item => (
                  <div key={item.name} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[#edf0ee] py-1.5">
                    <dt className="min-w-0 [overflow-wrap:anywhere] text-[#527566]">{item.name}</dt>
                    <dd className="m-0 min-w-0 max-w-full [overflow-wrap:anywhere] font-bold tabular-nums text-[#143f31]">{clock(item.seconds)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {row.current_since && (
              <p className="mt-2.5 [overflow-wrap:anywhere] text-[11px] sm:text-xs text-[#527566]">
                {row.status === 'Em intervalo' ? (row.current_break_name || 'Intervalo') : 'Serviço'} desde {new Date(row.current_since).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </p>
            )}

            <button type="button" onClick={() => onHistory(row.id)}
              aria-label={`Ver histórico de batidas de ${row.name}`}
              className="mt-3 flex min-h-11 items-center gap-1 rounded-lg text-xs font-bold text-[#246841] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246841]">
              Ver histórico de batidas <FiChevronRight size={16} aria-hidden="true" />
            </button>
          </details>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="px-1 py-4 text-xs text-[#668174]">Nenhum funcionário encontrado com esses filtros.</p>
      )}
    </section>
  )
}

