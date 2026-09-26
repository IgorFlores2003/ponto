import { useMemo, useState } from 'react'
import { FiFileText, FiDownload, FiCamera } from 'react-icons/fi'
import ActionIcon from './ActionIcon'
import { Avatar } from './EmployeePhoto'
import DivergenceBadge from './DivergenceBadge'
import PunchPhotoModal from './PunchPhotoModal'
import { buildCsv, buildExcel, buildPdf } from './reportExports'
import { deliverFile } from './deliverFile'
import { hours, timestamp, INPUT_CLASS, type Employee, type Entry, type Report } from './types'

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
}: Props) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)

  // Sincroniza a batida selecionada caso ela seja atualizada em background pela IA
  useMemo(() => {
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

  function exportCsv() {
    void deliverFile(buildCsv(report, selected), `horas-${report.from}-${report.to}.csv`)
  }
  function exportExcel() {
    void deliverFile(buildExcel(report, selected), `relatorio-horas-${report.from}-${report.to}.xls`)
  }
  async function exportPdf() {
    void deliverFile(await buildPdf(report, selected), `relatorio-horas-${report.from}-${report.to}.pdf`)
  }

  const selectedEmployee = employees.find(e => String(e.id) === selected)

  return (
    <>
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
          onClick={exportExcel}
        >
          <FiFileText size={15} aria-hidden="true" /> Baixar Excel
        </button>
        <button
          className="flex items-center gap-1.5 rounded-[13px] border border-[#7eae91] bg-[#2a674f] px-4 py-2.5 text-xs font-bold text-[#d7f1df] transition hover:bg-[#347a5e]"
          onClick={exportPdf}
        >
          <FiDownload size={15} aria-hidden="true" /> Baixar PDF
        </button>
        <button
          className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f]"
          onClick={exportCsv}
        >
          <FiDownload size={13} aria-hidden="true" /> CSV
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
                  <small className="mt-1 block text-xs text-[#789185]">
                    {row.registration} · {row.job_title || 'Sem função'}
                  </small>
                </td>
                <td className="px-2.5 py-3.5 tabular-nums">
                  {hours(Math.floor(row.expected_seconds / 60))}
                </td>
                <td className="px-2.5 py-3.5 tabular-nums">{hours(row.minutes)}</td>
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
        <section className="pt-2">
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
        Inclui jornadas em andamento e desconta intervalos. Horário de Brasília.{' '}
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
