import type { Transaction } from '@/lib/supabase/types'
import { format, subMonths, startOfMonth, endOfMonth, addMonths } from 'date-fns'

/** A single month's projection */
export interface MonthlyProjection {
  /** Month label, e.g. "2026-05" */
  month: string
  /** Human-readable label, e.g. "May 2026" */
  label: string
  projectedIncome: number
  projectedExpenses: number
  projectedNet: number
}

/** Complete cash flow forecast result */
export interface CashFlowForecast {
  projections: MonthlyProjection[]
  projectedBalance: number
  goesNegative: boolean
  /** The current running balance used as starting point */
  currentBalance: number
}

/**
 * Predict the next N months of cash flow based on recurring patterns
 * and historical averages.
 *
 * Strategy:
 *  1. Compute monthly income and expense averages over the last 6 months
 *     (or however many months of data are available).
 *  2. Weight recent months more heavily (simple linear weighting).
 *  3. Project forward N months.
 */
export function forecastCashFlow(
  transactions: Transaction[],
  months = 3
): CashFlowForecast {
  const now = new Date()

  // --- Gather historical monthly buckets (last 6 months) ---
  const lookbackMonths = 6
  const monthlyBuckets: { income: number; expenses: number }[] = []

  for (let i = lookbackMonths; i >= 1; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = endOfMonth(subMonths(now, i))

    let income = 0
    let expenses = 0

    for (const tx of transactions) {
      const d = new Date(tx.date)
      if (d >= monthStart && d <= monthEnd) {
        if (tx.type === 'INCOME') {
          income += tx.amount
        } else {
          expenses += tx.amount
        }
      }
    }

    monthlyBuckets.push({ income, expenses })
  }

  // Filter out months with zero activity at the start (before first data)
  const firstActiveIdx = monthlyBuckets.findIndex(
    (b) => b.income > 0 || b.expenses > 0
  )
  const activeBuckets =
    firstActiveIdx >= 0 ? monthlyBuckets.slice(firstActiveIdx) : []

  // --- Compute weighted averages ---
  let avgIncome = 0
  let avgExpenses = 0

  if (activeBuckets.length > 0) {
    let totalWeight = 0
    let weightedIncome = 0
    let weightedExpenses = 0

    for (let i = 0; i < activeBuckets.length; i++) {
      const weight = i + 1 // linear: more recent = higher weight
      weightedIncome += activeBuckets[i].income * weight
      weightedExpenses += activeBuckets[i].expenses * weight
      totalWeight += weight
    }

    avgIncome = weightedIncome / totalWeight
    avgExpenses = weightedExpenses / totalWeight
  }

  // --- Compute current running balance from ALL transactions ---
  let currentBalance = 0
  for (const tx of transactions) {
    if (tx.type === 'INCOME') {
      currentBalance += tx.amount
    } else {
      currentBalance -= tx.amount
    }
  }

  // --- Build projections ---
  const projections: MonthlyProjection[] = []
  let runningBalance = currentBalance
  let goesNegative = false

  for (let i = 1; i <= months; i++) {
    const targetMonth = addMonths(now, i)
    const monthKey = format(targetMonth, 'yyyy-MM')
    const label = format(targetMonth, 'MMM yyyy')

    const projectedIncome = Math.round(avgIncome * 100) / 100
    const projectedExpenses = Math.round(avgExpenses * 100) / 100
    const projectedNet =
      Math.round((projectedIncome - projectedExpenses) * 100) / 100

    runningBalance += projectedNet

    if (runningBalance < 0) {
      goesNegative = true
    }

    projections.push({
      month: monthKey,
      label,
      projectedIncome,
      projectedExpenses,
      projectedNet,
    })
  }

  return {
    projections,
    projectedBalance: Math.round(runningBalance * 100) / 100,
    goesNegative,
    currentBalance: Math.round(currentBalance * 100) / 100,
  }
}
