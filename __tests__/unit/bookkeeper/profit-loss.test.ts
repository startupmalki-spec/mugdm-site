import { describe, it, expect } from 'vitest'
import { generateProfitLoss, getCategoryLabel } from '@/lib/bookkeeper/profit-loss'
import type { Transaction } from '@/lib/supabase/types'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    business_id: 'biz-1',
    date: '2026-03-15',
    amount: 1000,
    type: 'EXPENSE',
    category: 'RENT',
    description: 'Rent',
    vendor_or_client: null,
    source: 'MANUAL',
    vat_amount: null,
    bank_statement_upload_id: null,
    linked_obligation_id: null,
    receipt_url: null,
    notes: null,
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
    ...overrides,
  } as Transaction
}

describe('generateProfitLoss', () => {
  const start = '2026-03-01'
  const end = '2026-03-31'

  it('returns zeros for empty transactions', () => {
    const pl = generateProfitLoss([], start, end)
    expect(pl.totalRevenue).toBe(0)
    expect(pl.totalExpenses).toBe(0)
    expect(pl.netProfit).toBe(0)
    expect(pl.profitMargin).toBe(0)
  })

  it('calculates net profit = revenue - expenses', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 10000, category: 'REVENUE', date: '2026-03-10' }),
      makeTx({ type: 'EXPENSE', amount: 3000, category: 'RENT', date: '2026-03-15' }),
      makeTx({ type: 'EXPENSE', amount: 2000, category: 'SALARY', date: '2026-03-20' }),
    ]
    const pl = generateProfitLoss(txs, start, end)
    expect(pl.totalRevenue).toBe(10000)
    expect(pl.totalExpenses).toBe(5000)
    expect(pl.netProfit).toBe(5000)
  })

  it('calculates profit margin as a percentage', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 10000, category: 'REVENUE', date: '2026-03-10' }),
      makeTx({ type: 'EXPENSE', amount: 4000, category: 'RENT', date: '2026-03-15' }),
    ]
    const pl = generateProfitLoss(txs, start, end)
    expect(pl.profitMargin).toBe(60) // (6000/10000)*100
  })

  it('groups revenue and expenses by category', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 5000, category: 'REVENUE', date: '2026-03-05' }),
      makeTx({ type: 'INCOME', amount: 2000, category: 'OTHER_INCOME', date: '2026-03-10' }),
      makeTx({ type: 'EXPENSE', amount: 3000, category: 'RENT', date: '2026-03-15' }),
      makeTx({ type: 'EXPENSE', amount: 1000, category: 'RENT', date: '2026-03-20' }),
    ]
    const pl = generateProfitLoss(txs, start, end)
    expect(pl.revenue).toHaveLength(2)
    expect(pl.expenses).toHaveLength(1) // Both RENT merged
    expect(pl.expenses[0].amount).toBe(4000)
  })

  it('handles negative profit (loss)', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 2000, category: 'REVENUE', date: '2026-03-10' }),
      makeTx({ type: 'EXPENSE', amount: 5000, category: 'SALARY', date: '2026-03-15' }),
    ]
    const pl = generateProfitLoss(txs, start, end)
    expect(pl.netProfit).toBe(-3000)
    expect(pl.profitMargin).toBe(-150) // (-3000/2000)*100
  })
})

describe('getCategoryLabel', () => {
  it('returns English label for SALARY expense', () => {
    expect(getCategoryLabel('SALARY', 'EXPENSE', 'en')).toBe('Salaries & Wages')
  })

  it('returns Arabic label for SALARY expense', () => {
    expect(getCategoryLabel('SALARY', 'EXPENSE', 'ar')).toBe('رواتب وأجور')
  })

  it('returns English label for REVENUE income', () => {
    expect(getCategoryLabel('REVENUE', 'INCOME', 'en')).toBe('Sales Revenue')
  })

  it('falls back to category code for unknown categories', () => {
    // @ts-expect-error — testing unknown category
    expect(getCategoryLabel('UNKNOWN_CAT', 'EXPENSE', 'en')).toBe('UNKNOWN_CAT')
  })
})
