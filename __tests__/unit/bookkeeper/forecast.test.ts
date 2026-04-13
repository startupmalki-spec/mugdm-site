import { describe, it, expect } from 'vitest'
import { forecastCashFlow } from '@/lib/bookkeeper/forecast'
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
    description: '',
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

describe('forecastCashFlow', () => {
  it('returns the requested number of projection months', () => {
    const forecast = forecastCashFlow([], 3)
    expect(forecast.projections).toHaveLength(3)
  })

  it('returns zero projections for no historical data', () => {
    const forecast = forecastCashFlow([], 3)
    for (const p of forecast.projections) {
      expect(p.projectedIncome).toBe(0)
      expect(p.projectedExpenses).toBe(0)
    }
  })

  it('computes currentBalance from all transactions', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 5000 }),
      makeTx({ type: 'EXPENSE', amount: 2000 }),
    ]
    const forecast = forecastCashFlow(txs, 1)
    expect(forecast.currentBalance).toBe(3000)
  })

  it('flags goesNegative when projected balance drops below zero', () => {
    const now = new Date()
    // Create history where expenses greatly exceed income
    const txs: Transaction[] = []
    for (let i = 1; i <= 6; i++) {
      const date = format(subMonths(now, i), 'yyyy-MM-15')
      txs.push(makeTx({ type: 'INCOME', amount: 1000, date }))
      txs.push(makeTx({ type: 'EXPENSE', amount: 3000, date }))
    }
    const forecast = forecastCashFlow(txs, 6)
    // currentBalance = 6*1000 - 6*3000 = -12000, already negative
    expect(forecast.goesNegative).toBe(true)
  })

  it('each projection has a human-readable label', () => {
    const forecast = forecastCashFlow([], 2)
    for (const p of forecast.projections) {
      expect(p.label).toMatch(/\w+ \d{4}/) // e.g. "May 2026"
    }
  })
})
