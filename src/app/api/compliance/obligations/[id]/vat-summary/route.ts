/**
 * GET /api/compliance/obligations/[id]/vat-summary
 *
 * Returns aggregated input VAT (from supplier bills) for a ZATCA_VAT
 * obligation's reporting period, plus the list of linked bills. The output
 * VAT half is a TODO — see `vat-aggregator.ts`.
 *
 * Auth: caller must own the obligation's business.
 * Feature flag: when `NEXT_PUBLIC_FEATURE_BILLS !== 'true'` the route returns
 * an empty/zeroed response so the UI degrades gracefully.
 *
 * NOTE: Next.js dynamic-segment params are async in this version; route
 * handlers must `await` the `params` object.
 */

import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  getVatObligationPeriod,
  linkBillsToVatObligation,
  type BillLike,
} from '@/lib/compliance/obligation-generator'
import { aggregateVatForPeriod } from '@/lib/compliance/vat-aggregator'

type RouteContext = { params: Promise<{ id: string }> }

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح', 'Unauthorized', 401)
    }

    // Load obligation + ownership check via embedded business join.
    const { data: obligation, error: obErr } = await supabase
      .from('obligations')
      .select(
        'id, type, frequency, next_due_date, business_id, business:businesses!inner(id, user_id)'
      )
      .eq('id', id)
      .maybeSingle()

    if (obErr) {
      return bilingualError(
        'فشل تحميل الالتزام',
        'Failed to load obligation',
        500
      )
    }
    if (!obligation) {
      return bilingualError('غير موجود', 'Not found', 404)
    }

    // The embedded business may come back as an array or an object depending
    // on PostgREST hinting; handle both.
    const biz = Array.isArray(
      (obligation as { business?: unknown }).business
    )
      ? ((obligation as unknown as { business: Array<{ user_id: string }> })
          .business[0])
      : ((obligation as unknown as { business: { user_id: string } | null })
          .business)

    if (!biz || biz.user_id !== user.id) {
      return bilingualError('غير مصرّح', 'Forbidden', 403)
    }

    if (obligation.type !== 'ZATCA_VAT') {
      return bilingualError(
        'هذا الالتزام لا يخص ضريبة القيمة المضافة',
        'This obligation is not a VAT obligation',
        400
      )
    }

    const period = getVatObligationPeriod(
      obligation.frequency,
      obligation.next_due_date
    )
    const periodStart = period.start.toISOString().split('T')[0]
    const periodEnd = period.end.toISOString().split('T')[0]

    const billsEnabled = process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

    if (!billsEnabled) {
      return NextResponse.json({
        obligation_id: obligation.id,
        period_start: periodStart,
        period_end: periodEnd,
        input_vat: 0,
        output_vat: 0,
        net_vat: 0,
        bill_count: 0,
        bills: [],
        feature_disabled: true,
      })
    }

    const summary = await aggregateVatForPeriod(
      obligation.business_id,
      period.start,
      period.end,
      supabase
    )

    // Re-query minimal bill metadata for the response so the UI can render a
    // list. Kept as a best-effort: if it fails we still return the totals.
    let bills: Array<{ id: string; issue_date: string | null; vat_amount: number | null; status: string | null }> = []
    if (summary.billIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any
      const { data: rows } = await client
        .from('bills')
        .select('id, issue_date, vat_amount, status, supplier_name')
        .in('id', summary.billIds)
      if (rows) bills = rows
    }

    // Defensive double-check: re-link via the pure helper to ensure the
    // returned bill list matches the obligation period exactly.
    const linkedIds = new Set(
      linkBillsToVatObligation(
        {
          type: obligation.type,
          frequency: obligation.frequency,
          next_due_date: obligation.next_due_date,
        },
        bills as BillLike[]
      )
    )
    const linkedBills = bills.filter((b) => linkedIds.has(b.id))

    return NextResponse.json({
      obligation_id: obligation.id,
      period_start: periodStart,
      period_end: periodEnd,
      input_vat: summary.inputVat,
      output_vat: summary.outputVat,
      net_vat: summary.netVat,
      bill_count: summary.billCount,
      bills: linkedBills,
    })
  } catch (error) {
    console.error('[API] vat-summary failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return bilingualError(
      'حدث خطأ غير متوقّع',
      'Internal server error',
      500
    )
  }
}
