import ExcelJS from 'exceljs'
import { downloadBlob } from '@/lib/bookkeeper/export'
import type { VATReportData } from '@/lib/bookkeeper/vat-report'
import type { ProfitLossData } from '@/lib/bookkeeper/profit-loss'
import type { BalanceSheetData } from '@/lib/bookkeeper/balance-sheet'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1a1a2e' },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
}

/**
 * Export a VAT Report to Excel (.xlsx) and trigger download.
 */
export async function exportVATReportToExcel(
  report: VATReportData,
  businessName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Mugdm Bookkeeper'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('VAT Report')

  // Title
  sheet.addRow([`${businessName} - VAT Report`])
  sheet.mergeCells('A1:F1')
  const titleRow = sheet.getRow(1)
  titleRow.font = { bold: true, size: 14 }
  titleRow.alignment = { horizontal: 'center' }

  // Period
  sheet.addRow([`Period: ${report.period.start} to ${report.period.end}`])
  sheet.mergeCells('A2:F2')
  sheet.getRow(2).alignment = { horizontal: 'center' }

  sheet.addRow([]) // blank row

  // Summary section
  sheet.addRow(['VAT Summary'])
  sheet.getRow(4).font = { bold: true, size: 12 }

  sheet.addRow(['Total Sales (incl. VAT)', report.totalSales])
  sheet.addRow(['Total Purchases (incl. VAT)', report.totalPurchases])
  sheet.addRow(['Output VAT (15%)', report.outputVAT])
  sheet.addRow(['Input VAT', report.inputVAT])

  const netRow = sheet.addRow(['Net VAT Payable', report.netVAT])
  netRow.font = { bold: true }

  sheet.addRow([]) // blank row

  // Transactions detail
  const headerRowNum = sheet.rowCount + 1
  sheet.addRow(['Date', 'Description', 'Type', 'Amount (SAR)', 'VAT (SAR)'])
  const hdr = sheet.getRow(headerRowNum)
  hdr.font = HEADER_FONT
  hdr.fill = HEADER_FILL
  hdr.alignment = { horizontal: 'center' }

  for (const tx of report.transactions) {
    sheet.addRow([
      tx.date,
      tx.description,
      tx.type === 'sale' ? 'Sale' : 'Purchase',
      tx.amount,
      tx.vat,
    ])
  }

  // Column widths
  sheet.getColumn(1).width = 14
  sheet.getColumn(2).width = 35
  sheet.getColumn(3).width = 12
  sheet.getColumn(4).width = 15
  sheet.getColumn(4).numFmt = '#,##0.00'
  sheet.getColumn(5).width = 12
  sheet.getColumn(5).numFmt = '#,##0.00'

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const dateStr = report.period.start.replace(/-/g, '')
  downloadBlob(blob, `vat-report-${dateStr}.xlsx`)
}

/**
 * Export a Profit & Loss statement to Excel (.xlsx) and trigger download.
 */
export async function exportProfitLossToExcel(
  report: ProfitLossData,
  businessName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Mugdm Bookkeeper'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Profit & Loss')

  // Title
  sheet.addRow([`${businessName} - Profit & Loss Statement`])
  sheet.mergeCells('A1:C1')
  const titleRow = sheet.getRow(1)
  titleRow.font = { bold: true, size: 14 }
  titleRow.alignment = { horizontal: 'center' }

  // Period
  sheet.addRow([`Period: ${report.period.start} to ${report.period.end}`])
  sheet.mergeCells('A2:C2')
  sheet.getRow(2).alignment = { horizontal: 'center' }

  sheet.addRow([]) // blank row

  // Revenue section
  const revHeaderRow = sheet.addRow(['Revenue', '', 'Amount (SAR)'])
  revHeaderRow.font = HEADER_FONT
  revHeaderRow.fill = HEADER_FILL

  for (const rev of report.revenue) {
    sheet.addRow(['', rev.category, rev.amount])
  }

  const totalRevRow = sheet.addRow(['', 'Total Revenue', report.totalRevenue])
  totalRevRow.font = { bold: true }

  sheet.addRow([]) // blank row

  // Expenses section
  const expHeaderRow = sheet.addRow(['Expenses', '', 'Amount (SAR)'])
  expHeaderRow.font = HEADER_FONT
  expHeaderRow.fill = HEADER_FILL

  for (const exp of report.expenses) {
    sheet.addRow(['', exp.category, exp.amount])
  }

  const totalExpRow = sheet.addRow(['', 'Total Expenses', report.totalExpenses])
  totalExpRow.font = { bold: true }

  sheet.addRow([]) // blank row

  // Summary
  const gpRow = sheet.addRow(['', 'Gross Profit', report.grossProfit])
  gpRow.font = { bold: true }

  const npRow = sheet.addRow(['', 'Net Profit', report.netProfit])
  npRow.font = { bold: true }

  const marginRow = sheet.addRow(['', 'Profit Margin', `${report.profitMargin}%`])
  marginRow.font = { bold: true }

  // Column widths
  sheet.getColumn(1).width = 18
  sheet.getColumn(2).width = 30
  sheet.getColumn(3).width = 18
  sheet.getColumn(3).numFmt = '#,##0.00'

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const dateStr = report.period.start.replace(/-/g, '')
  downloadBlob(blob, `profit-loss-${dateStr}.xlsx`)
}

/**
 * Export a Balance Sheet to Excel (.xlsx) and trigger download.
 */
export async function exportBalanceSheetToExcel(
  report: BalanceSheetData,
  businessName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Mugdm Bookkeeper'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Balance Sheet')

  // Title
  sheet.addRow([`${businessName} - Balance Sheet`])
  sheet.mergeCells('A1:C1')
  const titleRow = sheet.getRow(1)
  titleRow.font = { bold: true, size: 14 }
  titleRow.alignment = { horizontal: 'center' }

  // Period
  sheet.addRow([`As of: ${report.period.end}`])
  sheet.mergeCells('A2:C2')
  sheet.getRow(2).alignment = { horizontal: 'center' }

  sheet.addRow([]) // blank row

  // Assets section
  const assetsHeader = sheet.addRow(['Assets', '', 'Amount (SAR)'])
  assetsHeader.font = HEADER_FONT
  assetsHeader.fill = HEADER_FILL

  sheet.addRow(['', 'Cash & Cash Equivalents', report.assets.cash])
  sheet.addRow(['', 'Accounts Receivable', report.assets.receivables])

  const totalAssetsRow = sheet.addRow(['', 'Total Assets', report.assets.total])
  totalAssetsRow.font = { bold: true }

  sheet.addRow([]) // blank row

  // Liabilities section
  const liabHeader = sheet.addRow(['Liabilities', '', 'Amount (SAR)'])
  liabHeader.font = HEADER_FONT
  liabHeader.fill = HEADER_FILL

  sheet.addRow(['', 'VAT Payable', report.liabilities.vatPayable])
  sheet.addRow(['', 'Accounts Payable', report.liabilities.payables])

  const totalLiabRow = sheet.addRow(['', 'Total Liabilities', report.liabilities.total])
  totalLiabRow.font = { bold: true }

  sheet.addRow([]) // blank row

  // Equity section
  const equityHeader = sheet.addRow(['Equity', '', 'Amount (SAR)'])
  equityHeader.font = HEADER_FONT
  equityHeader.fill = HEADER_FILL

  sheet.addRow(['', "Owner's Equity", report.equity.ownerEquity])
  sheet.addRow(['', 'Retained Earnings', report.equity.retainedEarnings])

  const totalEquityRow = sheet.addRow(['', 'Total Equity', report.equity.total])
  totalEquityRow.font = { bold: true }

  sheet.addRow([]) // blank row

  // Balance check
  const balanceRow = sheet.addRow(['', 'Assets = Liabilities + Equity', report.balances ? 'Balanced' : 'Unbalanced'])
  balanceRow.font = { bold: true, color: { argb: report.balances ? 'FF22c55e' : 'FFef4444' } }

  // Column widths
  sheet.getColumn(1).width = 18
  sheet.getColumn(2).width = 30
  sheet.getColumn(3).width = 18
  sheet.getColumn(3).numFmt = '#,##0.00'

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const dateStr = report.period.end.replace(/-/g, '')
  downloadBlob(blob, `balance-sheet-${dateStr}.xlsx`)
}
