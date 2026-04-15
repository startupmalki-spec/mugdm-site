/**
 * Bills Chat Tools — bill-aware tool definitions for the Chat AI catalog.
 *
 * Tools registered (PRD: BOOKKEEPERDEPTHPRD.md, P0 "Integration — Chat AI"):
 *   - list_bills
 *   - get_bill_by_id
 *   - sum_ap_outstanding
 *   - bills_due_this_week
 *
 * All queries are scoped to the user's business via Supabase RLS — pass the
 * authenticated client. The `businessId` argument is accepted for symmetry
 * with other tool handlers but RLS already enforces scoping.
 *
 * Feature-flagged in the chat route by NEXT_PUBLIC_FEATURE_BILLS === 'true'.
 */

import type Anthropic from '@anthropic-ai/sdk'

import type { createClient } from '@/lib/supabase/server'

type SupabaseLike = Awaited<ReturnType<typeof createClient>>

export const BILLS_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'list_bills',
    description:
      'List accounts-payable bills with optional filters. Use to answer questions like "show me all Zain bills this year" or "which bills are pending?". Joins vendor name. Currency is SAR.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'pending', 'approved', 'paid', 'overdue', 'void'],
          description: 'Filter by bill status',
        },
        vendor_name: {
          type: 'string',
          description: 'Case-insensitive substring match against vendor name (en or ar)',
        },
        due_before: { type: 'string', description: 'Only bills with due_date <= this YYYY-MM-DD' },
        due_after: { type: 'string', description: 'Only bills with due_date >= this YYYY-MM-DD' },
        limit: { type: 'number', description: 'Max results (default 25)' },
      },
      required: [],
    },
  },
  {
    name: 'get_bill_by_id',
    description:
      'Get a single bill by UUID, including its line items and recorded payments. Use after list_bills to drill into a specific bill.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bill_id: { type: 'string', description: 'UUID of the bill' },
      },
      required: ['bill_id'],
    },
  },
  {
    name: 'sum_ap_outstanding',
    description:
      'Total outstanding accounts payable in SAR, grouped by status (pending, approved, overdue). Use to answer "how much do I owe?" type questions.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'bills_due_this_week',
    description:
      'Bills with due_date in the next 7 days, excluding paid/void, sorted by due_date ascending. Use to answer "what is due this week?" or surface upcoming AP.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

/* ───────── Tool implementations ───────── */

interface BillRow {
  id: string
  bill_number: string | null
  issue_date: string
  due_date: string
  subtotal: number | string
  vat_amount: number | string
  total: number | string
  currency: string
  status: string
  vendor_id: string
  vendors?: { name_en: string | null; name_ar: string | null } | null
}

export async function listBills(
  supabase: SupabaseLike,
  args: {
    status?: string
    vendor_name?: string
    due_before?: string
    due_after?: string
    limit?: number
  }
): Promise<unknown> {
  let query = supabase
    .from('bills')
    .select(
      'id, bill_number, issue_date, due_date, subtotal, vat_amount, total, currency, status, vendor_id, vendors!inner(name_en, name_ar)'
    )
    .order('due_date', { ascending: true })
    .limit(args.limit ?? 25)

  if (args.status) query = query.eq('status', args.status as never)
  if (args.due_before) query = query.lte('due_date', args.due_before)
  if (args.due_after) query = query.gte('due_date', args.due_after)
  if (args.vendor_name) {
    const like = `%${args.vendor_name}%`
    query = query.or(`name_en.ilike.${like},name_ar.ilike.${like}`, {
      foreignTable: 'vendors',
    })
  }

  const { data, error } = await query
  if (error) return { error: error.message }

  const rows = (data ?? []) as unknown as BillRow[]
  return rows.map((b) => ({
    id: b.id,
    bill_number: b.bill_number,
    vendor_name: b.vendors?.name_en ?? b.vendors?.name_ar ?? null,
    issue_date: b.issue_date,
    due_date: b.due_date,
    total: Number(b.total),
    currency: b.currency,
    status: b.status,
  }))
}

export async function getBillById(
  supabase: SupabaseLike,
  billId: string
): Promise<unknown> {
  const [billRes, linesRes, paymentsRes] = await Promise.all([
    supabase
      .from('bills')
      .select(
        'id, bill_number, issue_date, due_date, subtotal, vat_amount, vat_rate, total, currency, status, notes, vendor_id, vendors(name_en, name_ar, vat_number)'
      )
      .eq('id', billId)
      .maybeSingle(),
    supabase
      .from('bill_line_items')
      .select('id, description, quantity, unit_price, amount, category, line_order')
      .eq('bill_id', billId)
      .order('line_order', { ascending: true }),
    supabase
      .from('bill_payments')
      .select('id, paid_at, amount, method, reference_number, notes')
      .eq('bill_id', billId)
      .order('paid_at', { ascending: false }),
  ])

  if (billRes.error) return { error: billRes.error.message }
  if (!billRes.data) return { error: 'Bill not found' }

  return {
    bill: billRes.data,
    line_items: linesRes.data ?? [],
    payments: paymentsRes.data ?? [],
  }
}

export async function sumApOutstanding(supabase: SupabaseLike): Promise<unknown> {
  const { data, error } = await supabase
    .from('bills')
    .select('total, status')
    .in('status', ['pending', 'approved', 'overdue'])

  if (error) return { error: error.message }

  const byStatus: Record<string, { count: number; total_sar: number }> = {
    pending: { count: 0, total_sar: 0 },
    approved: { count: 0, total_sar: 0 },
    overdue: { count: 0, total_sar: 0 },
  }
  let total = 0
  for (const row of (data ?? []) as Array<{ total: number | string; status: string }>) {
    const amt = Number(row.total ?? 0)
    total += amt
    const bucket = byStatus[row.status]
    if (bucket) {
      bucket.count += 1
      bucket.total_sar += amt
    }
  }
  return { currency: 'SAR', total_outstanding: total, by_status: byStatus }
}

export async function billsDueThisWeek(supabase: SupabaseLike): Promise<unknown> {
  const today = new Date().toISOString().split('T')[0]
  const inSevenDays = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('bills')
    .select(
      'id, bill_number, due_date, total, currency, status, vendor_id, vendors(name_en, name_ar)'
    )
    .gte('due_date', today)
    .lte('due_date', inSevenDays)
    .not('status', 'in', '(paid,void)')
    .order('due_date', { ascending: true })

  if (error) return { error: error.message }

  const rows = (data ?? []) as unknown as BillRow[]
  return rows.map((b) => ({
    id: b.id,
    bill_number: b.bill_number,
    vendor_name: b.vendors?.name_en ?? b.vendors?.name_ar ?? null,
    due_date: b.due_date,
    total: Number(b.total),
    currency: b.currency,
    status: b.status,
  }))
}

/**
 * Dispatch a bills tool call. Returns null if the tool name is not a bills tool,
 * so the caller can fall through to its default handler.
 */
export async function executeBillsToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: SupabaseLike
): Promise<string | null> {
  switch (toolName) {
    case 'list_bills':
      return JSON.stringify(
        await listBills(supabase, {
          status: toolInput.status as string | undefined,
          vendor_name: toolInput.vendor_name as string | undefined,
          due_before: toolInput.due_before as string | undefined,
          due_after: toolInput.due_after as string | undefined,
          limit: toolInput.limit as number | undefined,
        })
      )
    case 'get_bill_by_id':
      return JSON.stringify(await getBillById(supabase, toolInput.bill_id as string))
    case 'sum_ap_outstanding':
      return JSON.stringify(await sumApOutstanding(supabase))
    case 'bills_due_this_week':
      return JSON.stringify(await billsDueThisWeek(supabase))
    default:
      return null
  }
}

export const BILLS_TOOL_NAMES = new Set([
  'list_bills',
  'get_bill_by_id',
  'sum_ap_outstanding',
  'bills_due_this_week',
])

export function billsToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'
}
