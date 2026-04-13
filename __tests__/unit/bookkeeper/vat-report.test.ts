import { describe, it, expect } from 'vitest'
import { generateVATReport } from '@/lib/bookkeeper/vat-report'
import type { Transaction } from '@/lib/supabase/types'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    business_id: 'biz-1',
    date: '2026-03-15',
    amount: 1000,
    type: 'EXPENSE',
    category: 'SUPPLIES',
    description: 'Office supplies',
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

describe('generateVATReport', () => {
  const periodStart = '2026-01-01'
  const periodEnd = '2026-03-31'

  it('returns zeros for empty transactions', () => {
    const report = generateVATReport([], periodStart, periodEnd)
    expect(report.totalSales).toBe(0)
    expect(report.totalPurchases).toBe(0)
    expect(report.outputVAT).toBe(0)
    expect(report.inputVAT).toBe(0)
    expect(report.netVAT).toBe(0)
    expect(report.transactions).toEqual([])
  })

  it('calculates output VAT from income and input VAT from expenses', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 11500, category: 'REVENUE', date: '2026-02-10' }),
      makeTx({ type: 'EXPENSE', amount: 5750, category: 'SUPPLIES', date: '2026-02-15' }),
    ]
    const report = generateVATReport(txs, periodStart, periodEnd)

    expect(report.totalSales).toBe(11500)
    expect(report.totalPurchases).toBe(5750)
    // output: 11500 * 0.15 / 1.15 = 1500
    expect(report.outputVAT).toBe(1500)
    // input: 5750 * 0.15 / 1.15 = 750
    expect(report.inputVAT).toBe(750)
    expect(report.netVAT).toBe(750)
  })

  it('excludes VAT-exempt categories from VAT calculation but includes in totals', () => {
    const txs = [
      makeTx({ type: 'EXPENSE', amount: 8000, category: 'SALARY', date: '2026-02-01' }),
      makeTx({ type: 'EXPENSE', amount: 2000, category: 'GOVERNMENT', date: '2026-02-05' }),
    ]
    const report = generateVATReport(txs, periodStart, periodEnd)

    expect(report.totalPurchases).toBe(10000)
    expect(report.inputVAT).toBe(0)
    // Exempt transactions should NOT appear in report transactions
    expect(report.transactions).toHaveLength(0)
  })

  it('uses explicit vat_amount when provided', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 11500, category: 'REVENUE', vat_amount: 1600, date: '2026-01-15' }),
    ]
    const report = generateVATReport(txs, periodStart, periodEnd)
    expect(report.outputVAT).toBe(1600)
  })

  it('filters transactions to the specified period', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 5000, category: 'REVENUE', date: '2025-12-31' }), // out
      makeTx({ type: 'INCOME', amount: 3000, category: 'REVENUE', date: '2026-02-15' }), // in
      makeTx({ type: 'INCOME', amount: 4000, category: 'REVENUE', date: '2026-04-01' }), // out
    ]
    const report = generateVATReport(txs, periodStart, periodEnd)
    expect(report.totalSales).toBe(3000)
  })

  it('sorts report transactions by date ascending', () => {
    const txs = [
      makeTx({ type: 'INCOME', amount: 1000, category: 'REVENUE', date: '2026-03-15' }),
      makeTx({ type: 'INCOME', amount: 2000, category: 'REVENUE', date: '2026-01-10' }),
      makeTx({ type: 'EXPENSE', amount: 500, category: 'SUPPLIES', date: '2026-02-20' }),
    ]
    const report = generateVATReport(txs, periodStart, periodEnd)
    const dates = report.transactions.map((t) => t.date)
    expect(dates).toEqual([...dates].sort())
  })
})
