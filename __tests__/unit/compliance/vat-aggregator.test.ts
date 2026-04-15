import { describe, it, expect, vi } from 'vitest'

import { aggregateVatForPeriod } from '@/lib/compliance/vat-aggregator'

/**
 * Build a minimal Supabase client chain mock that captures filter args and
 * returns the given rows. Only the chain used by `aggregateVatForPeriod` is
 * implemented: .from().select().eq().in().gte().lte() → thenable result.
 */
function mockSupabase(
  rows: Array<{
    id: string
    vat_amount: number | null
    issue_date: string | null
    status: string | null
  }>,
  error: { message: string } | null = null
) {
  const calls: Record<string, unknown> = {}
  const result = { data: error ? null : rows, error }

  const chain: Record<string, unknown> = {}
  const passthrough = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls[name] = args
      return chain
    })

  chain.select = passthrough('select')
  chain.eq = passthrough('eq')
  chain.in = passthrough('in')
  chain.gte = passthrough('gte')
  chain.lte = vi.fn((...args: unknown[]) => {
    calls.lte = args
    return Promise.resolve(result)
  })

  const client = {
    from: vi.fn((tbl: string) => {
      calls.from = [tbl]
      return chain
    }),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls }
}

describe('aggregateVatForPeriod', () => {
  it('sums vat_amount across rows and collects billIds', async () => {
    const { client } = mockSupabase([
      { id: 'b1', vat_amount: 15, issue_date: '2026-01-10', status: 'paid' },
      { id: 'b2', vat_amount: 30, issue_date: '2026-02-01', status: 'approved' },
      { id: 'b3', vat_amount: 5.5, issue_date: '2026-02-20', status: 'paid' },
    ])

    const out = await aggregateVatForPeriod(
      'biz-1',
      '2026-01-01',
      '2026-03-31',
      client
    )

    expect(out.inputVat).toBeCloseTo(50.5)
    expect(out.billCount).toBe(3)
    expect(out.billIds).toEqual(['b1', 'b2', 'b3'])
    expect(out.outputVat).toBe(0)
    expect(out.netVat).toBeCloseTo(-50.5)
  })

  it('returns zeros on empty result set', async () => {
    const { client } = mockSupabase([])
    const out = await aggregateVatForPeriod(
      'biz-1',
      '2026-01-01',
      '2026-03-31',
      client
    )
    expect(out.inputVat).toBe(0)
    expect(out.billCount).toBe(0)
    expect(out.billIds).toEqual([])
    expect(out.netVat).toBe(0)
  })

  it('treats null vat_amount as 0', async () => {
    const { client } = mockSupabase([
      { id: 'b1', vat_amount: null, issue_date: '2026-01-10', status: 'paid' },
      { id: 'b2', vat_amount: 10, issue_date: '2026-01-11', status: 'paid' },
    ])
    const out = await aggregateVatForPeriod(
      'biz',
      '2026-01-01',
      '2026-03-31',
      client
    )
    expect(out.inputVat).toBe(10)
    expect(out.billCount).toBe(2)
  })

  it('filters by status=[paid,approved] — drafts excluded by query', async () => {
    // Simulate server-side filtering: rows passed in already exclude drafts
    // (the aggregator trusts the DB). Assert the .in() filter was applied.
    const { client, calls } = mockSupabase([
      { id: 'b1', vat_amount: 20, issue_date: '2026-01-10', status: 'paid' },
    ])
    await aggregateVatForPeriod('biz', '2026-01-01', '2026-03-31', client)

    const inArgs = calls.in as unknown[]
    expect(inArgs[0]).toBe('status')
    expect(inArgs[1]).toEqual(['paid', 'approved'])
  })

  it('accepts Date objects and converts to YYYY-MM-DD', async () => {
    const { client, calls } = mockSupabase([])
    await aggregateVatForPeriod(
      'biz',
      new Date('2026-01-01T10:00:00Z'),
      new Date('2026-03-31T23:00:00Z'),
      client
    )
    const gteArgs = calls.gte as unknown[]
    const lteArgs = calls.lte as unknown[]
    expect(gteArgs[1]).toBe('2026-01-01')
    expect(lteArgs[1]).toBe('2026-03-31')
  })

  it('throws on DB error', async () => {
    const { client } = mockSupabase([], { message: 'boom' })
    await expect(
      aggregateVatForPeriod('biz', '2026-01-01', '2026-03-31', client)
    ).rejects.toThrow(/boom/)
  })

  it('handles mixed paid+approved statuses correctly', async () => {
    const { client } = mockSupabase([
      { id: 'a', vat_amount: 1, issue_date: '2026-01-01', status: 'paid' },
      { id: 'b', vat_amount: 2, issue_date: '2026-01-02', status: 'approved' },
      { id: 'c', vat_amount: 3, issue_date: '2026-01-03', status: 'paid' },
    ])
    const out = await aggregateVatForPeriod(
      'biz',
      '2026-01-01',
      '2026-03-31',
      client
    )
    expect(out.inputVat).toBe(6)
    expect(out.billIds).toHaveLength(3)
  })
})
