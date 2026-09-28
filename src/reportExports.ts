import { hours, money, type Report } from './types'

/**
 * Gera um arquivo CSV a partir dos dados do relatório.
 */
export function buildCsv(report: Report, selected: string): Blob {
  const quote = (v: unknown) =>
    `"${String(v).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`
  const rows = [
    ['Funcionário', 'Matrícula', 'Departamento', 'Função', 'De', 'Até',
     'Horas previstas', 'Horas trabalhadas', 'Abonadas (atestado)', 'Total cumprido', 'Extras na folga', 'Valor/h extra (R$)', 'Total extras (R$)', 'Horas devidas', 'Horas de intervalo', 'Batidas'],
    ...report.rows
      .filter(row => !selected || String(row.id) === selected)
      .map(row => [
        row.name, row.registration, row.department, row.job_title,
        report.from, report.to,
        hours(Math.floor(row.expected_seconds / 60)),
        hours(row.minutes),
        hours(Math.floor(row.excused_seconds / 60)),
        hours(Math.floor(row.fulfilled_seconds / 60)),
        hours(Math.floor(row.off_day_work_seconds / 60)),
        money(row.overtime_rate_cents),
        money(row.overtime_pay_cents),
        hours(Math.floor(row.debt_seconds / 60)),
        hours(Math.floor(row.break_seconds / 60)),
        row.punches,
      ]),
  ]
  return new Blob(['\uFEFF' + rows.map(r => r.map(quote).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
}

/**
 * Gera uma planilha Excel (XML Spreadsheet) a partir dos dados do relatório.
 */
export function buildExcel(report: Report, selected: string): Blob {
  const rows = [
    ['Funcionário', 'Matrícula', 'Departamento', 'Função', 'Período',
     'Horas previstas', 'Horas trabalhadas', 'Abonadas (atestado)', 'Total cumprido', 'Extras na folga', 'Valor/h extra (R$)', 'Total extras (R$)', 'Horas devidas',
     'Intervalo realizado', 'Intervalo a mais', 'Batidas'],
    ...report.rows
      .filter(row => !selected || String(row.id) === selected)
      .map(row => [
        row.name, row.registration, row.department, row.job_title,
        `${report.from} a ${report.to}`,
        hours(Math.floor(row.expected_seconds / 60)),
        hours(row.minutes),
        hours(Math.floor(row.excused_seconds / 60)),
        hours(Math.floor(row.fulfilled_seconds / 60)),
        hours(Math.floor(row.off_day_work_seconds / 60)),
        money(row.overtime_rate_cents),
        money(row.overtime_pay_cents),
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

/**
 * Gera um documento PDF formatado a partir dos dados do relatório.
 */
export async function buildPdf(report: Report, selected: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const filtered = report.rows.filter(row => !selected || String(row.id) === selected)

  pdf.setFontSize(18); pdf.text('Relatório de horas', 14, 16)
  pdf.setFontSize(10); pdf.text(`Período: ${report.from} a ${report.to}`, 14, 23)

  const headers = ['Funcionário', 'Função', 'Previstas', 'Trabalhadas', 'Devidas', 'Intervalo', 'Int. a mais', 'Atestado', 'Extra folga']
  const x = [14, 62, 109, 134, 162, 186, 211, 236, 260]
  pdf.setFillColor(20, 63, 49); pdf.setTextColor(255, 255, 255)
  pdf.rect(10, 29, 277, 8, 'F')
  pdf.setFontSize(9)
  headers.forEach((h, i) => pdf.text(h, x[i], 34))
  pdf.setTextColor(30, 48, 40)

  let y = 44
  for (const row of filtered) {
    if (y > 182) { pdf.addPage('a4', 'landscape'); y = 18 }
    pdf.text(String(row.name).slice(0, 23), x[0], y)
    pdf.text(String(row.job_title || 'Sem função').slice(0, 22), x[1], y)
    pdf.text(hours(Math.floor(row.expected_seconds / 60)), x[2], y)
    pdf.text(hours(row.minutes), x[3], y)
    pdf.text(hours(Math.floor(row.debt_seconds / 60)), x[4], y)
    pdf.text(hours(Math.floor(row.break_seconds / 60)), x[5], y)
    pdf.text(hours(Math.floor(row.extra_break_seconds / 60)), x[6], y)
    pdf.text(hours(Math.floor(row.excused_seconds / 60)), x[7], y)
    pdf.text(hours(Math.floor(row.off_day_work_seconds / 60)), x[8], y)
    pdf.setFontSize(8)
    pdf.text(`Total cumprido: ${hours(Math.floor(row.fulfilled_seconds / 60))}   |   Valor/h extra: ${money(row.overtime_rate_cents)}   |   Total extras: ${money(row.overtime_pay_cents)}`, 14, y + 6)
    pdf.setFontSize(9)
    y += 16
  }
  pdf.setFontSize(8); pdf.setTextColor(90, 105, 96)
  pdf.text('Total cumprido = trabalhadas + atestado. Extras na folga não compensam devidas. Total extras usa o valor/h atual do funcionário.', 14, 202)
  return pdf.output('blob')
}
