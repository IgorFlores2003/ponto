import type { Report } from './types'

export async function buildSpreadsheet(report: Report, selected: string): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Ponto Digital'
  const sheet = workbook.addWorksheet('Relatório', { views: [{ state: 'frozen', ySplit: 1 }] })
  const headers = ['Funcionário', 'Matrícula', 'Departamento', 'Função', 'De', 'Até', 'Horas previstas', 'Horas trabalhadas', 'Abonadas (atestado)', 'Total cumprido', 'Extras na folga', 'Valor/h extra (R$)', 'Total extras (R$)', 'Horas devidas', 'Intervalo realizado', 'Intervalo a mais', 'Batidas', 'Horas normais', 'Valor/h normal (R$)', 'Valor horas normais (R$)', 'Total trabalhado (R$)']
  sheet.addRow(headers)
  const rows = report.rows.filter(row => !selected || String(row.id) === selected)
  for (const row of rows) {
    sheet.addRow([
      row.name, row.registration, row.department, row.job_title, report.from, report.to,
      row.expected_seconds / 86400, row.work_seconds / 86400, row.excused_seconds / 86400,
      row.fulfilled_seconds / 86400, row.off_day_work_seconds / 86400,
      row.overtime_rate_cents === null ? null : row.overtime_rate_cents / 100,
      row.overtime_pay_cents === null ? null : row.overtime_pay_cents / 100,
      row.debt_seconds / 86400, row.break_seconds / 86400, row.extra_break_seconds / 86400, row.punches,
      row.regular_work_seconds / 86400,
      row.hourly_rate_cents == null ? null : row.hourly_rate_cents / 100,
      row.regular_pay_cents == null ? null : row.regular_pay_cents / 100,
      row.total_pay_cents == null ? null : row.total_pay_cents / 100,
    ])
  }
  headers.forEach((_, index) => { sheet.getColumn(index + 1).width = index === 0 ? 30 : index < 4 ? 20 : index < 6 ? 13 : 23 })
  for (const column of [7, 8, 9, 10, 11, 14, 15, 16, 18]) sheet.getColumn(column).numFmt = '[h]:mm'
  for (const column of [12, 13, 19, 20, 21]) sheet.getColumn(column).numFmt = '"R$" #,##0.00'
  sheet.getColumn(17).numFmt = '0'
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF143F31' } }
  sheet.getRow(1).alignment = { wrapText: true, vertical: 'middle' }
  sheet.getRow(1).height = 32
  sheet.autoFilter = { from: 'A1', to: `U${rows.length + 1}` }
  const notes = workbook.addWorksheet('Informações')
  notes.getColumn(1).width = 110
  notes.addRows([
    ['Ponto Digital — relatório de horas'],
    [`Período: ${report.from} a ${report.to}`],
    ['Horas são valores de duração e podem ser somadas. Valores em reais são numéricos.'],
    ['Valor/h extra é a tarifa atual do funcionário. Total extras corresponde ao trabalho em folgas.'],
    ['Horas normais = trabalhadas fora das folgas. Total trabalhado em reais = valor das horas normais + extras nas folgas.'],
    ['Intervalos e horas abonadas não entram no valor trabalhado. Tarifas atuais recalculam períodos anteriores.'],
    ['Células monetárias vazias indicam tarifa não cadastrada; não significam zero.'],
    ['Pontos e relatórios são preservados após a exclusão das fotos por retenção.'],
  ])
  const bytes = await workbook.xlsx.writeBuffer()
  return new Blob([new Uint8Array(bytes).buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
