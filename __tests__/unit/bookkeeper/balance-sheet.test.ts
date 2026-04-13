import { describe, it, expect } from 'vitest'
import { generateBalanceSheet } from '@/lib/bookkeeper/balance-sheet'
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
    source_file_id: null,
    vat_amount: null,
    bank_statement_upload_id: null,
    linked_obligation_id: null,
    receipt_url: null,
    notes: null,
    ai_confidence: null,
    is_reviewed: true,
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
    ...overrides,
  } as Transaction
}

describe('generateBalanceSheet', () => {
  const start = '2026-03-01'
  const end = '2026-03-31'

  it('should return zeros for empty transactions', () => {
    const bs = generateBalanceSheet([], start, end)
    expect(bs.assets.cash).toBe(0)
    expect(bs.assets.receivables).toBe(0)
    expect(bs.assets.total).toBe(0)
    expect(bs.liabilities.vatPayable).toBe(0)
    expect(bs.liabilities.total).toBe(0)
    expect(bs.equity.total).toBe(0)
    expect(bs.balances).toBe(true)
  })

  it('should calculate cash as income minus expenses', () => {
    const txs = [
      makeTx({ id: 'tx-1', type: 'INCOME', amount: 10000, category: 'REVENUE', date: '2026-03-10' }),
      makeTx({ id: 'tx-2', type: 'EXPENSE', amount: 3000, category: 'RENT', date: '2026-03-15' }),
    ]
    const bs = generateBalanceSheet(txs, start, end)
    expect(bs.assets.cash).toBe(7000)
  })

  it('should calculate positive VAT payable when income exceeds expenses', () => {
    const txs = [
      makeTx({ id: 'tx-1', type: 'INCOME', amount: 11500, category: 'REVENUE', date: '2026-03-10' }),
      makeTx({ id: 'tx-2', type: 'EXPENSE', amount: 5750, category: 'SUPPLIES', date: '2026-03-15' }),
    ]
    const bs = generateBalanceSheet(txs, start, end)
    expect(bs.liabilities.vatPayable).toBeGreaterThan(0)
  })

  it('should filter transactions to the specified period', () => {
    const txs = [
      makeTx({ id: 'tx-1', type: 'INCOME', amount: 5000, date: '2026-03-15' }),
      makeTx({ id: 'tx-2', type: 'INCOME', amount: 8000, date: '2026-04-15' }),
    ]
    const bs = generateBalanceSheet(txs, start, end)
    expect(bs.assets.cash).toBe(5000)
  })

  it('should balance: assets = liabilities + equity', () => {
    const txs = [
      makeTx({ id: 'tx-1', type: 'INCOME', amount: 20000, category: 'REVENUE', date: '2026-03-05' }),
      makeTx({ id: 'tx-2', type: 'EXPENSE', amount: 8000, category: 'SALARY', date: '2026-03-10' }),
      makeTx({ id: 'tx-3', type: 'EXPENSE', amount: 2000, category: 'RENT', date: '2026-03-15' }),
    ]
    const bs = generateBalanceSheet(txs, start, end)
    expect(bs.balances).toBe(true)
    expect(Math.abs(bs.assets.total - bs.liabilities.total - bs.equity.total)).toBeLessThan(0.01)
  })

  it('should set receivables to 0 (future feature)', () => {
    const txs = [
      makeTx({ id: 'tx-1', type: 'INCOME', amount: 5000, date: '2026-03-10' }),
    ]
    const bs = generateBalanceSheet(txs, start, end)
    expect(bs.assets.receivables).toBe(0)
  })

  it('should include period in the result', () => {
    const bs = generateBalanceSheet([], start, end)
    expect(bs.period.start).toBe(start)
    expect(bs.period.end).toBe(end)
  })

  it('should handle negative cash flow (more expenses than income)', () => {
    const txs = [
      makeTx({ id: 'tx-1', type: 'INCOME', amount: 2000, category: 'REVENUE', date: '2026-03-05' }),
      makeTx({ id: 'tx-2', type: 'EXPENSE', amount: 8000, category: 'SALARY', date: '2026-03-10' }),
    ]
    const bs = generateBalanceSheet(txs, start, end)
    expect(bs.assets.cash).toBe(-6000)
    expect(bs.balances).toBe(true)
  })
})
