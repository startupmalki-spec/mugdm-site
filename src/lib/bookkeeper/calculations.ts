import type { Transaction, TransactionCategory } from '@/lib/supabase/types'
import { format, parseISO, startOfMonth, subMonths, isWithinInterval } from 'date-fns'

export interface DateRange {
  start: Date
  end: Date
}

export interface FinancialSummary {
  income: number
  expenses: number
  net: number
}

export interface CategoryBreakdownItem {
  category: TransactionCategory
  amount: number
  color: string
}

export interface MonthlyTrendItem {
  month: string
  income: number
  expenses: number
}

export interface CashFlowPoint {
  date: string
  balance: number
}

export interface VATEstimate {
  outputVAT: number
  inputVAT: number
  netVAT: number
}

const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  REVENUE: '#22c55e',
  OTHER_INCOME: '#10b981',
  GOVERNMENT: '#f59e0b',
  SALARY: '#ef4444',
  RENT: '#f97316',
  UTILITIES: '#06b6d4',
  SUPPLIES: '#8b5cf6',
  TRANSPORT: '#ec4899',
  MARKETING: '#3b82f6',
  PROFESSIONAL: '#6366f1',
  INSURANCE: '#14b8a6',
  BANK_FEES: '#a855f7',
  OTHER_EXPENSE: '#64748b',
}

const VAT_RATE = 0.15

// Government fees and salaries are VAT-exempt
const VAT_EXEMPT_CATEGORIES: TransactionCategory[] = [
  'GOVERNMENT',
  'SALARY',
  'INSURANCE',
]

export function getCategoryColor(category: TransactionCategory): string {
  return CATEGORY_COLORS[category]
}

export function getAllCategoryColors(): Record<TransactionCategory, string> {
  return { ...CATEGORY_COLORS }
}

function filterByPeriod(transactions: Transaction[], period: DateRange): Transaction[] {
  return transactions.filter((tx) => {
    const txDate = parseISO(tx.date)
    return isWithinInterval(txDate, { start: period.start, end: period.end })
  })
}

export function calculateSummary(transactions: Transaction[], period: DateRange): FinancialSummary {
  const filtered = filterByPeriod(transactions, period)

  const income = filtered
    .filter((tx) => tx.type === 'INCOME')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const expenses = filtered
    .filter((tx) => tx.type === 'EXPENSE')
    .reduce((sum, tx) => sum + tx.amount, 0)

  return {
    income,
    expenses,
    net: income - expenses,
  }
}

export function calculateCategoryBreakdown(transactions: Transaction[]): CategoryBreakdownItem[] {
  const expensesByCategory = new Map<TransactionCategory, number>()

  for (const tx of transactions) {
    if (tx.type !== 'EXPENSE' || !tx.category) continue
    const current = expensesByCategory.get(tx.category) ?? 0
    expensesByCategory.set(tx.category, current + tx.amount)
  }

  return Array.from(expensesByCategory.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      color: CATEGORY_COLORS[category],
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function calculateMonthlyTrend(transactions: Transaction[], months: number): MonthlyTrendItem[] {
  const now = new Date()
  const result: MonthlyTrendItem[] = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = i === 0
      ? now
      : new Date(startOfMonth(subMonths(now, i - 1)).getTime() - 1)

    const monthTransactions = filterByPeriod(transactions, { start: monthStart, end: monthEnd })

    const income = monthTransactions
      .filter((tx) => tx.type === 'INCOME')
      .reduce((sum, tx) => sum + tx.amount, 0)

    const expenses = monthTransactions
      .filter((tx) => tx.type === 'EXPENSE')
      .reduce((sum, tx) => sum + tx.amount, 0)

    result.push({
      month: format(monthStart, 'MMM yyyy'),
      income,
      expenses,
    })
  }

  return result
}

export function calculateCashFlow(transactions: Transaction[]): CashFlowPoint[] {
  const sorted = [...transactions].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  )

  let balance = 0
  const points: CashFlowPoint[] = []

  for (const tx of sorted) {
    balance += tx.type === 'INCOME' ? tx.amount : -tx.amount
    points.push({
      date: tx.date,
      balance,
    })
  }

  return points
}

export function calculateVATEstimate(transactions: Transaction[]): VATEstimate {
  let outputVAT = 0
  let inputVAT = 0

  for (const tx of transactions) {
    if (!tx.category) continue

    const isExempt = VAT_EXEMPT_CATEGORIES.includes(tx.category)
    if (isExempt) continue

    if (tx.type === 'INCOME') {
      outputVAT += tx.vat_amount ?? (tx.amount * VAT_RATE) / (1 + VAT_RATE)
    } else {
      inputVAT += tx.vat_amount ?? (tx.amount * VAT_RATE) / (1 + VAT_RATE)
    }
  }

  return {
    outputVAT: Math.round(outputVAT * 100) / 100,
    inputVAT: Math.round(inputVAT * 100) / 100,
    netVAT: Math.round((outputVAT - inputVAT) * 100) / 100,
  }
}

export function formatSAR(amount: number, locale: string = 'en'): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))

  if (amount < 0) {
    return locale === 'ar' ? `(${formatted})` : `(${formatted})`
  }

  return formatted
}
