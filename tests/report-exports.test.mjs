import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import ExcelJS from 'exceljs'
import { reportFor } from '../server/reports.js'

test('exports preserve monetary values, incomplete totals and multipage PDF generation', async () => {
  const vite = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, configFile: false })
  try {
    const { buildCsv, buildPdf } = await vite.ssrLoadModule('/src/reportExports.ts')
    const { buildSpreadsheet } = await vite.ssrLoadModule('/src/reportSpreadsheet.ts')
    const rows = reportFor([{ id: 1, name: '=Unsafe formula', registration: '001', department: 'Equipe', hourly_rate_cents: 1500, overtime_rate_cents: 2500 }], [], '2026-01-01', '2026-01-31')
    Object.assign(rows[0], { work_seconds: 36000, regular_work_seconds: 28800, off_day_work_seconds: 7200, regular_pay_cents: 12000, overtime_pay_cents: 5000, total_pay_cents: 17000 })
    const report = { from: '2026-01-01', to: '2026-01-31', generated_at: new Date().toISOString(), rows }
    assert.ok((await buildCsv(report, '').text()).includes("'=Unsafe formula"))
    const blob = await buildSpreadsheet(report, '')
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(Buffer.from(await blob.arrayBuffer()))
    assert.equal(book.worksheets[0].getCell('U2').value, 170)
    assert.equal(book.worksheets[0].getCell('M2').value, 50)
    assert.equal(book.worksheets[0].getCell('T2').value, 120)
    assert.equal(book.worksheets[0].getCell('A2').type, ExcelJS.ValueType.String)
    const pdf = await buildPdf({ ...report, rows: Array.from({ length: 15 }, (_, i) => ({ ...rows[0], id: i + 1 })) }, '')
    const pdfText = await pdf.text()
    assert.ok(pdfText.startsWith('%PDF'))
    assert.ok((pdfText.match(/\/Type \/Page\b/g) || []).length >= 3)
    rows[0].total_pay_cents = null
    const incomplete = new ExcelJS.Workbook()
    await incomplete.xlsx.load(Buffer.from(await (await buildSpreadsheet(report, '')).arrayBuffer()))
    assert.equal(incomplete.worksheets[0].getCell('U2').value, null)
  } finally { await vite.close() }
})
