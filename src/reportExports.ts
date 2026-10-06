import { formatDate, hours, money, type Report } from './types'

/**
 * Gera um arquivo CSV a partir dos dados do relatório.
 */
export function buildCsv(report: Report, selected: string): Blob {
  const quote = (v: unknown) =>
    `"${String(v).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`
  const rows = [
    ['Funcionário', 'Matrícula', 'Departamento', 'Função', 'De', 'Até',
     'Horas previstas', 'Horas trabalhadas', 'Abonadas (atestado)', 'Total cumprido', 'Extras na folga', 'Valor/h extra (R$)', 'Total extras (R$)', 'Horas devidas', 'Horas de intervalo', 'Batidas', 'Horas normais', 'Valor/h normal (R$)', 'Valor horas normais (R$)', 'Total a pagar (R$)'],
    ...report.rows
      .filter(row => !selected || String(row.id) === selected)
      .map(row => [
        row.name, row.registration, row.department, row.job_title,
        formatDate(report.from), formatDate(report.to),
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
        hours(Math.floor(row.regular_work_seconds / 60)),
        money(row.hourly_rate_cents), money(row.regular_pay_cents), money(row.total_pay_cents),
      ]),
  ]
  return new Blob(['\uFEFF' + rows.map(r => r.map(quote).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
}

/**
 * Gera um documento PDF formatado a partir dos dados do relatório.
 */
export async function buildPdf(report: Report, selected: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const filtered = report.rows.filter(row => !selected || String(row.id) === selected)

  const headers = ['Funcionário', 'Função', 'Previstas', 'Trabalhadas', 'Devidas', 'Intervalo', 'Int. a mais', 'Atestado', 'Extra folga']
  const x = [14, 62, 109, 134, 162, 186, 211, 236, 260]
  function pageHeader() {
    pdf.setFillColor(20, 63, 49); pdf.rect(0, 0, 297, 31, 'F')
    pdf.setTextColor(190, 221, 203); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8)
    pdf.text('PONTO DIGITAL / GESTÃO DE JORNADAS', 14, 9)
    pdf.setTextColor(255, 255, 255); pdf.setFontSize(18); pdf.text('Relatório de horas', 14, 19)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
    pdf.text(`${formatDate(report.from)} a ${formatDate(report.to)} | ${filtered.length} funcionário(s)`, 14, 26)
    pdf.setFillColor(234, 245, 238); pdf.rect(10, 36, 277, 10, 'F')
    pdf.setTextColor(30, 70, 48); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
    headers.forEach((h, i) => pdf.text(h, x[i], 42))
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 48, 40)
  }
  pageHeader()
  let y = 53
  let index = 0
  for (const row of filtered) {
    if (y > 170) { pdf.addPage('a4', 'landscape'); pageHeader(); y = 53 }
    if (index++ % 2 === 0) { pdf.setFillColor(246, 249, 247); pdf.rect(10, y - 5, 277, 23, 'F') }
    pdf.setDrawColor(220, 232, 225); pdf.line(10, y + 18, 287, y + 18)
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
    pdf.text(`Hora normal: ${money(row.hourly_rate_cents)}   |   Horas normais: ${hours(Math.floor(row.regular_work_seconds / 60))}   |   Valor normal: ${money(row.regular_pay_cents)}   |   Total a pagar: ${money(row.total_pay_cents)}`, 14, y + 11)
    pdf.setFontSize(9)
    y += 25
  }
  if (!filtered.length) pdf.text('Nenhum funcionário para o filtro selecionado.', 14, 55)
  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page)
    pdf.setDrawColor(220, 232, 225); pdf.line(14, 190, 283, 190)
    pdf.setFontSize(8); pdf.setTextColor(90, 105, 96)
    pdf.text('Total cumprido = trabalhadas + atestado. Extras na folga não compensam horas devidas.', 14, 195)
    pdf.text(report.closed_at ? 'Mês fechado: valores e tarifas preservados. Intervalos e atestados não entram no total em reais.' : 'Valores calculados com as tarifas atuais. Intervalos e atestados não entram no total em reais.', 14, 200)
    pdf.text(`Página ${page} de ${pages}`, 283, 200, { align: 'right' })
  }
  return pdf.output('blob')
}
