import { parseISO, isWithinInterval } from 'date-fns'
import type { Transaction, TransactionCategory } from '@/lib/supabase/types'

export interface CategoryAmount {
  category: string
  amount: number
}

export interface ProfitLossData {
  period: { start: string; end: string }
  revenue: CategoryAmount[]
  expenses: CategoryAmount[]
  totalRevenue: number
  totalExpenses: number
  grossProfit: number
  netProfit: number
  profitMargin: number // percentage (0-100)
}

// Map internal category codes to human-readable labels
const REVENUE_CATEGORY_LABELS: Partial<Record<TransactionCategory, { en: string; ar: string }>> = {
  REVENUE: { en: 'Sales Revenue', ar: 'إيرادات المبيعات' },
  OTHER_INCOME: { en: 'Other Income', ar: 'إيرادات أخرى' },
}

const EXPENSE_CATEGORY_LABELS: Partial<Record<TransactionCategory, { en: string; ar: string }>> = {
  GOVERNMENT: { en: 'Government Fees', ar: 'رسوم حكومية' },
  SALARY: { en: 'Salaries & Wages', ar: 'رواتب وأجور' },
  RENT: { en: 'Rent', ar: 'إيجار' },
  UTILITIES: { en: 'Utilities', ar: 'مرافق' },
  SUPPLIES: { en: 'Supplies', ar: 'مستلزمات' },
  TRANSPORT: { en: 'Transport', ar: 'نقل' },
  MARKETING: { en: 'Marketing', ar: 'تسويق' },
  PROFESSIONAL: { en: 'Professional Services', ar: 'خدمات مهنية' },
  INSURANCE: { en: 'Insurance', ar: 'تأمين' },
  BANK_FEES: { en: 'Bank Fees', ar: 'رسوم بنكية' },
  OTHER_EXPENSE: { en: 'Other Expenses', ar: 'مصروفات أخرى' },
}

/**
 * Generate a Profit & Loss (Income Statement) for a given period.
 *
 * - Revenue: all INCOME transactions grouped by category
 * - Expenses: all EXPENSE transactions grouped by category
 * - Gross Profit = Total Revenue - Cost of Goods (for simplicity, we treat SUPPLIES as COGS)
 * - Net Profit = Total Revenue - Total Expenses
 * - Profit Margin = (Net Profit / Total Revenue) * 100
 */
export function generateProfitLoss(
  transactions: Transaction[],
  periodStart: string,
  periodEnd: string
): ProfitLossData {
  const start = parseISO(periodStart)
  const end = parseISO(periodEnd)

  const filtered = transactions.filter((tx) => {
    const txDate = parseISO(tx.date)
    return isWithinInterval(txDate, { start, end })
  })

  // Group revenue by category
  const revenueMap = new Map<string, number>()
  const expenseMap = new Map<string, number>()

  for (const tx of filtered) {
    if (tx.type === 'INCOME') {
      const cat = tx.category ?? 'REVENUE'
      const label = REVENUE_CATEGORY_LABELS[cat]?.en ?? cat
      revenueMap.set(label, (revenueMap.get(label) ?? 0) + tx.amount)
    } else {
      const cat = tx.category ?? 'OTHER_EXPENSE'
      const label = EXPENSE_CATEGORY_LABELS[cat]?.en ?? cat
      expenseMap.set(label, (expenseMap.get(label) ?? 0) + tx.amount)
    }
  }

  const revenue: CategoryAmount[] = Array.from(revenueMap.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  const expenses: CategoryAmount[] = Array.from(expenseMap.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Gross profit: revenue minus cost-of-goods-related expenses (SUPPLIES)
  const cogsAmount = expenseMap.get(EXPENSE_CATEGORY_LABELS.SUPPLIES?.en ?? 'Supplies') ?? 0
  const grossProfit = Math.round((totalRevenue - cogsAmount) * 100) / 100

  const netProfit = Math.round((totalRevenue - totalExpenses) * 100) / 100
  const profitMargin = totalRevenue > 0
    ? Math.round((netProfit / totalRevenue) * 10000) / 100
    : 0

  return {
    period: { start: periodStart, end: periodEnd },
    revenue,
    expenses,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    grossProfit,
    netProfit,
    profitMargin,
  }
}

/**
 * Get localized category label for P&L display.
 */
export function getCategoryLabel(
  category: TransactionCategory,
  type: 'INCOME' | 'EXPENSE',
  locale: string
): string {
  const lang = locale === 'ar' ? 'ar' : 'en'
  if (type === 'INCOME') {
    return REVENUE_CATEGORY_LABELS[category]?.[lang] ?? category
  }
  return EXPENSE_CATEGORY_LABELS[category]?.[lang] ?? category
}
