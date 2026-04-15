import { describe, it, expect, vi } from 'vitest'

import {
  BILLS_TOOL_DEFINITIONS,
  BILLS_TOOL_NAMES,
  executeBillsToolCall,
  listBills,
  getBillById,
  sumApOutstanding,
  billsDueThisWeek,
  billsToolsEnabled,
} from '@/lib/agents/bills-chat-tools'

/**
 * Build a thenable query chain that captures filters and resolves to
 * `{ data, error }`. Every chainable method returns `this`; the terminal
 * methods (.maybeSingle and awaiting the chain itself) return the promise.
 */
interface ChainResult<T> {
  data: T
  error: { message: string } | null
}

function buildChain<T>(result: ChainResult<T>, calls: string[] = []) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'eq',
    'in',
    'gte',
    'lte',
    'or',
    'not',
    'order',
    'limit',
  ]
  for (const m of methods) {
    chain[m] = vi.fn((...args: unknown[]) => {
      calls.push(`${m}:${JSON.stringify(args)}`)
      return chain
    })
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  // Make the chain thenable so `await query` works.
  chain.then = (resolve: (r: ChainResult<T>) => unknown) => resolve(result)
  return chain
}

function mockClient(
  tableResults: Record<string, ChainResult<unknown>>
): { client: unknown; calls: Record<string, string[]> } {
  const calls: Record<string, string[]> = {}
  const client = {
    from: vi.fn((tbl: string) => {
      calls[tbl] = calls[tbl] ?? []
      const r = tableResults[tbl] ?? { data: [], error: null }
      return buildChain(r, calls[tbl])
    }),
  }
  return { client, calls }
}

describe('BILLS_TOOL_DEFINITIONS', () => {
  it('exposes exactly 4 tool definitions', () => {
    expect(BILLS_TOOL_DEFINITIONS).toHaveLength(4)
    const names = BILLS_TOOL_DEFINITIONS.map((t) => t.name)
    expect(names.sort()).toEqual(
      ['bills_due_this_week', 'get_bill_by_id', 'list_bills', 'sum_ap_outstanding']
    )
  })

  it('BILLS_TOOL_NAMES matches definitions', () => {
    for (const def of BILLS_TOOL_DEFINITIONS) {
      expect(BILLS_TOOL_NAMES.has(def.name)).toBe(true)
    }
  })

  it('get_bill_by_id requires bill_id', () => {
    const def = BILLS_TOOL_DEFINITIONS.find((t) => t.name === 'get_bill_by_id')!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((def.input_schema as any).required).toContain('bill_id')
  })
})

describe('listBills', () => {
  it('returns mapped rows with vendor_name flattened', async () => {
    const { client } = mockClient({
      bills: {
        data: [
          {
            id: 'b1',
            bill_number: 'INV-1',
            issue_date: '2026-01-01',
            due_date: '2026-01-31',
            subtotal: 100,
            vat_amount: 15,
            total: 115,
            currency: 'SAR',
            status: 'pending',
            vendor_id: 'v1',
            vendors: { name_en: 'Zain', name_ar: 'زين' },
          },
        ],
        error: null,
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = (await listBills(client as any, {})) as Array<Record<string, unknown>>
    expect(Array.isArray(out)).toBe(true)
    expect(out[0].vendor_name).toBe('Zain')
    expect(out[0].total).toBe(115)
    expect(out[0].currency).toBe('SAR')
  })

  it('returns { error } on DB failure', async () => {
    const { client } = mockClient({
      bills: { data: null, error: { message: 'rls denied' } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = (await listBills(client as any, {})) as { error: string }
    expect(out.error).toBe('rls denied')
  })

  it('applies status and date filters to the chain', async () => {
    const { client, calls } = mockClient({
      bills: { data: [], error: null },
    })
    await listBills(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      { status: 'pending', due_before: '2026-03-31', due_after: '2026-01-01', limit: 10 }
    )
    const billCalls = calls.bills.join('|')
    expect(billCalls).toMatch(/eq:\["status","pending"\]/)
    expect(billCalls).toMatch(/lte:\["due_date","2026-03-31"\]/)
    expect(billCalls).toMatch(/gte:\["due_date","2026-01-01"\]/)
    expect(billCalls).toMatch(/limit:\[10\]/)
  })
})

describe('getBillById', () => {
  it('returns bill + line_items + payments shape', async () => {
    const { client } = mockClient({
      bills: {
        data: { id: 'b1', total: 100, vendors: { name_en: 'X' } },
        error: null,
      },
      bill_line_items: {
        data: [{ id: 'l1', description: 'Item', amount: 100 }],
        error: null,
      },
      bill_payments: {
        data: [{ id: 'p1', amount: 50 }],
        error: null,
      },
    })
    const out = (await getBillById(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      'b1'
    )) as { bill: unknown; line_items: unknown[]; payments: unknown[] }
    expect(out.bill).toBeTruthy()
    expect(out.line_items).toHaveLength(1)
    expect(out.payments).toHaveLength(1)
  })

  it('returns { error } when bill not found', async () => {
    const { client } = mockClient({
      bills: { data: null, error: null },
      bill_line_items: { data: [], error: null },
      bill_payments: { data: [], error: null },
    })
    const out = (await getBillById(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      'missing'
    )) as { error: string }
    expect(out.error).toBe('Bill not found')
  })
})

describe('sumApOutstanding', () => {
  it('buckets totals by status and sums overall', async () => {
    const { client } = mockClient({
      bills: {
        data: [
          { total: 100, status: 'pending' },
          { total: 50, status: 'pending' },
          { total: 200, status: 'approved' },
          { total: 75, status: 'overdue' },
        ],
        error: null,
      },
    })
    const out = (await sumApOutstanding(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any
    )) as {
      currency: string
      total_outstanding: number
      by_status: Record<string, { count: number; total_sar: number }>
    }
    expect(out.currency).toBe('SAR')
    expect(out.total_outstanding).toBe(425)
    expect(out.by_status.pending).toEqual({ count: 2, total_sar: 150 })
    expect(out.by_status.approved).toEqual({ count: 1, total_sar: 200 })
    expect(out.by_status.overdue).toEqual({ count: 1, total_sar: 75 })
  })

  it('returns zero buckets when no bills', async () => {
    const { client } = mockClient({ bills: { data: [], error: null } })
    const out = (await sumApOutstanding(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any
    )) as { total_outstanding: number }
    expect(out.total_outstanding).toBe(0)
  })
})

describe('billsDueThisWeek', () => {
  it('maps rows and flattens vendor_name', async () => {
    const { client } = mockClient({
      bills: {
        data: [
          {
            id: 'b1',
            bill_number: 'INV-99',
            due_date: '2026-04-16',
            total: 500,
            currency: 'SAR',
            status: 'pending',
            vendor_id: 'v1',
            vendors: { name_en: 'STC', name_ar: 'اس تي سي' },
          },
        ],
        error: null,
      },
    })
    const out = (await billsDueThisWeek(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any
    )) as Array<{ vendor_name: string }>
    expect(out[0].vendor_name).toBe('STC')
  })
})

describe('executeBillsToolCall — dispatcher', () => {
  function emptyClient() {
    return mockClient({
      bills: { data: [], error: null },
      bill_line_items: { data: [], error: null },
      bill_payments: { data: [], error: null },
    }).client
  }

  it('routes list_bills', async () => {
    const res = await executeBillsToolCall(
      'list_bills',
      {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emptyClient() as any
    )
    expect(res).not.toBeNull()
    expect(() => JSON.parse(res as string)).not.toThrow()
  })

  it('routes sum_ap_outstanding', async () => {
    const res = await executeBillsToolCall(
      'sum_ap_outstanding',
      {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emptyClient() as any
    )
    const parsed = JSON.parse(res as string)
    expect(parsed.currency).toBe('SAR')
  })

  it('routes bills_due_this_week', async () => {
    const res = await executeBillsToolCall(
      'bills_due_this_week',
      {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emptyClient() as any
    )
    expect(JSON.parse(res as string)).toEqual([])
  })

  it('routes get_bill_by_id with bill_id input', async () => {
    const { client } = mockClient({
      bills: { data: { id: 'b1' }, error: null },
      bill_line_items: { data: [], error: null },
      bill_payments: { data: [], error: null },
    })
    const res = await executeBillsToolCall(
      'get_bill_by_id',
      { bill_id: 'b1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any
    )
    const parsed = JSON.parse(res as string)
    expect(parsed.bill).toBeTruthy()
  })

  it('returns null for unknown tool names', async () => {
    const res = await executeBillsToolCall(
      'not_a_bills_tool',
      {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      emptyClient() as any
    )
    expect(res).toBeNull()
  })
})

describe('billsToolsEnabled', () => {
  it('reads NEXT_PUBLIC_FEATURE_BILLS env', () => {
    const prev = process.env.NEXT_PUBLIC_FEATURE_BILLS
    process.env.NEXT_PUBLIC_FEATURE_BILLS = 'true'
    expect(billsToolsEnabled()).toBe(true)
    process.env.NEXT_PUBLIC_FEATURE_BILLS = 'false'
    expect(billsToolsEnabled()).toBe(false)
    if (prev === undefined) delete process.env.NEXT_PUBLIC_FEATURE_BILLS
    else process.env.NEXT_PUBLIC_FEATURE_BILLS = prev
  })
})
