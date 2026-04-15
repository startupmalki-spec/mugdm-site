/**
 * VAT aggregation for compliance obligations.
 *
 * Aggregates approved/paid bill VAT amounts within a given period so the
 * compliance calendar's quarterly VAT obligation can show the input VAT total
 * collected from supplier bills.
 *
 * Output VAT (from issued invoices) is intentionally out of scope here — see
 * the TODO below; the returned `outputVat` is `0` for now.
 *
 * Feature flag: callers should gate use behind
 * `process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'`. When the flag is off,
 * obligations behave as today (no aggregation).
 *
 * VAT filing frequency:
 *   The default obligation cadence is QUARTERLY. Saudi rules actually require
 *   MONTHLY filing when annual revenue > 40M SAR, QUARTERLY otherwise, and
 *   registration is optional below 375K SAR. The obligation generator already
 *   adjusts cadence based on `annualRevenue` — this aggregator only operates
 *   on whatever period it is handed. TODO: when revenue data is wired through
 *   end-to-end, callers may pass narrower (monthly) periods automatically.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

export interface VatAggregateResult {
  /** Sum of VAT on supplier bills (deductible input VAT). */
  inputVat: number
  /** Output VAT from issued invoices — TODO: wire up invoices source. */
  outputVat: number
  /** Net VAT payable: outputVat − inputVat. */
  netVat: number
  /** Number of bills included in the aggregation. */
  billCount: number
  /** IDs of the bills included — useful for linking from the obligation view. */
  billIds: string[]
}

interface BillRow {
  id: string
  vat_amount: number | null
  issue_date: string | null
  status: string | null
}

/**
 * Aggregate input VAT from approved/paid bills for `businessId` within
 * `[periodStart, periodEnd]` (inclusive). Dates may be `Date` or `YYYY-MM-DD`
 * strings.
 *
 * Returns zeros / empty list when no rows match. Throws on DB error.
 */
export async function aggregateVatForPeriod(
  businessId: string,
  periodStart: Date | string,
  periodEnd: Date | string,
  // We accept a generic SupabaseClient because the `bills` table may not yet
  // exist in the generated `Database` types when this code is first shipped.
  // Once `015_bills_schema.sql` lands and types are regenerated, callers can
  // pass a typed client without changes here.
  supabaseClient: SupabaseClient<Database> | SupabaseClient
): Promise<VatAggregateResult> {
  const start =
    typeof periodStart === 'string'
      ? periodStart
      : periodStart.toISOString().split('T')[0]
  const end =
    typeof periodEnd === 'string'
      ? periodEnd
      : periodEnd.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseClient as any
  const { data, error } = await client
    .from('bills')
    .select('id, vat_amount, issue_date, status')
    .eq('business_id', businessId)
    .in('status', ['paid', 'approved'])
    .gte('issue_date', start)
    .lte('issue_date', end)

  if (error) {
    throw new Error(`vat-aggregator: failed to query bills: ${error.message}`)
  }

  const rows = (data ?? []) as BillRow[]
  let inputVat = 0
  const billIds: string[] = []
  for (const row of rows) {
    inputVat += Number(row.vat_amount ?? 0) || 0
    billIds.push(row.id)
  }

  // TODO: aggregate output VAT from `invoices` table (see ZATCA invoicing
  // module — `src/app/api/invoicing/**`). For now we report 0 so callers can
  // already render the input-VAT breakdown.
  const outputVat = 0
  const netVat = outputVat - inputVat

  return {
    inputVat,
    outputVat,
    netVat,
    billCount: rows.length,
    billIds,
  }
}
