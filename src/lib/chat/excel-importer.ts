import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface ImportResult {
  type: 'transactions' | 'team_members' | 'obligations'
  imported: number
  skipped: number
  errors: string[]
  message: string
}

type DataType = ImportResult['type']

/**
 * Import parsed Excel rows into the appropriate Supabase table.
 *
 * @param columnMapping - maps Excel column names to Mugdm field names,
 *   e.g. { "Date": "date", "Amount (SAR)": "amount", "Type": "type" }
 */
export async function importExcelData(
  supabase: SupabaseClient,
  businessId: string,
  dataType: DataType,
  rows: Record<string, unknown>[],
  columnMapping: Record<string, string>
): Promise<ImportResult> {
  const errors: string[] = []
  let imported = 0
  let skipped = 0

  // Map each row's keys from Excel column names to Mugdm field names
  const mappedRows = rows.map((row, idx) => {
    const mapped: Record<string, unknown> = {}
    for (const [excelCol, mugdmField] of Object.entries(columnMapping)) {
      if (mugdmField && row[excelCol] !== undefined) {
        mapped[mugdmField] = row[excelCol]
      }
    }
    return { index: idx + 1, data: mapped }
  })

  switch (dataType) {
    case 'transactions':
      ({ imported, skipped } = await importTransactions(
        supabase,
        businessId,
        mappedRows,
        errors
      ))
      break
    case 'team_members':
      ({ imported, skipped } = await importTeamMembers(
        supabase,
        businessId,
        mappedRows,
        errors
      ))
      break
    case 'obligations':
      ({ imported, skipped } = await importObligations(
        supabase,
        businessId,
        mappedRows,
        errors
      ))
      break
  }

  const errorSummary =
    errors.length > 0
      ? ` Errors: ${errors.slice(0, 10).join('; ')}${errors.length > 10 ? ` ...and ${errors.length - 10} more` : ''}`
      : ''

  return {
    type: dataType,
    imported,
    skipped,
    errors,
    message: `Imported ${imported} ${dataType.replace('_', ' ')}, skipped ${skipped}.${errorSummary}`,
  }
}

// ── Transactions ──────────────────────────────────────────────────

async function importTransactions(
  supabase: SupabaseClient,
  businessId: string,
  rows: { index: number; data: Record<string, unknown> }[],
  errors: string[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  const validPayloads: Record<string, unknown>[] = []

  for (const { index, data } of rows) {
    const date = normalizeDate(data.date)
    const amount = normalizeNumber(data.amount)
    const type = normalizeTransactionType(data.type)
    const category = String(data.category ?? 'GENERAL').trim().toUpperCase()
    const description = String(data.description ?? '').trim()
    const vendorOrClient = data.vendor_or_client
      ? String(data.vendor_or_client).trim()
      : null

    if (!date) {
      errors.push(`Row ${index}: missing or invalid date`)
      skipped++
      continue
    }
    if (amount === null || amount <= 0) {
      errors.push(`Row ${index}: missing or invalid amount`)
      skipped++
      continue
    }
    if (!type) {
      errors.push(`Row ${index}: type must be INCOME or EXPENSE`)
      skipped++
      continue
    }

    validPayloads.push({
      business_id: businessId,
      date,
      amount,
      type,
      category,
      description: description || category,
      vendor_or_client: vendorOrClient,
      source: 'EXCEL_IMPORT' as const,
      source_file_id: null,
      receipt_url: null,
      linked_obligation_id: null,
      vat_amount: null,
      ai_confidence: null,
      is_reviewed: false,
    })
  }

  // Batch insert in chunks of 50
  for (let i = 0; i < validPayloads.length; i += 50) {
    const chunk = validPayloads.slice(i, i + 50)
    const { error } = await supabase
      .from('transactions')
      .insert(chunk as never[])

    if (error) {
      errors.push(`Batch insert failed (rows ${i + 1}-${i + chunk.length}): ${error.message}`)
      skipped += chunk.length
    } else {
      imported += chunk.length
    }
  }

  return { imported, skipped }
}

// ── Team members ──────────────────────────────────────────────────

async function importTeamMembers(
  supabase: SupabaseClient,
  businessId: string,
  rows: { index: number; data: Record<string, unknown> }[],
  errors: string[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  const validPayloads: Record<string, unknown>[] = []

  for (const { index, data } of rows) {
    const name = String(data.name ?? '').trim()
    const nationality = String(data.nationality ?? '').trim()

    if (!name) {
      errors.push(`Row ${index}: missing name`)
      skipped++
      continue
    }
    if (!nationality) {
      errors.push(`Row ${index}: missing nationality`)
      skipped++
      continue
    }

    const salary = normalizeNumber(data.salary)
    const startDate = normalizeDate(data.start_date)

    validPayloads.push({
      business_id: businessId,
      name,
      nationality,
      role: data.role ? String(data.role).trim() : null,
      salary: salary ?? null,
      start_date: startDate || new Date().toISOString().split('T')[0],
      iqama_number: data.iqama_number ? String(data.iqama_number).trim() : null,
      status: 'ACTIVE' as const,
    })
  }

  for (let i = 0; i < validPayloads.length; i += 50) {
    const chunk = validPayloads.slice(i, i + 50)
    const { error } = await supabase
      .from('team_members')
      .insert(chunk as never[])

    if (error) {
      errors.push(`Batch insert failed (rows ${i + 1}-${i + chunk.length}): ${error.message}`)
      skipped += chunk.length
    } else {
      imported += chunk.length
    }
  }

  return { imported, skipped }
}

// ── Obligations ───────────────────────────────────────────────────

async function importObligations(
  supabase: SupabaseClient,
  businessId: string,
  rows: { index: number; data: Record<string, unknown> }[],
  errors: string[]
): Promise<{ imported: number; skipped: number }> {
  let imported = 0
  let skipped = 0

  const validFrequencies = new Set([
    'MONTHLY',
    'QUARTERLY',
    'ANNUAL',
    'ONE_TIME',
    'CUSTOM',
  ])

  const validPayloads: Record<string, unknown>[] = []

  for (const { index, data } of rows) {
    const name = String(data.name ?? '').trim()
    const type = String(data.type ?? '').trim().toUpperCase()
    const frequency = String(data.frequency ?? '').trim().toUpperCase()
    const nextDueDate = normalizeDate(data.next_due_date)

    if (!name) {
      errors.push(`Row ${index}: missing name`)
      skipped++
      continue
    }
    if (!type) {
      errors.push(`Row ${index}: missing type`)
      skipped++
      continue
    }
    if (!validFrequencies.has(frequency)) {
      errors.push(
        `Row ${index}: invalid frequency "${frequency}" (must be MONTHLY, QUARTERLY, ANNUAL, ONE_TIME, or CUSTOM)`
      )
      skipped++
      continue
    }
    if (!nextDueDate) {
      errors.push(`Row ${index}: missing or invalid next_due_date`)
      skipped++
      continue
    }

    validPayloads.push({
      business_id: businessId,
      name,
      type,
      frequency,
      next_due_date: nextDueDate,
      description: data.description ? String(data.description).trim() : null,
      last_completed_at: null,
      reminder_30d_sent: false,
      reminder_15d_sent: false,
      reminder_7d_sent: false,
      reminder_1d_sent: false,
      linked_document_id: null,
      notes: data.notes ? String(data.notes).trim() : null,
    })
  }

  for (let i = 0; i < validPayloads.length; i += 50) {
    const chunk = validPayloads.slice(i, i + 50)
    const { error } = await supabase
      .from('obligations')
      .insert(chunk as never[])

    if (error) {
      errors.push(`Batch insert failed (rows ${i + 1}-${i + chunk.length}): ${error.message}`)
      skipped += chunk.length
    } else {
      imported += chunk.length
    }
  }

  return { imported, skipped }
}

// ── Helpers ───────────────────────────────────────────────────────

/** Attempt to normalise a value to YYYY-MM-DD. */
function normalizeDate(value: unknown): string | null {
  if (!value) return null
  const str = String(value).trim()

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str

  // ISO datetime
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.split('T')[0]

  // DD/MM/YYYY or DD-MM-YYYY (common in Saudi/GCC)
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // MM/DD/YYYY fallback
  const mdy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (mdy) {
    const [, m, d, y] = mdy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Try Date parse as last resort
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }

  return null
}

/** Coerce a value to a positive number, or null. */
function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[,\s]/g, ''))
  return isNaN(n) ? null : n
}

/** Normalise "income"/"expense" variants to INCOME/EXPENSE. */
function normalizeTransactionType(
  value: unknown
): 'INCOME' | 'EXPENSE' | null {
  if (!value) return null
  const str = String(value).trim().toUpperCase()
  if (['INCOME', 'REVENUE', 'SALE', 'SALES', 'CREDIT'].includes(str))
    return 'INCOME'
  if (['EXPENSE', 'COST', 'PURCHASE', 'DEBIT', 'PAYMENT'].includes(str))
    return 'EXPENSE'
  return null
}
