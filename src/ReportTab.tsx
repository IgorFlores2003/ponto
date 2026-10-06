import { useEffect, useMemo, useState } from 'react'
import { FiFileText, FiDownload, FiCamera } from 'react-icons/fi'
import ConfirmDialog from './ConfirmDialog'
import ActionIcon from './ActionIcon'
import { Avatar } from './EmployeePhoto'
import DivergenceBadge from './DivergenceBadge'
import PunchPhotoModal from './PunchPhotoModal'
import { buildCsv, buildPdf } from './reportExports'
import { buildSpreadsheet } from './reportSpreadsheet'
import { deliverFile } from './deliverFile'
import { formatDate, hours, money, timestamp, api, errorMessage, day, INPUT_CLASS, type Employee, type Entry, type Report } from './types'

interface Props {
  report: Report
  employees: Employee[]
  entries: Entry[]
  selected: string
  from: string
  to: string
  loadingHistory: boolean
  token?: string
  onSelectEmployee: (id: string) => void
  onReportClosed?: () => void
  onEntryUpdated?: (updated: Entry) => void
}

/** Aba de Relatório e Histórico com conferência biométrica facial */
export default function ReportTab({
  report,
  employees,
  entries,
  selected,
  from,
  to,
  loadingHistory,
  token,
  onSelectEmployee,
  onEntryUpdated,
  onReportClosed,
}: Props) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  // Sincroniza a batida selecionada caso ela seja atualizada em background pela IA
  useEffect(() => {
    if (selectedEntry) {
      const match = entries.find(e => e.id === selectedEntry.id)
      if (match && (match.divergence_status !== selectedEntry.divergence_status || match.admin_confirmed !== selectedEntry.admin_confirmed)) {
        setSelectedEntry(match)
      }
    }
  }, [entries, selectedEntry])

  const rows = useMemo(
    () => report.rows.filter(row => !selected || String(row.id) === selected),
    [report, selected],
  )

  const visibleEntries = useMemo(
    () =>
      entries
        .filter(entry => {
          const date = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(entry.occurred_at))
          return date >= from && date <= to
        })
        .slice()
        .reverse(),
    [entries, from, to],
  )

  async function exportFile(kind: 'csv' | 'pdf' | 'xlsx') {
    setExporting(true); setExportError('')
    try {
      const file = kind === 'csv' ? buildCsv(report, selected) : kind === 'pdf' ? await buildPdf(report, selected) : await buildSpreadsheet(report, selected)
      await deliverFile(file, `relatorio-horas-${report.from}-${report.to}.${kind}`)
    } catch { setExportError('Não foi possível exportar o relatório. Tente novamente.') }
    finally { setExporting(false) }
  }
  const totals = rows.reduce((sum, row) => ({
    minutes: sum.minutes + row.minutes,
    debt: sum.debt + row.debt_seconds,
    pay: sum.pay + (row.total_pay_cents ?? 0),
  }), { minutes: 0, debt: 0, pay: 0 })

  const month = report.from.slice(0, 7)
  const [year, monthNumber] = month.split('-').map(Number)
  const isFullMonth = report.from === `${month}-01` && report.to === `${month}-${new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()}`
  async function closeMonth() {
    if (!token) return
    setClosing(true); setCloseError('')
    try {
      await api('/reports/close', { month }, token)
      setConfirmClose(false); onReportClosed?.()
    } catch (err) { setCloseError(errorMessage(err)); setConfirmClose(false) }
    finally { setClosing(false) }
  }
  const selectedEmployee = employees.find(e => String(e.id) === selected)

  return (
    <>
      {confirmClose && <ConfirmDialog title="Fechar pagamento do mês?" message="O fechamento salva as horas, tarifas e valores de todos os funcionários deste mês. Alterações futuras nos cadastros não mudarão este relatório. Esta operação não pode ser desfeita pela interface." confirmLabel="Fechar mês" busy={closing} onConfirm={() => void closeMonth()} onCancel={() => setConfirmClose(false)} />}
      {closeError && <p role="alert" className="mb-3 text-sm text-[#913939]">{closeError}</p>}
      {report.closed_at ? <p className="mb-4 rounded-xl bg-[#eaf5ee] p-3 text-sm font-semibold text-[#143f31]">Mês fechado em {timestamp(report.closed_at)}. Horas, tarifas e valores preservados.</p> : isFullMonth && month < day().slice(0, 7) && token && <button type="button" onClick={() => setConfirmClose(true)} className="mb-4 min-h-12 rounded-xl border border-[#9fbaa9] px-4 text-sm font-bold text-[#315847]">Fechar pagamento de {month.split('-').reverse().join('/')}</button>}
      <section className="mb-5 rounded-2xl bg-[#143f31] p-5 text-white sm:p-6">
        <p className="text-[10px] font-bold tracking-[0.18em] text-[#b1d6c1]">GESTÃO DE JORNADAS</p>
        <h2 className="mt-2 font-['Manrope',sans-serif] text-2xl font-extrabold">Relatório de horas</h2>
        <p className="mt-2 text-sm text-[#d4e8dc]">{formatDate(report.from)} a {formatDate(report.to)}</p>
        <p className="mt-3 text-xs text-[#b1d6c1]">{selectedEmployee ? selectedEmployee.name : 'Visão geral da equipe'} · {rows.length} {rows.length === 1 ? 'funcionário' : 'funcionários'}</p>
      </section>
      <div className="mb-6 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:grid-cols-3">
        {[
          { label: 'Horas trabalhadas', value: hours(totals.minutes), detail: 'Serviço no período', color: 'text-[#143f31]' },
          { label: 'Horas devidas', value: hours(Math.floor(totals.debt / 60)), detail: 'Pendências de jornada', color: totals.debt ? 'text-[#a24636]' : 'text-[#143f31]' },
          { label: 'Total a pagar', value: rows.some(row => row.total_pay_cents === null) ? 'Incompleto' : money(totals.pay), detail: rows.some(row => row.total_pay_cents === null) ? 'Há funcionários sem tarifa definida' : 'Horas normais + extras na folga', color: 'text-[#143f31]' },
        ].map(item => <div key={item.label} className="rounded-2xl border border-[#dce8e1] bg-white p-4">
          <p className="text-xs font-semibold text-[#527566]">{item.label}</p>
          <p className={`mt-2 break-words text-2xl font-extrabold tracking-tight tabular-nums ${item.color}`}>{item.value}</p>
          <p className="mt-1 text-[11px] text-[#789185]">{item.detail}</p>
        </div>)}
      </div>
      <label className="mb-5 grid gap-1.5 text-xs font-bold text-[#527566]">
        Funcionário
        <select value={selected} className={INPUT_CLASS} onChange={e => onSelectEmployee(e.target.value)}>
          <option value="">Todos os funcionários</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.registration}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <button
          className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-4 py-2.5 text-xs font-bold text-[#173d2f] transition hover:bg-[#e1f9e6]"
          onClick={() => void exportFile('xlsx')}
          disabled={exporting || !rows.length}
        >
          <FiFileText size={15} aria-hidden="true" /> {exporting ? 'Exportando…' : 'Planilha (Excel / Sheets)'}
        </button>
        <button
          className="flex items-center gap-1.5 rounded-[13px] border border-[#7eae91] bg-[#2a674f] px-4 py-2.5 text-xs font-bold text-[#d7f1df] transition hover:bg-[#347a5e]"
          disabled={exporting || !rows.length}
          onClick={() => void exportFile('pdf')}
        >
          <FiDownload size={15} aria-hidden="true" /> Baixar PDF
        </button>
        <button
          className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f]"
          disabled={exporting || !rows.length}
          onClick={() => void exportFile('csv')}
        >
          <FiDownload size={13} aria-hidden="true" /> CSV
        </button>
      </div>
      {exportError && <p role="alert" className="mb-4 text-sm text-[#913939]">{exportError}</p>}
      <p className="mb-3 text-xs text-[#527566]">Total a pagar = horas normais × tarifa normal + extras na folga × tarifa extra. Intervalos e atestados não entram nesse valor. {report.closed_at ? 'Tarifas preservadas no fechamento.' : 'Os cálculos usam as tarifas atuais até o fechamento do mês.'}</p>

      <section className="my-6" aria-label="Pagamento por funcionário">
        <h3 className="text-base font-bold text-[#143f31]">Pagamento por funcionário</h3>
        <p className="mt-1 mb-4 text-xs text-[#789185]">Valores das horas registradas de {formatDate(report.from)} a {formatDate(report.to)}. O mês em andamento acumula somente o trabalho realizado até agora.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(row => <article key={row.id} className="overflow-hidden rounded-2xl border border-[#dce8e1] bg-white">
            <div className="border-b border-[#edf2ee] p-4">
              <h4 className="font-bold text-[#143f31]">{row.name}</h4>
              <p className="mt-1 text-xs text-[#789185]">{row.registration} · {row.job_title || 'Sem função'}</p>
            </div>
            <dl className="grid gap-4 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <dt className="text-[#527566]">Horas normais<span className="mt-1 block text-xs">{hours(Math.floor(row.regular_work_seconds / 60))} × {money(row.hourly_rate_cents)}/h</span></dt>
                <dd className="font-semibold tabular-nums text-[#143f31]">{money(row.regular_work_seconds === 0 ? 0 : row.regular_pay_cents)}</dd>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <dt className="text-[#527566]">Horas extras na folga<span className="mt-1 block text-xs">{hours(Math.floor(row.off_day_work_seconds / 60))} × {money(row.overtime_rate_cents)}/h</span></dt>
                <dd className="font-semibold tabular-nums text-[#143f31]">{money(row.off_day_work_seconds === 0 ? 0 : row.overtime_pay_cents)}</dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#eaf5ee] p-3">
                <dt className="font-bold text-[#143f31]">Total a pagar</dt>
                <dd className="text-xl font-extrabold tabular-nums text-[#143f31]">{row.total_pay_cents === null ? 'Incompleto' : money(row.total_pay_cents)}</dd>
              </div>
            </dl>
            {row.total_pay_cents === null && <p className="px-4 pb-4 text-xs text-[#a24636]">Cadastre o valor da hora normal e/ou extra nas configurações do funcionário para calcular o pagamento.</p>}
          </article>)}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[#143f31]">Detalhamento por funcionário</h3>
        <span className="rounded-full bg-[#eaf5ee] px-3 py-1 text-xs font-semibold text-[#527566]">{rows.length} registros</span>
      </div>
      <p className="mt-1 text-xs text-[#789185]">Deslize a tabela para consultar todas as horas e valores.</p>
      <div className="my-4 overflow-x-auto rounded-2xl border border-[#dce8e1] bg-white" role="region" aria-label="Detalhamento de horas por funcionário" tabIndex={0}>
        <table className="w-full border-collapse text-left text-[13px] [&_th]:whitespace-nowrap [&_th]:text-xs [&_td]:whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#dce8e1] bg-[#eaf5ee] text-[#315847]">
              <th scope="col" className="sticky left-0 z-10 bg-[#eaf5ee] px-4 py-3.5">Funcionário</th>
              <th scope="col" className="px-2.5 py-3.5">Previstas</th>
              <th scope="col" className="px-2.5 py-3.5">Serviço</th>
              <th scope="col" className="px-2.5 py-3.5">Horas normais</th>
              <th scope="col" className="px-2.5 py-3.5">Valor/h normal</th>
              <th scope="col" className="px-2.5 py-3.5">Valor horas normais</th>
              <th scope="col" className="px-2.5 py-3.5">Total a pagar (R$)</th>
              <th scope="col" className="px-2.5 py-3.5">Abonadas (atestado)</th>
              <th scope="col" className="px-2.5 py-3.5">Total cumprido</th>
              <th scope="col" className="px-2.5 py-3.5">Extras na folga</th>
              <th scope="col" className="px-2.5 py-3.5">Valor/h extra</th>
              <th scope="col" className="px-2.5 py-3.5">Total extras (R$)</th>
              <th scope="col" className="px-2.5 py-3.5">Devidas</th>
              <th scope="col" className="px-2.5 py-3.5">Intervalo</th>
              <th scope="col" className="px-2.5 py-3.5">Batidas</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && <tr><td colSpan={15} className="p-8 text-center text-[#789185]">Nenhum funcionário para este filtro.</td></tr>}
            {rows.map(row => (
              <tr key={row.id} className="group border-b border-[#edf2ee] even:bg-[#f7faf8] hover:bg-[#edf6f0]">
                <td className="sticky left-0 bg-white px-4 py-4 font-semibold text-[#143f31] group-even:bg-[#f7faf8] group-hover:bg-[#edf6f0]">
                  {row.name}
                  <small className="mt-1 block text-xs text-[#789185]">
                    {row.registration} · {row.job_title || 'Sem função'}
                  </small>
                </td>
                <td className="px-2.5 py-3.5 tabular-nums">
                  {hours(Math.floor(row.expected_seconds / 60))}
                </td>
                <td className="px-2.5 py-3.5 tabular-nums">{hours(row.minutes)}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{hours(Math.floor(row.regular_work_seconds / 60))}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{money(row.hourly_rate_cents)}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{money(row.regular_pay_cents)}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{money(row.total_pay_cents)}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{hours(Math.floor(row.excused_seconds / 60))}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{hours(Math.floor(row.fulfilled_seconds / 60))}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{hours(Math.floor(row.off_day_work_seconds / 60))}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{money(row.overtime_rate_cents)}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{money(row.overtime_pay_cents)}</td>
                <td className={`px-2.5 py-3.5 font-bold tabular-nums ${row.debt_seconds ? 'text-[#a24636]' : ''}`}>
                  {hours(Math.floor(row.debt_seconds / 60))}
                </td>
                <td className="px-2.5 py-3.5 tabular-nums">
                  {hours(Math.floor(row.break_seconds / 60))}
                </td>
                <td className="px-2.5 py-3.5 tabular-nums">{row.punches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && selectedEmployee && (
        <section className="mt-6 rounded-2xl border border-[#dce8e1] bg-white p-4">
          <div className="mt-4 mb-3 flex items-center gap-3">
            <Avatar name={selectedEmployee.name} photo={selectedEmployee.photo} />
            <div>
              <h3 className="text-sm font-semibold text-[#143f31]">Histórico de {selectedEmployee.name}</h3>
              <p className="mt-0.5 text-[11px] text-[#82958b]">Batidas no período selecionado</p>
            </div>
          </div>
          {loadingHistory ? (
            <p className="px-1 py-4 text-xs text-[#668174]">Carregando batidas…</p>
          ) : visibleEntries.length === 0 ? (
            <p className="px-1 py-4 text-xs text-[#668174]">Nenhuma batida no período.</p>
          ) : (
            visibleEntries.map(entry => {
              const isRejected = entry.divergence_status === 'rejected'
              const isValidated = entry.admin_confirmed || entry.divergence_status === 'confirmed'
              return (
                <div
                  className={`flex items-center justify-between gap-2.5 border-b border-[#edf0ee] px-2 py-3 rounded-xl transition ${
                    isRejected ? 'bg-[#fef2f2]/60' : isValidated ? 'bg-[#f0fdf4]/40' : ''
                  }`}
                  key={entry.id}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ActionIcon kind={entry.kind} breakName={entry.break_name} />
                    <div>
                      <strong className={`block text-xs ${isRejected ? 'text-[#991b1b]' : 'text-[#143f31]'}`}>
                        {entry.kind}{entry.break_name ? ` · ${entry.break_name}` : ''}
                      </strong>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-[#82958b]">{timestamp(entry.occurred_at)}</span>
                        <DivergenceBadge entry={entry} />
                      </div>
                    </div>
                  </div>
                  {entry.punch_photo ? (
                    <button
                      type="button"
                      onClick={() => setSelectedEntry(entry)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        isRejected
                          ? 'border border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca]'
                          : isValidated
                          ? 'border border-[#86efac] bg-[#f0fdf4] text-[#166534] hover:bg-[#dcfce7]'
                          : 'border border-[#cbded2] bg-[#f7fbf9] text-[#1f4a38] hover:bg-[#e4efe8]'
                      }`}
                    >
                      <FiCamera size={13} aria-hidden="true" />
                      Abrir foto
                    </button>
                  ) : null}
                </div>
              )
            })
          )}
        </section>
      )}

      {report.rows.length === 0 && (
        <p className="px-1 py-4 text-xs text-[#668174]">Cadastre funcionários para começar.</p>
      )}

      <p className="mt-6 text-[11px] leading-relaxed text-[#82958b]">
        Inclui jornadas em andamento e desconta intervalos. Total cumprido = trabalhadas + atestado. O atestado conta para cumprir as horas previstas. Extras na folga fazem parte do serviço e não compensam horas devidas de outros dias. Total extras = horas na folga × tarifa extra do relatório, proporcional aos segundos e arredondado em centavos. Horário de Brasília.{' '}
        Atualizado em {timestamp(report.generated_at)}.
      </p>

      {selectedEntry && (
        <PunchPhotoModal
          entry={selectedEntry}
          employee={selectedEmployee}
          token={token}
          onClose={() => setSelectedEntry(null)}
          onConfirmed={updated => {
            setSelectedEntry(null)
            onEntryUpdated?.(updated)
          }}
        />
      )}
    </>
  )
}
