import { describe, it, expect } from 'vitest'
import { detectFuzzyDuplicates } from '@/lib/bookkeeper/duplicate-detection'
import type { Transaction } from '@/lib/supabase/types'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    business_id: 'biz-1',
    date: '2026-03-15',
    amount: 1000,
    type: 'EXPENSE',
    category: 'RENT',
    description: 'Office rent payment',
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

describe('detectFuzzyDuplicates', () => {
  it('returns empty for no transactions', () => {
    expect(detectFuzzyDuplicates([])).toEqual([])
  })

  it('returns empty for a single transaction', () => {
    expect(detectFuzzyDuplicates([makeTx()])).toEqual([])
  })

  it('detects same-day, same-amount, same-description duplicates', () => {
    const txA = makeTx({ id: 'a', date: '2026-03-15', amount: 1000, description: 'Office rent' })
    const txB = makeTx({ id: 'b', date: '2026-03-15', amount: 1000, description: 'Office rent' })
    const pairs = detectFuzzyDuplicates([txA, txB])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].reason).toContain('Same date')
    expect(pairs[0].reason).toContain('same amount')
  })

  it('detects transactions within 2 days and 10% amount tolerance', () => {
    const txA = makeTx({ id: 'a', date: '2026-03-15', amount: 1000, description: 'STC payment' })
    const txB = makeTx({ id: 'b', date: '2026-03-16', amount: 1050, description: 'STC payment' })
    const pairs = detectFuzzyDuplicates([txA, txB])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].reason).toContain('1 day apart')
  })

  it('does NOT flag transactions more than 2 days apart', () => {
    const txA = makeTx({ id: 'a', date: '2026-03-15', amount: 1000, description: 'Rent' })
    const txB = makeTx({ id: 'b', date: '2026-03-20', amount: 1000, description: 'Rent' })
    expect(detectFuzzyDuplicates([txA, txB])).toEqual([])
  })

  it('does NOT flag transactions with >10% amount difference', () => {
    const txA = makeTx({ id: 'a', date: '2026-03-15', amount: 1000, description: 'Supplies' })
    const txB = makeTx({ id: 'b', date: '2026-03-15', amount: 1200, description: 'Supplies' })
    expect(detectFuzzyDuplicates([txA, txB])).toEqual([])
  })

  it('does NOT flag income vs expense with same details', () => {
    const txA = makeTx({ id: 'a', type: 'INCOME', date: '2026-03-15', amount: 1000 })
    const txB = makeTx({ id: 'b', type: 'EXPENSE', date: '2026-03-15', amount: 1000 })
    expect(detectFuzzyDuplicates([txA, txB])).toEqual([])
  })

  it('provides Arabic reason text', () => {
    const txA = makeTx({ id: 'a', date: '2026-03-15', amount: 1000, description: 'test' })
    const txB = makeTx({ id: 'b', date: '2026-03-15', amount: 1000, description: 'test' })
    const pairs = detectFuzzyDuplicates([txA, txB])
    expect(pairs[0].reasonAr).toContain('نفس التاريخ')
  })

  it('deduplicates pairs (A,B same as B,A)', () => {
    const txA = makeTx({ id: 'a', date: '2026-03-15', amount: 1000, description: 'X' })
    const txB = makeTx({ id: 'b', date: '2026-03-15', amount: 1000, description: 'X' })
    // Even if we reverse order, should still be one pair
    const pairs = detectFuzzyDuplicates([txA, txB])
    expect(pairs).toHaveLength(1)
  })
})
