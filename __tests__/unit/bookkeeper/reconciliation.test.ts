import { describe, it, expect } from 'vitest'
import { reconcileTransactions } from '@/lib/bookkeeper/reconciliation'
import type { Transaction } from '@/lib/supabase/types'

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

describe('reconcileTransactions', () => {
  it('returns empty for empty inputs', () => {
    const result = reconcileTransactions([], [])
    expect(result.matched).toEqual([])
    expect(result.unmatchedBank).toEqual([])
    expect(result.unmatchedManual).toEqual([])
  })

  it('matches exact date and amount', () => {
    const bank = [makeTx({ id: 'bank-1', date: '2026-03-15', amount: 1000 })]
    const manual = [makeTx({ id: 'manual-1', date: '2026-03-15', amount: 1000 })]
    const result = reconcileTransactions(bank, manual)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].dateDiffDays).toBe(0)
    expect(result.matched[0].amountDiffPercent).toBe(0)
    expect(result.unmatchedBank).toHaveLength(0)
    expect(result.unmatchedManual).toHaveLength(0)
  })

  it('matches within 1 day and 5% amount tolerance', () => {
    const bank = [makeTx({ id: 'bank-1', date: '2026-03-15', amount: 1000 })]
    const manual = [makeTx({ id: 'manual-1', date: '2026-03-16', amount: 1040 })]
    const result = reconcileTransactions(bank, manual)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].dateDiffDays).toBeLessThanOrEqual(1)
    expect(result.matched[0].amountDiffPercent).toBeLessThanOrEqual(5)
  })

  it('does NOT match transactions >1 day apart', () => {
    const bank = [makeTx({ id: 'bank-1', date: '2026-03-15', amount: 1000 })]
    const manual = [makeTx({ id: 'manual-1', date: '2026-03-18', amount: 1000 })]
    const result = reconcileTransactions(bank, manual)

    expect(result.matched).toHaveLength(0)
    expect(result.unmatchedBank).toHaveLength(1)
    expect(result.unmatchedManual).toHaveLength(1)
  })

  it('does NOT match transactions with >5% amount difference', () => {
    const bank = [makeTx({ id: 'bank-1', date: '2026-03-15', amount: 1000 })]
    const manual = [makeTx({ id: 'manual-1', date: '2026-03-15', amount: 1100 })]
    const result = reconcileTransactions(bank, manual)

    expect(result.matched).toHaveLength(0)
  })

  it('does NOT match different transaction types', () => {
    const bank = [makeTx({ id: 'bank-1', type: 'INCOME', date: '2026-03-15', amount: 1000 })]
    const manual = [makeTx({ id: 'manual-1', type: 'EXPENSE', date: '2026-03-15', amount: 1000 })]
    const result = reconcileTransactions(bank, manual)

    expect(result.matched).toHaveLength(0)
  })

  it('uses greedy best-match (closest amount wins)', () => {
    const bank = [makeTx({ id: 'bank-1', date: '2026-03-15', amount: 1000 })]
    const manual = [
      makeTx({ id: 'manual-1', date: '2026-03-15', amount: 1040 }), // 4% diff
      makeTx({ id: 'manual-2', date: '2026-03-15', amount: 1010 }), // 1% diff — closer
    ]
    const result = reconcileTransactions(bank, manual)

    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].manualTransaction.id).toBe('manual-2')
  })

  it('each bank tx can only match one manual tx', () => {
    const bank = [makeTx({ id: 'bank-1', date: '2026-03-15', amount: 1000 })]
    const manual = [
      makeTx({ id: 'manual-1', date: '2026-03-15', amount: 1000 }),
      makeTx({ id: 'manual-2', date: '2026-03-15', amount: 1000 }),
    ]
    const result = reconcileTransactions(bank, manual)

    expect(result.matched).toHaveLength(1)
    expect(result.unmatchedManual).toHaveLength(1)
  })
})
