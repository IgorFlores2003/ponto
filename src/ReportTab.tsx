import { useMemo, useState } from 'react'
import { FiFileText, FiDownload, FiCamera, FiX } from 'react-icons/fi'
import ActionIcon from './ActionIcon'
import { Avatar } from './EmployeePhoto'
import { hours, timestamp, INPUT_CLASS, LABEL_CLASS, type Employee, type Entry, type Report } from './types'
import { deliverFile } from './deliverFile'

interface Props {
  report: Report
  employees: Employee[]
  entries: Entry[]
  selected: string
  from: string
  to: string
  loadingHistory: boolean
  onSelectEmployee: (id: string) => void
}

// ─── Geradores de arquivo ─────────────────────────────────────────────────────

function buildCsv(report: Report, selected: string): Blob {
  const quote = (v: unknown) =>
    `"${String(v).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`
  const rows = [
    ['Funcionário', 'Matrícula', 'Departamento', 'Função', 'De', 'Até',
     'Horas previstas', 'Horas trabalhadas', 'Horas devidas', 'Horas de intervalo', 'Batidas'],
    ...report.rows
      .filter(row => !selected || String(row.id) === selected)
      .map(row => [
        row.name, row.registration, row.department, row.job_title,
        report.from, report.to,
        hours(Math.floor(row.expected_seconds / 60)),
        hours(row.minutes),
        hours(Math.floor(row.debt_seconds / 60)),
        hours(Math.floor(row.break_seconds / 60)),
        row.punches,
      ]),
  ]
  return new Blob(['\uFEFF' + rows.map(r => r.map(quote).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
}

function buildExcel(report: Report, selected: string): Blob {
  const rows = [
    ['Funcionário', 'Matrícula', 'Departamento', 'Função', 'Período',
     'Horas previstas', 'Horas trabalhadas', 'Horas devidas',
     'Intervalo realizado', 'Intervalo a mais', 'Batidas'],
    ...report.rows
      .filter(row => !selected || String(row.id) === selected)
      .map(row => [
        row.name, row.registration, row.department, row.job_title,
        `${report.from} a ${report.to}`,
        hours(Math.floor(row.expected_seconds / 60)),
        hours(row.minutes),
        hours(Math.floor(row.debt_seconds / 60)),
        hours(Math.floor(row.break_seconds / 60)),
        hours(Math.floor(row.extra_break_seconds / 60)),
        row.punches,
      ]),
  ]
  const esc = (v: unknown) =>
    String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const xml =
    `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Relatório"><Table>` +
    rows.map(r => `<Row>${r.map(v => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`).join('')}</Row>`).join('') +
    `</Table></Worksheet></Workbook>`
  return new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
}

async function buildPdf(report: Report, selected: string) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const filtered = report.rows.filter(row => !selected || String(row.id) === selected)

  pdf.setFontSize(18); pdf.text('Relatório de horas', 14, 16)
  pdf.setFontSize(10); pdf.text(`Período: ${report.from} a ${report.to}`, 14, 23)

  const headers = ['Funcionário', 'Função', 'Previstas', 'Trabalhadas', 'Devidas', 'Intervalo', 'A mais']
  const x = [14, 75, 145, 175, 205, 235, 265]
  pdf.setFillColor(20, 63, 49); pdf.setTextColor(255, 255, 255)
  pdf.rect(10, 29, 277, 8, 'F')
  pdf.setFontSize(9)
  headers.forEach((h, i) => pdf.text(h, x[i], 34))
  pdf.setTextColor(30, 48, 40)

  let y = 44
  for (const row of filtered) {
    if (y > 190) { pdf.addPage('a4', 'landscape'); y = 18 }
    pdf.text(String(row.name).slice(0, 28), x[0], y)
    pdf.text(String(row.job_title || 'Sem função').slice(0, 24), x[1], y)
    pdf.text(hours(Math.floor(row.expected_seconds / 60)), x[2], y)
    pdf.text(hours(row.minutes), x[3], y)
    pdf.text(hours(Math.floor(row.debt_seconds / 60)), x[4], y)
    pdf.text(hours(Math.floor(row.break_seconds / 60)), x[5], y)
    pdf.text(hours(Math.floor(row.extra_break_seconds / 60)), x[6], y)
    y += 8
  }
  pdf.setFontSize(8); pdf.setTextColor(90, 105, 96)
  pdf.text('Horas devidas = previstas menos trabalhadas. Intervalo a mais = pausas acima do esperado.', 14, 202)
  return pdf.output('blob')
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ReportTab({
  report, employees, entries, selected, from, to, loadingHistory, onSelectEmployee,
}: Props) {
  const [selectedPhoto, setSelectedPhoto] = useState<{ photo: string; title: string; time: string } | null>(null)

  const rows = useMemo(
    () => report.rows.filter(row => !selected || String(row.id) === selected),
    [report, selected],
  )

  const visibleEntries = useMemo(
    () =>
      entries
        .filter(entry => {
          const date = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
          }).format(new Date(entry.occurred_at))
          return date >= from && date <= to
        })
        .slice()
        .reverse(),
    [entries, from, to],
  )

  function exportCsv() { void deliverFile(buildCsv(report, selected), `horas-${report.from}-${report.to}.csv`) }
  function exportExcel() { void deliverFile(buildExcel(report, selected), `relatorio-horas-${report.from}-${report.to}.xls`) }
  async function exportPdf() { void deliverFile(await buildPdf(report, selected), `relatorio-horas-${report.from}-${report.to}.pdf`) }

  const selectedEmployee = employees.find(e => String(e.id) === selected)

  return (
    <>
      <label className="mb-5 grid gap-1.5 text-xs font-bold text-[#527566]">
        Funcionário
        <select value={selected} className={INPUT_CLASS} onChange={e => onSelectEmployee(e.target.value)}>
          <option value="">Todos os funcionários</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.name} · {e.registration}</option>
          ))}
        </select>
      </label>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <button className="flex items-center gap-1.5 rounded-[13px] bg-[#cef1d6] px-4 py-2.5 text-xs font-bold text-[#173d2f] transition hover:bg-[#e1f9e6]" onClick={exportExcel}>
          <FiFileText size={15} aria-hidden="true" /> Baixar Excel
        </button>
        <button className="flex items-center gap-1.5 rounded-[13px] border border-[#7eae91] bg-[#2a674f] px-4 py-2.5 text-xs font-bold text-[#d7f1df] transition hover:bg-[#347a5e]" onClick={exportPdf}>
          <FiDownload size={15} aria-hidden="true" /> Baixar PDF
        </button>
        <button className="flex items-center gap-1 bg-transparent text-xs font-bold text-[#317455] hover:text-[#173d2f]" onClick={exportCsv}>
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
                  <small className="mt-1 block text-xs text-[#789185]">{row.registration} · {row.job_title || 'Sem função'}</small>
                </td>
                <td className="px-2.5 py-3.5 tabular-nums">{hours(Math.floor(row.expected_seconds / 60))}</td>
                <td className="px-2.5 py-3.5 tabular-nums">{hours(row.minutes)}</td>
                <td className={`px-2.5 py-3.5 font-bold tabular-nums ${row.debt_seconds ? 'text-[#a24636]' : ''}`}>
                  {hours(Math.floor(row.debt_seconds / 60))}
                </td>
                <td className="px-2.5 py-3.5 tabular-nums">{hours(Math.floor(row.break_seconds / 60))}</td>
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
            visibleEntries.map(entry => (
              <div className="flex items-center justify-between gap-2.5 border-b border-[#edf0ee] px-1 py-3" key={entry.id}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <ActionIcon kind={entry.kind} breakName={entry.break_name} />
                  <div>
                    <strong className="block text-xs text-[#143f31]">
                      {entry.kind}{entry.break_name ? ` · ${entry.break_name}` : ''}
                    </strong>
                    <span className="block text-[11px] text-[#82958b]">{timestamp(entry.occurred_at)}</span>
                  </div>
                </div>
                {entry.punch_photo ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPhoto({
                        photo: entry.punch_photo!,
                        title: `${entry.kind}${entry.break_name ? ` · ${entry.break_name}` : ''}`,
                        time: timestamp(entry.occurred_at),
                      })
                    }
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#cbded2] bg-[#f7fbf9] px-2.5 py-1 text-xs font-semibold text-[#1f4a38] transition hover:bg-[#e4efe8]"
                  >
                    <FiCamera size={13} aria-hidden="true" />
                    Abrir foto
                  </button>
                ) : null}
              </div>
            ))
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

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#edf0ee] pb-3">
              <div>
                <h4 className="text-sm font-bold text-[#143f31]">{selectedPhoto.title}</h4>
                <p className="text-[11px] text-[#82958b]">{selectedPhoto.time}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="rounded-lg p-1.5 text-[#527566] transition hover:bg-[#edf0ee]"
                aria-label="Fechar"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="mt-4 flex max-h-[380px] items-center justify-center overflow-hidden rounded-xl border border-[#cbded2] bg-neutral-900">
              <img
                src={selectedPhoto.photo}
                alt={`Foto da batida ${selectedPhoto.title}`}
                className="max-h-[380px] w-full object-contain"
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="mt-4 w-full rounded-xl bg-[#2a674f] py-2.5 text-xs font-bold text-white transition hover:bg-[#1e4d3a]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
