/**
 * GET /api/vendors/[id]
 *
 * Feature-flagged on NEXT_PUBLIC_FEATURE_BILLS. 404 when off.
 *
 * Returns: { vendor, summary: { totalSpend, billCount, paidBillCount,
 *   lastPaid, avgCycleDays }, bills: [...], payments: [...] }
 *
 * RLS scopes to the caller's business — we also double-check vendor
 * business_id matches the user's owned business.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Bill, BillPayment, Vendor } from '@/lib/supabase/types'

const FEATURE_ENABLED = () => process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!FEATURE_ENABLED()) return notFound()

  const { id } = await ctx.params
  if (!id) return bilingualError('معرّف المورّد مطلوب.', 'Vendor id required.', 400)

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const { data: vendorRow } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (!vendorRow) return notFound()
    const vendor = vendorRow as unknown as Vendor

    // Ensure ownership.
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', vendor.business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!biz) return notFound()

    const { data: billRows } = await supabase
      .from('bills')
      .select('*')
      .eq('vendor_id', id)
      .order('issue_date', { ascending: false })
    const bills = (billRows ?? []) as unknown as Bill[]

    const billIds = bills.map((b) => b.id)
    let payments: BillPayment[] = []
    if (billIds.length > 0) {
      const { data: paymentRows } = await supabase
        .from('bill_payments')
        .select('*')
        .in('bill_id', billIds)
        .order('paid_at', { ascending: false })
      payments = (paymentRows ?? []) as unknown as BillPayment[]
    }

    let totalSpend = 0
    let paidBillCount = 0
    let lastPaid: string | null = null
    let cycleSum = 0
    let cycleN = 0
    for (const b of bills) {
      if (b.status === 'paid') {
        totalSpend += Number(b.total) || 0
        paidBillCount += 1
        if (b.paid_at && (!lastPaid || b.paid_at > lastPaid)) lastPaid = b.paid_at
        if (b.paid_at && b.issue_date) {
          const issued = new Date(b.issue_date).getTime()
          const paid = new Date(b.paid_at).getTime()
          if (Number.isFinite(issued) && Number.isFinite(paid) && paid >= issued) {
            cycleSum += Math.round((paid - issued) / (1000 * 60 * 60 * 24))
            cycleN += 1
          }
        }
      }
    }

    return NextResponse.json({
      vendor,
      summary: {
        totalSpend,
        billCount: bills.length,
        paidBillCount,
        lastPaid,
        avgCycleDays: cycleN > 0 ? Math.round(cycleSum / cycleN) : null,
      },
      bills,
      payments,
    })
  } catch (err) {
    console.error('[api/vendors/[id]] GET failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
