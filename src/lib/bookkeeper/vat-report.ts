import { parseISO, isWithinInterval } from 'date-fns'
import type { Transaction, TransactionCategory } from '@/lib/supabase/types'

const VAT_RATE = 0.15

// Government fees, salaries, and insurance are VAT-exempt per Saudi tax law
const VAT_EXEMPT_CATEGORIES: TransactionCategory[] = [
  'GOVERNMENT',
  'SALARY',
  'INSURANCE',
]

export interface VATReportTransaction {
  date: string
  description: string
  amount: number
  vat: number
  type: 'sale' | 'purchase'
}

export interface VATReportData {
  period: { start: string; end: string }
  totalSales: number
  totalPurchases: number
  outputVAT: number   // 15% of sales (VAT collected)
  inputVAT: number    // VAT paid on purchases
  netVAT: number      // output - input (amount owed if positive, refundable if negative)
  transactions: VATReportTransaction[]
}

/**
 * Generate a VAT report for a given period.
 *
 * Saudi Arabia VAT rate: 15%
 * - Output VAT: 15% on INCOME transactions (VAT-eligible categories)
 * - Input VAT: sum of `vat_amount` from EXPENSE transactions, or estimate 15% if absent
 * - Net VAT payable = output VAT - input VAT
 *
 * VAT-exempt categories (GOVERNMENT, SALARY, INSURANCE) are excluded.
 */
export function generateVATReport(
  transactions: Transaction[],
  periodStart: string,
  periodEnd: string
): VATReportData {
  const start = parseISO(periodStart)
  const end = parseISO(periodEnd)

  const filtered = transactions.filter((tx) => {
    const txDate = parseISO(tx.date)
    return isWithinInterval(txDate, { start, end })
  })

  let totalSales = 0
  let totalPurchases = 0
  let outputVAT = 0
  let inputVAT = 0
  const reportTransactions: VATReportTransaction[] = []

  for (const tx of filtered) {
    const isExempt = tx.category ? VAT_EXEMPT_CATEGORIES.includes(tx.category) : false

    if (tx.type === 'INCOME') {
      totalSales += tx.amount

      if (!isExempt) {
        // Output VAT: extract VAT from the inclusive amount, or use vat_amount if provided
        const vat = tx.vat_amount ?? (tx.amount * VAT_RATE) / (1 + VAT_RATE)
        outputVAT += vat

        reportTransactions.push({
          date: tx.date,
          description: tx.description ?? '',
          amount: tx.amount,
          vat: Math.round(vat * 100) / 100,
          type: 'sale',
        })
      }
    } else {
      totalPurchases += tx.amount

      if (!isExempt) {
        // Input VAT: use vat_amount if available, otherwise estimate
        const vat = tx.vat_amount ?? (tx.amount * VAT_RATE) / (1 + VAT_RATE)
        inputVAT += vat

        reportTransactions.push({
          date: tx.date,
          description: tx.description ?? '',
          amount: tx.amount,
          vat: Math.round(vat * 100) / 100,
          type: 'purchase',
        })
      }
    }
  }

  return {
    period: { start: periodStart, end: periodEnd },
    totalSales: Math.round(totalSales * 100) / 100,
    totalPurchases: Math.round(totalPurchases * 100) / 100,
    outputVAT: Math.round(outputVAT * 100) / 100,
    inputVAT: Math.round(inputVAT * 100) / 100,
    netVAT: Math.round((outputVAT - inputVAT) * 100) / 100,
    transactions: reportTransactions.sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
    ),
  }
}
