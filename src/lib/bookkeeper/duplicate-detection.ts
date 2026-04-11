import type { SupabaseClient } from '@supabase/supabase-js'
import type { Transaction } from '@/lib/supabase/types'

interface DuplicateCheckResult {
  duplicates: Transaction[]
  unique: Transaction[]
}

export async function checkDuplicateTransactions(
  supabase: SupabaseClient,
  businessId: string,
  candidates: Transaction[]
): Promise<DuplicateCheckResult> {
  if (candidates.length === 0) {
    return { duplicates: [], unique: [] }
  }

  const dates = candidates.map((tx) => tx.date)
  const minDate = dates.reduce((a, b) => (a < b ? a : b))
  const maxDate = dates.reduce((a, b) => (a > b ? a : b))

  const { data: existing } = await (supabase
    .from('transactions') as any)
    .select('date, amount, description, business_id')
    .eq('business_id', businessId)
    .gte('date', minDate)
    .lte('date', maxDate) as { data: Pick<Transaction, 'date' | 'amount' | 'description' | 'business_id'>[] | null }

  if (!existing || existing.length === 0) {
    return { duplicates: [], unique: candidates }
  }

  // Build a lookup key for O(1) matching
  const existingKeys = new Set(
    existing.map((tx) => buildMatchKey(tx.date, tx.amount, tx.description))
  )

  const duplicates: Transaction[] = []
  const unique: Transaction[] = []

  for (const candidate of candidates) {
    const key = buildMatchKey(candidate.date, candidate.amount, candidate.description)
    if (existingKeys.has(key)) {
      duplicates.push(candidate)
    } else {
      unique.push(candidate)
    }
  }

  return { duplicates, unique }
}

function buildMatchKey(date: string, amount: number, description: string | null): string {
  return `${date}|${amount}|${(description ?? '').trim().toLowerCase()}`
}
