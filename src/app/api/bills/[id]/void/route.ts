import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { canTransition, type BillStatus } from '@/lib/bookkeeper/bill-workflow'

type RouteContext = { params: Promise<{ id: string }> }

const ParamsSchema = z.object({ id: z.string().uuid() })
const BodySchema = z
  .object({
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .optional()

export async function POST(request: Request, context: RouteContext) {
  if (process.env.NEXT_PUBLIC_FEATURE_BILLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { id } = ParamsSchema.parse(await context.params)

    let reason: string | undefined
    try {
      const raw = await request.clone().json()
      const parsed = BodySchema.parse(raw)
      reason = parsed?.reason
    } catch {
      reason = undefined
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
      .select('id, status, business_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    const { data: biz } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('id', bill.business_id)
      .maybeSingle()

    if (!biz || biz.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const currentStatus = bill.status as BillStatus
    if (currentStatus === 'paid' || !canTransition(currentStatus, 'void')) {
      return NextResponse.json(
        { error: `Cannot void bill in status '${currentStatus}'` },
        { status: 409 }
      )
    }

    const { data: updated, error: updErr } = await supabase
      .from('bills')
      .update({ status: 'void' })
      .eq('id', id)
      .eq('status', currentStatus)
      .select('id, status')
      .maybeSingle()

    if (updErr || !updated) {
      return NextResponse.json(
        { error: 'Failed to void bill — status may have changed' },
        { status: 409 }
      )
    }

    // The audit trigger inserted the 'voided' audit row automatically on status change.
    // Patch the notes on that row if a reason was supplied (latest row for this bill).
    if (reason) {
      const { data: auditRow } = await supabase
        .from('bill_audit_log')
        .select('id')
        .eq('bill_id', id)
        .eq('action', 'voided')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (auditRow?.id) {
        await supabase
          .from('bill_audit_log')
          .update({ notes: reason })
          .eq('id', auditRow.id)
      }
    }

    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 })
    }
    console.error('[API] bills/void failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
