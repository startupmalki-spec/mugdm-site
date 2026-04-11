import type { SupabaseClient } from '@supabase/supabase-js'
import { addMonths } from 'date-fns'

import type { ObligationType, Transaction } from '@/lib/supabase/types'

interface DetectionResult {
  isGovernment: boolean
  obligationType: ObligationType | null
  confidence: number
}

interface LinkResult {
  transactionId: string
  obligationType: ObligationType
  linked: boolean
}

// Each entry: [exact entity patterns (confidence 1.0), keyword patterns (confidence 0.7)]
const OBLIGATION_PATTERNS: Record<ObligationType, [string[], string[]]> = {
  GOSI: [
    ['general organization for social insurance', 'التأمينات الاجتماعية'],
    ['gosi', 'التأمينات'],
  ],
  ZATCA_VAT: [
    ['هيئة الزكاة', 'zakat authority', 'ضريبة القيمة المضافة'],
    ['zatca', 'الزكاة', 'zakat', 'vat payment'],
  ],
  ZAKAT: [
    ['هيئة الزكاة', 'zakat authority'],
    ['zatca', 'الزكاة', 'zakat'],
  ],
  BALADY: [
    ['municipality', 'أمانة', 'البلدية'],
    ['balady', 'بلدي'],
  ],
  QIWA: [
    ['وزارة العمل', 'ministry of human resources'],
    ['mol', 'qiwa', 'قوى', 'hrsd'],
  ],
  CHAMBER: [
    ['الغرفة التجارية', 'chamber of commerce'],
    ['chamber', 'غرفة'],
  ],
  MISA: [
    ['وزارة الاستثمار', 'ministry of investment'],
    ['misa', 'investment'],
  ],
  INSURANCE: [
    ['التعاونية', 'tawuniya cooperative', 'bupa arabia', 'medgulf'],
    ['insurance', 'تأمين', 'medgulf', 'bupa', 'tawuniya'],
  ],
  CR_CONFIRMATION: [[], []],
  CUSTOM: [[], []],
}

function matchesPatterns(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase()
  return patterns.some((p) => lower.includes(p.toLowerCase()))
}

export function detectGovernmentPayment(
  transaction: Pick<Transaction, 'description' | 'vendor_or_client'>
): DetectionResult {
  const haystack = [transaction.description ?? '', transaction.vendor_or_client ?? ''].join(' ')

  if (!haystack.trim()) {
    return { isGovernment: false, obligationType: null, confidence: 0 }
  }

  for (const [type, [exactPatterns, keywordPatterns]] of Object.entries(OBLIGATION_PATTERNS)) {
    const obligationType = type as ObligationType

    // Skip placeholder entries
    if (exactPatterns.length === 0 && keywordPatterns.length === 0) continue

    if (matchesPatterns(haystack, exactPatterns)) {
      return { isGovernment: true, obligationType, confidence: 1.0 }
    }

    if (matchesPatterns(haystack, keywordPatterns)) {
      return { isGovernment: true, obligationType, confidence: 0.7 }
    }
  }

  return { isGovernment: false, obligationType: null, confidence: 0 }
}

export async function linkTransactionToObligation(
  supabase: SupabaseClient,
  businessId: string,
  transaction: Transaction,
  obligationType: ObligationType
): Promise<boolean> {
  const { data: obligation, error: fetchError } = await supabase
    .from('obligations')
    .select('*')
    .eq('business_id', businessId)
    .eq('type', obligationType)
    .order('next_due_date', { ascending: true })
    .limit(1)
    .single()

  if (fetchError || !obligation) return false

  const transactionUpdate: Record<string, unknown> = {
    linked_obligation_id: obligation.id,
  }

  const { error: txError } = await supabase
    .from('transactions')
    .update(transactionUpdate as any)
    .eq('id', transaction.id)

  if (txError) return false

  // Mark obligation completed if this is an expense payment
  if (transaction.type === 'EXPENSE') {
    const obligationUpdate: Record<string, unknown> = {
      last_completed_at: new Date().toISOString(),
    }

    // Advance next_due_date for monthly obligations (e.g. GOSI)
    if (obligation.frequency === 'MONTHLY') {
      const currentDue = new Date(obligation.next_due_date)
      obligationUpdate.next_due_date = addMonths(currentDue, 1).toISOString().split('T')[0]
    }

    await supabase
      .from('obligations')
      .update(obligationUpdate as any)
      .eq('id', obligation.id)
  }

  return true
}

export async function autoDetectAndLink(
  supabase: SupabaseClient,
  businessId: string,
  transactions: Transaction[]
): Promise<LinkResult[]> {
  const results: LinkResult[] = []

  for (const transaction of transactions) {
    const detection = detectGovernmentPayment(transaction)

    if (!detection.isGovernment || detection.obligationType === null || detection.confidence < 0.7) {
      continue
    }

    const linked = await linkTransactionToObligation(
      supabase,
      businessId,
      transaction,
      detection.obligationType
    )

    results.push({
      transactionId: transaction.id,
      obligationType: detection.obligationType,
      linked,
    })
  }

  return results
}
