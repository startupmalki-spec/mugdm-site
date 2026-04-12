import ExcelJS from 'exceljs'

export interface ParsedSheet {
  name: string
  headers: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

export interface ParsedExcel {
  sheets: ParsedSheet[]
  totalRows: number
  summary: string
}

const MAX_ROWS_PER_SHEET = 200

/**
 * Parses an Excel (.xlsx) or CSV buffer and returns structured data.
 * Limits to the first 200 rows per sheet to stay within Claude's context window.
 */
export async function parseExcelBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ParsedExcel> {
  const workbook = new ExcelJS.Workbook()
  const ext = fileName.toLowerCase().split('.').pop()

  try {
    if (ext === 'csv') {
      const { Readable } = await import('stream')
      const stream = Readable.from(buffer)
      await workbook.csv.read(stream)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message.includes('password') || message.includes('encrypt')) {
      throw new Error('This file appears to be password-protected. Please remove the password and try again.')
    }

    throw new Error(`Failed to parse file: ${message}`)
  }

  const sheets: ParsedSheet[] = []
  let totalRows = 0

  workbook.eachSheet((worksheet) => {
    const headers: string[] = []
    const rows: Record<string, unknown>[] = []

    // Extract headers from row 1
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const value = cell.text?.trim() || `Column_${colNumber}`
      headers[colNumber - 1] = value
    })

    // If no headers found, skip this sheet
    if (headers.length === 0) return

    // Fill any gaps in headers array
    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) {
        headers[i] = `Column_${i + 1}`
      }
    }

    // Extract data rows (starting from row 2)
    const dataRowCount = Math.min(worksheet.rowCount - 1, MAX_ROWS_PER_SHEET)
    for (let rowIdx = 2; rowIdx <= dataRowCount + 1; rowIdx++) {
      const row = worksheet.getRow(rowIdx)
      if (row.hasValues === false) continue

      const rowData: Record<string, unknown> = {}
      let hasAnyValue = false

      headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1)
        const value = extractCellValue(cell)
        if (value !== null && value !== undefined && value !== '') {
          hasAnyValue = true
        }
        rowData[header] = value
      })

      if (hasAnyValue) {
        rows.push(rowData)
      }
    }

    totalRows += worksheet.rowCount - 1 // Exclude header row

    sheets.push({
      name: worksheet.name || 'Sheet',
      headers,
      rows,
      rowCount: worksheet.rowCount - 1,
    })
  })

  if (sheets.length === 0) {
    throw new Error('No readable data found in the file.')
  }

  // Build summary
  const allHeaders = sheets.flatMap((s) => s.headers)
  const uniqueHeaders = [...new Set(allHeaders)]
  const columnPreview =
    uniqueHeaders.length > 8
      ? uniqueHeaders.slice(0, 8).join(', ') + '...'
      : uniqueHeaders.join(', ')

  const summary =
    `File: ${fileName} | ${sheets.length} sheet${sheets.length > 1 ? 's' : ''} | ` +
    `${totalRows} total rows | Columns: ${columnPreview}`

  return { sheets, totalRows, summary }
}

function extractCellValue(cell: ExcelJS.Cell): unknown {
  if (cell.type === ExcelJS.ValueType.Null) return null
  if (cell.type === ExcelJS.ValueType.Date) {
    return (cell.value as Date).toISOString().split('T')[0]
  }
  if (cell.type === ExcelJS.ValueType.Formula) {
    return cell.result
  }
  if (cell.type === ExcelJS.ValueType.RichText) {
    const richText = cell.value as ExcelJS.CellRichTextValue
    return richText.richText.map((rt) => rt.text).join('')
  }
  if (cell.type === ExcelJS.ValueType.Hyperlink) {
    const hyperlink = cell.value as ExcelJS.CellHyperlinkValue
    return hyperlink.text || hyperlink.hyperlink
  }
  return cell.value
}

