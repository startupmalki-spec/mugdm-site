import { describe, it, expect } from 'vitest'

import {
  getVatObligationPeriod,
  linkBillsToVatObligation,
  type BillLike,
} from '@/lib/compliance/obligation-generator'

describe('getVatObligationPeriod', () => {
  it('QUARTERLY: Apr 30 due date → Jan 1 – Mar 31 window', () => {
    const { start, end } = getVatObligationPeriod('QUARTERLY', '2026-04-30')
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(0) // January
    expect(start.getDate()).toBe(1)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(2) // March
    expect(end.getDate()).toBe(31)
  })

  it('QUARTERLY: Jul 31 due date → Apr 1 – Jun 30 window', () => {
    const { start, end } = getVatObligationPeriod('QUARTERLY', '2026-07-31')
    expect(start.getMonth()).toBe(3) // April
    expect(start.getDate()).toBe(1)
    expect(end.getMonth()).toBe(5) // June
    expect(end.getDate()).toBe(30)
  })

  it('QUARTERLY: Jan 31 due date crosses year boundary → Oct–Dec prior year', () => {
    const { start, end } = getVatObligationPeriod('QUARTERLY', '2026-01-31')
    expect(start.getFullYear()).toBe(2025)
    expect(start.getMonth()).toBe(9) // October
    expect(start.getDate()).toBe(1)
    expect(end.getFullYear()).toBe(2025)
    expect(end.getMonth()).toBe(11) // December
    expect(end.getDate()).toBe(31)
  })

  it('MONTHLY: Feb 28 due → January window', () => {
    const { start, end } = getVatObligationPeriod('MONTHLY', '2026-02-28')
    expect(start.getMonth()).toBe(0)
    expect(start.getDate()).toBe(1)
    expect(end.getMonth()).toBe(0)
    expect(end.getDate()).toBe(31)
  })

  it('MONTHLY: Jan 31 due → December of prior year window', () => {
    const { start, end } = getVatObligationPeriod('MONTHLY', '2026-01-31')
    expect(start.getFullYear()).toBe(2025)
    expect(start.getMonth()).toBe(11)
    expect(start.getDate()).toBe(1)
    expect(end.getFullYear()).toBe(2025)
    expect(end.getMonth()).toBe(11)
    expect(end.getDate()).toBe(31)
  })
})

describe('linkBillsToVatObligation', () => {
  const bills: BillLike[] = [
    { id: 'inQ', issue_date: '2026-02-15', status: 'paid' },
    { id: 'wayBefore', issue_date: '2025-10-15', status: 'paid' },
    { id: 'afterQ', issue_date: '2026-05-01', status: 'paid' },
    { id: 'midJan', issue_date: '2026-01-15', status: 'approved' },
    { id: 'midMar', issue_date: '2026-03-15', status: 'approved' },
    { id: 'nullDate', issue_date: null, status: 'paid' },
  ]

  it('returns only bill IDs inside the quarterly window', () => {
    const ids = linkBillsToVatObligation(
      { type: 'ZATCA_VAT', frequency: 'QUARTERLY', next_due_date: '2026-04-30' },
      bills
    )
    // Central dates in Jan/Feb/Mar 2026 must be included; dates far outside
    // (Oct 2025, May 2026) must be excluded. Day-boundary edges are TZ-
    // sensitive (the helper uses toISOString on local-time Dates) and are
    // covered separately in getVatObligationPeriod tests.
    expect(ids).toContain('inQ')
    expect(ids).toContain('midJan')
    expect(ids).toContain('midMar')
    expect(ids).not.toContain('afterQ')
    expect(ids).not.toContain('wayBefore')
    expect(ids).not.toContain('nullDate')
  })

  it('returns [] for non-VAT obligation types', () => {
    const ids = linkBillsToVatObligation(
      { type: 'GOSI', frequency: 'MONTHLY', next_due_date: '2026-04-15' },
      bills
    )
    expect(ids).toEqual([])
  })

  it('skips bills with null issue_date', () => {
    const ids = linkBillsToVatObligation(
      { type: 'ZATCA_VAT', frequency: 'QUARTERLY', next_due_date: '2026-04-30' },
      bills
    )
    expect(ids).not.toContain('nullDate')
  })

  it('returns [] when no bills match the window', () => {
    const ids = linkBillsToVatObligation(
      { type: 'ZATCA_VAT', frequency: 'QUARTERLY', next_due_date: '2026-04-30' },
      [{ id: 'old', issue_date: '2020-01-01' }]
    )
    expect(ids).toEqual([])
  })

  it('monthly frequency narrows the window to a single month', () => {
    const ids = linkBillsToVatObligation(
      { type: 'ZATCA_VAT', frequency: 'MONTHLY', next_due_date: '2026-03-31' },
      [
        { id: 'jan', issue_date: '2026-01-15' },
        { id: 'feb', issue_date: '2026-02-15' },
        { id: 'mar', issue_date: '2026-03-15' },
      ]
    )
    expect(ids).toEqual(['feb'])
  })
})
