/**
 * /api/bills/[id]
 *
 * GET   — Bill detail with vendor, line items, attachments, payments, audit log.
 * PATCH — Edit a bill (header fields + optional full replace of line items).
 *         Only allowed while status ∈ { draft, pending, approved }.
 *         Owner-only (business.user_id = auth.uid()).
 *
 * Audit log rows are written automatically by the `trg_bills_audit` trigger
 * defined in 015_bills_schema.sql, so we only need to UPDATE the row.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import type {
  Bill,
  BillAttachment,
  BillAuditLog,
  BillLineItem,
  BillPayment,
  Vendor,
} from '@/lib/supabase/types'

const FEATURE_BILLS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function loadOwnedBill(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  billId: string,
) {
  const { data: bill, error } = await supabase
    .from('bills')
    .select('*')
    .eq('id', billId)
    .maybeSingle()
  if (error) return { ok: false as const, status: 500 }
  if (!bill) return { ok: false as const, status: 404 }

  const businessId = (bill as unknown as Bill).business_id
  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!biz) return { ok: false as const, status: 404 }

  return { ok: true as const, bill: bill as unknown as Bill }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!FEATURE_BILLS_ENABLED) return err('Feature disabled', 404)
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return err('Unauthorized', 401)

    const loaded = await loadOwnedBill(supabase, user.id, id)
    if (!loaded.ok) return err('Bill not found', loaded.status)

    const [vendorRes, lineItemsRes, attachmentsRes, paymentsRes, auditRes] =
      await Promise.all([
        supabase
          .from('vendors')
          .select('*')
          .eq('id', loaded.bill.vendor_id)
          .maybeSingle(),
        supabase
          .from('bill_line_items')
          .select('*')
          .eq('bill_id', id)
          .order('line_order', { ascending: true }),
        supabase
          .from('bill_attachments')
          .select('*')
          .eq('bill_id', id)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('bill_payments')
          .select('*')
          .eq('bill_id', id)
          .order('paid_at', { ascending: false }),
        supabase
          .from('bill_audit_log')
          .select('*')
          .eq('bill_id', id)
          .order('created_at', { ascending: false }),
      ])

    return NextResponse.json({
      bill: loaded.bill,
      vendor: (vendorRes.data ?? null) as Vendor | null,
      lineItems: (lineItemsRes.data ?? []) as BillLineItem[],
      attachments: (attachmentsRes.data ?? []) as BillAttachment[],
      payments: (paymentsRes.data ?? []) as BillPayment[],
      auditLog: (auditRes.data ?? []) as BillAuditLog[],
    })
  } catch (e) {
    console.error('[api/bills/:id] GET failed:', e)
    return err('Unexpected error', 500)
  }
}

interface PatchBody {
  bill?: {
    bill_number?: string | null
    issue_date?: string
    due_date?: string
    notes?: string | null
    vat_rate?: number
  }
  lineItems?: Array<{
    description: string
    quantity: number
    unit_price: number
    category?: string | null
    cost_center?: string | null
  }>
}

const EDITABLE_STATUSES = new Set(['draft', 'pending', 'approved'])

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!FEATURE_BILLS_ENABLED) return err('Feature disabled', 404)
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return err('Unauthorized', 401)

    const loaded = await loadOwnedBill(supabase, user.id, id)
    if (!loaded.ok) return err('Bill not found', loaded.status)

    if (!EDITABLE_STATUSES.has(loaded.bill.status)) {
      return err('Bill is not editable in its current state', 409)
    }

    const body = (await request.json().catch(() => null)) as PatchBody | null
    if (!body) return err('Invalid request body', 400)

    const updates: Record<string, unknown> = {}
    if (body.bill) {
      const b = body.bill
      if (b.bill_number !== undefined) updates.bill_number = b.bill_number
      if (b.issue_date !== undefined) updates.issue_date = b.issue_date
      if (b.due_date !== undefined) updates.due_date = b.due_date
      if (b.notes !== undefined) updates.notes = b.notes
      if (b.vat_rate !== undefined) updates.vat_rate = Number(b.vat_rate)
    }

    let recomputedSubtotal: number | null = null
    let recomputedVat: number | null = null
    let recomputedTotal: number | null = null

    if (Array.isArray(body.lineItems)) {
      if (body.lineItems.length === 0) {
        return err('At least one line item is required', 400)
      }
      const vatRate =
        (updates.vat_rate as number | undefined) ?? Number(loaded.bill.vat_rate)

      const normalized = body.lineItems.map((li, idx) => {
        const qty = Number(li.quantity ?? 0)
        const unit = Number(li.unit_price ?? 0)
        const amount = Math.round(qty * unit * 100) / 100
        return {
          bill_id: id,
          description: String(li.description ?? '').trim(),
          quantity: qty,
          unit_price: unit,
          amount,
          category: li.category ?? null,
          cost_center: li.cost_center ?? null,
          line_order: idx,
        }
      })

      recomputedSubtotal =
        Math.round(normalized.reduce((s, l) => s + l.amount, 0) * 100) / 100
      recomputedVat = Math.round(recomputedSubtotal * vatRate) / 100
      recomputedTotal =
        Math.round((recomputedSubtotal + recomputedVat) * 100) / 100

      const { error: delErr } = await supabase
        .from('bill_line_items')
        .delete()
        .eq('bill_id', id)
      if (delErr) {
        console.error('[api/bills/:id] line item delete failed:', delErr)
        return err('Failed to update line items', 500)
      }

      const { error: insErr } = await supabase
        .from('bill_line_items')
        .insert(normalized as never)
      if (insErr) {
        console.error('[api/bills/:id] line item insert failed:', insErr)
        return err('Failed to update line items', 500)
      }

      updates.subtotal = recomputedSubtotal
      updates.vat_amount = recomputedVat
      updates.total = recomputedTotal
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from('bills')
        .update(updates as never)
        .eq('id', id)
      if (upErr) {
        console.error('[api/bills/:id] update failed:', upErr)
        return err('Failed to update bill', 500)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/bills/:id] PATCH failed:', e)
    return err('Unexpected error', 500)
  }
}
