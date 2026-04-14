import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { canTransition, type BillStatus } from '@/lib/bookkeeper/bill-workflow'
import { notifyBillSubmitted } from '@/lib/bookkeeper/bill-notifications'

type RouteContext = { params: Promise<{ id: string }> }

const ParamsSchema = z.object({ id: z.string().uuid() })
const BodySchema = z.object({}).optional()

export async function POST(request: Request, context: RouteContext) {
  if (process.env.NEXT_PUBLIC_FEATURE_BILLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { id } = ParamsSchema.parse(await context.params)

    // Body is optional — validate if present.
    try {
      const maybeBody = await request.clone().json()
      BodySchema.parse(maybeBody)
    } catch {
      // no body is fine
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: bill, error: fetchErr } = await supabase
      .from('bills')
      .select('id, status, bill_number, total, currency, business_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    const { data: biz } = await supabase
      .from('businesses')
      .select('id, user_id, contact_email')
      .eq('id', bill.business_id)
      .maybeSingle()

    if (!biz || biz.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const currentStatus = bill.status as BillStatus
    if (currentStatus !== 'draft' || !canTransition(currentStatus, 'pending')) {
      return NextResponse.json(
        { error: `Cannot submit bill in status '${currentStatus}'` },
        { status: 409 }
      )
    }

    const { data: updated, error: updErr } = await supabase
      .from('bills')
      .update({ status: 'pending' })
      .eq('id', id)
      .eq('status', 'draft')
      .select('id, status, bill_number, total, currency')
      .maybeSingle()

    if (updErr || !updated) {
      return NextResponse.json(
        { error: 'Failed to submit bill — status may have changed' },
        { status: 409 }
      )
    }

    // Fire-and-forget notification
    void notifyBillSubmitted({
      billId: updated.id,
      billNumber: updated.bill_number,
      total: updated.total as number | null,
      currency: updated.currency,
      recipientEmail: biz.contact_email,
    })

    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 })
    }
    console.error('[API] bills/submit failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
