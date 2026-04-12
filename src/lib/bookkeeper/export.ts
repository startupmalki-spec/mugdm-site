import ExcelJS from 'exceljs'
import type { Transaction } from '@/lib/supabase/types'

/**
 * Export an array of transactions to an Excel (.xlsx) Blob.
 * Uses ExcelJS which is already installed in the project.
 */
export async function exportTransactionsToExcel(
  transactions: Transaction[],
  businessName: string
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Mugdm Bookkeeper'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Transactions')

  // Define columns
  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Description', key: 'description', width: 35 },
    { header: 'Vendor / Client', key: 'vendor_or_client', width: 25 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Amount (SAR)', key: 'amount', width: 15 },
    { header: 'VAT (SAR)', key: 'vat_amount', width: 12 },
    { header: 'Source', key: 'source', width: 18 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1a1a2e' },
  }
  headerRow.alignment = { horizontal: 'center' }

  // Add data rows
  for (const tx of transactions) {
    sheet.addRow({
      date: tx.date,
      description: tx.description ?? '',
      vendor_or_client: tx.vendor_or_client ?? '',
      category: tx.category ?? '',
      type: tx.type,
      amount: tx.amount,
      vat_amount: tx.vat_amount ?? '',
      source: tx.source.replace(/_/g, ' '),
    })
  }

  // Format amount columns as numbers
  sheet.getColumn('amount').numFmt = '#,##0.00'
  sheet.getColumn('vat_amount').numFmt = '#,##0.00'

  // Add summary row
  const summaryRow = sheet.addRow({
    date: '',
    description: `Total (${transactions.length} transactions)`,
    vendor_or_client: '',
    category: '',
    type: '',
    amount: transactions.reduce((s, tx) => s + (tx.type === 'INCOME' ? tx.amount : -tx.amount), 0),
    vat_amount: '',
    source: '',
  })
  summaryRow.font = { bold: true }

  // Add business name in a header area
  sheet.insertRow(1, [`${businessName} — Transactions Export`])
  sheet.mergeCells('A1:H1')
  const titleRow = sheet.getRow(1)
  titleRow.font = { bold: true, size: 14 }
  titleRow.alignment = { horizontal: 'center' }

  // Re-style the actual header row (now row 2)
  const actualHeader = sheet.getRow(2)
  actualHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  actualHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1a1a2e' },
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Trigger browser download of a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Parse an Excel/CSV file client-side and return parsed transaction rows
 * for preview before import. Uses ExcelJS.
 */
export interface ImportPreviewRow {
  date: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  description: string
  vendor_or_client: string
  category: string
}

export async function parseImportFile(file: File): Promise<ImportPreviewRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  const ext = file.name.toLowerCase().split('.').pop()

  if (ext === 'csv') {
    const { Readable } = await import('stream')
    const stream = Readable.from(Buffer.from(buffer))
    await workbook.csv.read(stream)
  } else {
    await workbook.xlsx.load(buffer)
  }

  const rows: ImportPreviewRow[] = []
  const sheet = workbook.worksheets[0]
  if (!sheet) return rows

  // Extract headers from row 1
  const headers: string[] = []
  const headerRow = sheet.getRow(1)
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = (cell.text?.trim() ?? '').toLowerCase()
  })

  // Try to map columns
  const dateCol = headers.findIndex((h) =>
    ['date', 'تاريخ', 'transaction date', 'value date'].some((k) => h.includes(k))
  )
  const amountCol = headers.findIndex((h) =>
    ['amount', 'مبلغ', 'debit', 'credit', 'value'].some((k) => h.includes(k))
  )
  const descCol = headers.findIndex((h) =>
    ['description', 'وصف', 'details', 'narration', 'memo', 'reference'].some((k) => h.includes(k))
  )

  if (dateCol === -1 || amountCol === -1) return rows

  for (let rowIdx = 2; rowIdx <= Math.min(sheet.rowCount, 201); rowIdx++) {
    const row = sheet.getRow(rowIdx)
    if (!row.hasValues) continue

    const dateVal = row.getCell(dateCol + 1).text?.trim() ?? ''
    const amountVal = parseFloat(
      (row.getCell(amountCol + 1).text ?? '0').replace(/[^0-9.\-]/g, '')
    )
    const descVal = descCol >= 0 ? (row.getCell(descCol + 1).text?.trim() ?? '') : ''

    if (!dateVal || isNaN(amountVal) || amountVal === 0) continue

    rows.push({
      date: dateVal,
      amount: Math.abs(amountVal),
      type: amountVal >= 0 ? 'INCOME' : 'EXPENSE',
      description: descVal,
      vendor_or_client: '',
      category: '',
    })
  }

  return rows
}
