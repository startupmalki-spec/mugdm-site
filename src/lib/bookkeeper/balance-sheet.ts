import { parseISO, isWithinInterval } from 'date-fns'
import type { Transaction } from '@/lib/supabase/types'
import { generateProfitLoss } from '@/lib/bookkeeper/profit-loss'

export interface BalanceSheetData {
  period: { start: string; end: string }
  assets: {
    cash: number
    receivables: number
    total: number
  }
  liabilities: {
    vatPayable: number
    payables: number
    total: number
  }
  equity: {
    ownerEquity: number
    retainedEarnings: number
    total: number
  }
  balances: boolean
}

const VAT_RATE = 0.15

/**
 * Generate a Balance Sheet snapshot for a given period.
 *
 * Simplified for SMEs:
 * - Assets: Cash (net income - expenses) + Receivables (0 unless provided)
 * - Liabilities: VAT Payable (output - input VAT) + Payables (0 unless provided)
 * - Equity: Assets - Liabilities (accounting equation)
 * - Retained Earnings: cumulative net profit from P&L
 */
export function generateBalanceSheet(
  transactions: Transaction[],
  periodStart: string,
  periodEnd: string
): BalanceSheetData {
  const start = parseISO(periodStart)
  const end = parseISO(periodEnd)

  const filtered = transactions.filter((tx) => {
    const txDate = parseISO(tx.date)
    return isWithinInterval(txDate, { start, end })
  })

  // Cash = total income - total expenses
  let totalIncome = 0
  let totalExpenses = 0
  let outputVAT = 0
  let inputVAT = 0

  for (const tx of filtered) {
    if (tx.type === 'INCOME') {
      totalIncome += tx.amount
      outputVAT += tx.amount * VAT_RATE / (1 + VAT_RATE)
    } else {
      totalExpenses += tx.amount
      inputVAT += tx.amount * VAT_RATE / (1 + VAT_RATE)
    }
  }

  const cash = Math.round((totalIncome - totalExpenses) * 100) / 100
  const receivables = 0 // Future: query unpaid invoices

  const vatPayable = Math.round((outputVAT - inputVAT) * 100) / 100
  const payables = 0 // Future: query outstanding obligations

  const totalAssets = Math.round((cash + receivables) * 100) / 100
  const totalLiabilities = Math.round((vatPayable + payables) * 100) / 100

  // Retained earnings from P&L
  const pnl = generateProfitLoss(transactions, periodStart, periodEnd)
  const retainedEarnings = pnl.netProfit
  const ownerEquity = Math.round((totalAssets - totalLiabilities - retainedEarnings) * 100) / 100
  const totalEquity = Math.round((ownerEquity + retainedEarnings) * 100) / 100

  return {
    period: { start: periodStart, end: periodEnd },
    assets: {
      cash,
      receivables,
      total: totalAssets,
    },
    liabilities: {
      vatPayable: Math.max(0, vatPayable),
      payables,
      total: Math.max(0, totalLiabilities),
    },
    equity: {
      ownerEquity,
      retainedEarnings,
      total: totalEquity,
    },
    balances: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01,
  }
}
