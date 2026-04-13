import { describe, it, expect } from 'vitest'
import {
  calculateSummary,
  calculateCategoryBreakdown,
  calculateMonthlyTrend,
  calculateCashFlow,
  calculateVATEstimate,
  formatSAR,
  getCategoryColor,
} from '@/lib/bookkeeper/calculations'
import type { Transaction } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    business_id: 'biz-1',
    date: '2026-03-15',
    amount: 1000,
    type: 'EXPENSE',
    category: 'RENT',
    description: 'Office rent',
    vendor_or_client: 'Landlord',
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

const period = { start: new Date('2026-03-01'), end: new Date('2026-03-31') }

// ---------------------------------------------------------------------------
// calculateSummary
// ---------------------------------------------------------------------------

describe('calculateSummary', () => {
  it('returns zero for empty transactions', () => {
    const result = calculateSummary([], period)
    expect(result).toEqual({ income: 0, expenses: 0, net: 0 })
  })

  it('sums income and expenses within the period', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 5000, date: '2026-03-10' }),
      makeTx({ type: 'EXPENSE', amount: 2000, date: '2026-03-15' }),
      makeTx({ type: 'EXPENSE', amount: 1000, date: '2026-03-20' }),
    ]
    const result = calculateSummary(txs, period)
    expect(result.income).toBe(5000)
    expect(result.expenses).toBe(3000)
    expect(result.net).toBe(2000)
  })

  it('excludes transactions outside the period', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 5000, date: '2026-02-28' }), // before
      makeTx({ type: 'INCOME', amount: 3000, date: '2026-03-15' }), // in
      makeTx({ type: 'INCOME', amount: 4000, date: '2026-04-01' }), // after
    ]
    const result = calculateSummary(txs, period)
    expect(result.income).toBe(3000)
  })
})

// ---------------------------------------------------------------------------
// calculateCategoryBreakdown
// ---------------------------------------------------------------------------

describe('calculateCategoryBreakdown', () => {
  it('returns empty array for no expenses', () => {
    const txs = [makeTx({ type: 'INCOME', amount: 5000, category: 'REVENUE' })]
    expect(calculateCategoryBreakdown(txs)).toEqual([])
  })

  it('groups expenses by category and sorts descending', () => {
    const txs = [
      makeTx({ category: 'RENT', amount: 3000 }),
      makeTx({ category: 'RENT', amount: 2000 }),
      makeTx({ category: 'UTILITIES', amount: 500 }),
    ]
    const breakdown = calculateCategoryBreakdown(txs)
    expect(breakdown[0].category).toBe('RENT')
    expect(breakdown[0].amount).toBe(5000)
    expect(breakdown[1].category).toBe('UTILITIES')
    expect(breakdown[1].amount).toBe(500)
  })

  it('includes the correct color per category', () => {
    const txs = [makeTx({ category: 'SALARY', amount: 8000 })]
    const breakdown = calculateCategoryBreakdown(txs)
    expect(breakdown[0].color).toBe(getCategoryColor('SALARY'))
  })
})

// ---------------------------------------------------------------------------
// calculateVATEstimate
// ---------------------------------------------------------------------------

describe('calculateVATEstimate', () => {
  it('returns zeros for empty transactions', () => {
    const result = calculateVATEstimate([])
    expect(result).toEqual({ outputVAT: 0, inputVAT: 0, netVAT: 0 })
  })

  it('calculates 15% VAT on income (output) and expenses (input)', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 1150, category: 'REVENUE' }),
      makeTx({ type: 'EXPENSE', amount: 575, category: 'SUPPLIES' }),
    ]
    const result = calculateVATEstimate(txs)
    // output: 1150 * 0.15 / 1.15 = 150
    expect(result.outputVAT).toBe(150)
    // input: 575 * 0.15 / 1.15 = 75
    expect(result.inputVAT).toBe(75)
    expect(result.netVAT).toBe(75)
  })

  it('uses explicit vat_amount when provided', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 1150, category: 'REVENUE', vat_amount: 200 }),
    ]
    const result = calculateVATEstimate(txs)
    expect(result.outputVAT).toBe(200)
  })

  it('excludes VAT-exempt categories (GOVERNMENT, SALARY, INSURANCE)', () => {
    const txs = [
      makeTx({ type: 'EXPENSE', amount: 5000, category: 'GOVERNMENT' }),
      makeTx({ type: 'EXPENSE', amount: 8000, category: 'SALARY' }),
      makeTx({ type: 'EXPENSE', amount: 3000, category: 'INSURANCE' }),
    ]
    const result = calculateVATEstimate(txs)
    expect(result.inputVAT).toBe(0)
    expect(result.outputVAT).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// calculateCashFlow
// ---------------------------------------------------------------------------

describe('calculateCashFlow', () => {
  it('returns empty for no transactions', () => {
    expect(calculateCashFlow([])).toEqual([])
  })

  it('builds a running balance sorted by date', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 1000, date: '2026-03-01' }),
      makeTx({ type: 'EXPENSE', amount: 300, date: '2026-03-05' }),
      makeTx({ type: 'INCOME', amount: 500, date: '2026-03-10' }),
    ]
    const points = calculateCashFlow(txs)
    expect(points).toHaveLength(3)
    expect(points[0].balance).toBe(1000)
    expect(points[1].balance).toBe(700)
    expect(points[2].balance).toBe(1200)
  })
})

// ---------------------------------------------------------------------------
// formatSAR
// ---------------------------------------------------------------------------

describe('formatSAR', () => {
  it('formats positive amounts without sign', () => {
    const result = formatSAR(1234)
    expect(result).toMatch(/1.*234/)
  })

  it('wraps negative amounts in parentheses', () => {
    const result = formatSAR(-500)
    expect(result).toMatch(/\(.*500.*\)/)
  })

  it('formats zero', () => {
    expect(formatSAR(0)).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// calculateMonthlyTrend
// ---------------------------------------------------------------------------

describe('calculateMonthlyTrend', () => {
  it('returns the correct number of months', () => {
    const trend = calculateMonthlyTrend([], 6)
    expect(trend).toHaveLength(6)
  })

  it('each entry has income and expenses fields', () => {
    const trend = calculateMonthlyTrend([], 3)
    for (const month of trend) {
      expect(month).toHaveProperty('month')
      expect(month).toHaveProperty('income')
      expect(month).toHaveProperty('expenses')
    }
  })
})
