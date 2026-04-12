import type { SupabaseClient } from '@supabase/supabase-js'
import type { Transaction } from '@/lib/supabase/types'

interface DuplicateCheckResult {
  duplicates: Transaction[]
  unique: Transaction[]
}

export interface FuzzyDuplicatePair {
  transactionA: Transaction
  transactionB: Transaction
  reason: string
  reasonAr: string
}

export type DuplicateResolution = 'keep_both' | 'merge' | 'delete_a' | 'delete_b'

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

  type TransactionSubset = Pick<Transaction, 'date' | 'amount' | 'description' | 'business_id'>
  const { data: existing } = await (supabase
    .from('transactions') as unknown as {
      select(columns: string): {
        eq(col: string, val: string): {
          gte(col: string, val: string): {
            lte(col: string, val: string): PromiseLike<{ data: TransactionSubset[] | null }>
          }
        }
      }
    })
    .select('date, amount, description, business_id')
    .eq('business_id', businessId)
    .gte('date', minDate)
    .lte('date', maxDate)

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

/**
 * Fuzzy duplicate detection: finds pairs of transactions that are within
 * 2 days of each other, within 10% amount, and have similar descriptions.
 */
export function detectFuzzyDuplicates(transactions: Transaction[]): FuzzyDuplicatePair[] {
  const pairs: FuzzyDuplicatePair[] = []
  const seen = new Set<string>()

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i]
      const b = transactions[j]

      // Skip if same transaction
      if (a.id === b.id) continue

      // Must be same type (both income or both expense)
      if (a.type !== b.type) continue

      // Check date proximity (within 2 days)
      const dayDiff = Math.abs(dateDiffDays(a.date, b.date))
      if (dayDiff > 2) continue

      // Check amount similarity (within 10%)
      const maxAmount = Math.max(a.amount, b.amount)
      const amountDiff = Math.abs(a.amount - b.amount)
      if (maxAmount > 0 && amountDiff / maxAmount > 0.1) continue

      // Check description similarity
      const descA = normalizeDescription(a.description)
      const descB = normalizeDescription(b.description)
      if (descA && descB && !isSimilarDescription(descA, descB)) continue

      // Deduplicate pairs
      const pairKey = [a.id, b.id].sort().join('|')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)

      const reason = dayDiff === 0
        ? `Same date, ${amountDiff === 0 ? 'same amount' : 'similar amount'}, similar description`
        : `${dayDiff} day${dayDiff > 1 ? 's' : ''} apart, ${amountDiff === 0 ? 'same amount' : 'similar amount'}, similar description`

      const reasonAr = dayDiff === 0
        ? `نفس التاريخ، ${amountDiff === 0 ? 'نفس المبلغ' : 'مبلغ مشابه'}، وصف مشابه`
        : `فرق ${dayDiff} ${dayDiff > 1 ? 'أيام' : 'يوم'}، ${amountDiff === 0 ? 'نفس المبلغ' : 'مبلغ مشابه'}، وصف مشابه`

      pairs.push({ transactionA: a, transactionB: b, reason, reasonAr })
    }
  }

  return pairs
}

function dateDiffDays(dateA: string, dateB: string): number {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

function normalizeDescription(desc: string | null): string {
  return (desc ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function isSimilarDescription(a: string, b: string): boolean {
  if (!a || !b) return true // If either is empty, consider as possibly similar
  if (a === b) return true

  // Check if one contains the other
  if (a.includes(b) || b.includes(a)) return true

  // Simple token overlap: if >50% of words overlap, consider similar
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2))

  if (wordsA.size === 0 || wordsB.size === 0) return true

  let overlap = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++
  }

  const minSize = Math.min(wordsA.size, wordsB.size)
  return minSize > 0 && overlap / minSize >= 0.5
}

function buildMatchKey(date: string, amount: number, description: string | null): string {
  return `${date}|${amount}|${(description ?? '').trim().toLowerCase()}`
}
