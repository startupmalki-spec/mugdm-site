import type { Transaction, TransactionCategory } from '@/lib/supabase/types'
import { addMonths, addDays, differenceInDays, parseISO, format } from 'date-fns'

export interface RecurringPattern {
  description: string
  vendor: string | null
  category: TransactionCategory
  averageAmount: number
  frequency: 'monthly' | 'quarterly' | 'annual'
  lastDate: string
  nextExpectedDate: string
  occurrences: number
}

/**
 * Groups expense transactions by vendor + category, then checks for recurring
 * patterns. A pattern is flagged when the same vendor appears 3+ times with
 * similar amounts (within 20% variance) at roughly regular intervals.
 */
export function detectRecurringExpenses(transactions: Transaction[]): RecurringPattern[] {
  // Only look at expenses with a vendor
  const expenses = transactions.filter(
    (tx) => tx.type === 'EXPENSE' && tx.vendor_or_client && tx.category
  )

  // Group by vendor + category
  const groups = new Map<string, Transaction[]>()
  for (const tx of expenses) {
    const key = `${tx.vendor_or_client!.toLowerCase().trim()}::${tx.category}`
    const arr = groups.get(key) ?? []
    arr.push(tx)
    groups.set(key, arr)
  }

  const patterns: RecurringPattern[] = []

  for (const [, group] of groups) {
    if (group.length < 3) continue

    // Sort by date ascending
    const sorted = [...group].sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
    )

    // Check amount variance: all amounts should be within 20% of the average
    const amounts = sorted.map((tx) => tx.amount)
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const withinVariance = amounts.every(
      (a) => Math.abs(a - avg) / avg <= 0.2
    )
    if (!withinVariance) continue

    // Calculate gaps between consecutive transactions in days
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(
        differenceInDays(parseISO(sorted[i].date), parseISO(sorted[i - 1].date))
      )
    }

    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length

    // Determine frequency from average gap
    let frequency: RecurringPattern['frequency']
    if (avgGap <= 45) {
      frequency = 'monthly'
    } else if (avgGap <= 120) {
      frequency = 'quarterly'
    } else if (avgGap <= 400) {
      frequency = 'annual'
    } else {
      // Gaps too irregular — skip
      continue
    }

    // Check regularity: each gap should be within 40% of the average gap
    const isRegular = gaps.every(
      (g) => Math.abs(g - avgGap) / avgGap <= 0.4
    )
    if (!isRegular) continue

    // Calculate next expected date
    const lastDate = parseISO(sorted[sorted.length - 1].date)
    let nextExpected: Date
    switch (frequency) {
      case 'monthly':
        nextExpected = addMonths(lastDate, 1)
        break
      case 'quarterly':
        nextExpected = addMonths(lastDate, 3)
        break
      case 'annual':
        nextExpected = addMonths(lastDate, 12)
        break
    }

    // Use the most common description from the group
    const descCounts = new Map<string, number>()
    for (const tx of sorted) {
      const desc = tx.description ?? ''
      descCounts.set(desc, (descCounts.get(desc) ?? 0) + 1)
    }
    let bestDesc = ''
    let bestCount = 0
    for (const [desc, count] of descCounts) {
      if (count > bestCount) {
        bestDesc = desc
        bestCount = count
      }
    }

    patterns.push({
      description: bestDesc,
      vendor: sorted[0].vendor_or_client,
      category: sorted[0].category!,
      averageAmount: Math.round(avg * 100) / 100,
      frequency,
      lastDate: sorted[sorted.length - 1].date,
      nextExpectedDate: format(nextExpected, 'yyyy-MM-dd'),
      occurrences: sorted.length,
    })
  }

  // Sort by average amount descending
  return patterns.sort((a, b) => b.averageAmount - a.averageAmount)
}

/**
 * Estimate total monthly recurring cost from detected patterns.
 */
export function calculateMonthlyRecurringCost(patterns: RecurringPattern[]): number {
  let total = 0
  for (const p of patterns) {
    switch (p.frequency) {
      case 'monthly':
        total += p.averageAmount
        break
      case 'quarterly':
        total += p.averageAmount / 3
        break
      case 'annual':
        total += p.averageAmount / 12
        break
    }
  }
  return Math.round(total * 100) / 100
}
