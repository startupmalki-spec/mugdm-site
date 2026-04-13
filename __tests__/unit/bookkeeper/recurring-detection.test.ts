import { describe, it, expect } from 'vitest'
import {
  detectRecurringExpenses,
  calculateMonthlyRecurringCost,
} from '@/lib/bookkeeper/recurring-detection'
import type { Transaction } from '@/lib/supabase/types'
import { format, subMonths } from 'date-fns'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    business_id: 'biz-1',
    date: '2026-03-15',
    amount: 1000,
    type: 'EXPENSE',
    category: 'RENT',
    description: 'Office rent',
    vendor_or_client: 'Landlord Co',
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

describe('detectRecurringExpenses', () => {
  it('returns empty for fewer than 3 transactions per vendor', () => {
    const txs = [
      makeTx({ vendor_or_client: 'STC', date: '2026-01-15' }),
      makeTx({ vendor_or_client: 'STC', date: '2026-02-15' }),
    ]
    expect(detectRecurringExpenses(txs)).toEqual([])
  })

  it('detects monthly recurring expense with 3+ occurrences', () => {
    const now = new Date()
    const txs = Array.from({ length: 4 }, (_, i) =>
      makeTx({
        vendor_or_client: 'STC',
        category: 'UTILITIES',
        amount: 500,
        description: 'STC monthly',
        date: format(subMonths(now, i + 1), 'yyyy-MM-dd'),
      })
    )
    const patterns = detectRecurringExpenses(txs)
    expect(patterns.length).toBeGreaterThanOrEqual(1)
    expect(patterns[0].frequency).toBe('monthly')
    expect(patterns[0].vendor).toBe('STC')
  })

  it('does NOT flag transactions with >20% amount variance', () => {
    const now = new Date()
    const txs = [
      makeTx({ vendor_or_client: 'Random', category: 'SUPPLIES', amount: 100, date: format(subMonths(now, 3), 'yyyy-MM-dd') }),
      makeTx({ vendor_or_client: 'Random', category: 'SUPPLIES', amount: 500, date: format(subMonths(now, 2), 'yyyy-MM-dd') }),
      makeTx({ vendor_or_client: 'Random', category: 'SUPPLIES', amount: 100, date: format(subMonths(now, 1), 'yyyy-MM-dd') }),
    ]
    expect(detectRecurringExpenses(txs)).toEqual([])
  })

  it('ignores income transactions', () => {
    const now = new Date()
    const txs = Array.from({ length: 4 }, (_, i) =>
      makeTx({
        type: 'INCOME',
        vendor_or_client: 'Client A',
        category: 'REVENUE',
        amount: 5000,
        date: format(subMonths(now, i + 1), 'yyyy-MM-dd'),
      })
    )
    expect(detectRecurringExpenses(txs)).toEqual([])
  })
})

describe('calculateMonthlyRecurringCost', () => {
  it('returns 0 for no patterns', () => {
    expect(calculateMonthlyRecurringCost([])).toBe(0)
  })

  it('sums monthly patterns directly', () => {
    const patterns = [
      { description: '', vendor: 'A', category: 'RENT' as const, averageAmount: 3000, frequency: 'monthly' as const, lastDate: '', nextExpectedDate: '', occurrences: 4 },
      { description: '', vendor: 'B', category: 'UTILITIES' as const, averageAmount: 600, frequency: 'monthly' as const, lastDate: '', nextExpectedDate: '', occurrences: 3 },
    ]
    expect(calculateMonthlyRecurringCost(patterns)).toBe(3600)
  })

  it('divides quarterly by 3 and annual by 12', () => {
    const patterns = [
      { description: '', vendor: 'A', category: 'INSURANCE' as const, averageAmount: 12000, frequency: 'annual' as const, lastDate: '', nextExpectedDate: '', occurrences: 3 },
      { description: '', vendor: 'B', category: 'GOVERNMENT' as const, averageAmount: 3000, frequency: 'quarterly' as const, lastDate: '', nextExpectedDate: '', occurrences: 4 },
    ]
    // 12000/12 + 3000/3 = 1000 + 1000 = 2000
    expect(calculateMonthlyRecurringCost(patterns)).toBe(2000)
  })
})
