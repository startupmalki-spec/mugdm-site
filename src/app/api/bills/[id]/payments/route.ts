/**
 * /api/bills/[id]/payments
 *
 * POST — Record a payment against a bill.
 *
 * Strategy (no Postgres RPC — kept in app code so all logic stays inside the
 * Next.js repo):
 *
 *   1. Insert into `bill_payments`. If this fails we abort.
 *   2. Update bill: status='paid', paid_at=<paidAt>. If this fails we delete
 *      the payment row we just created (best-effort rollback) and return 500.
 *   3. Insert a Money Out row into `transactions`. If this fails we still
 *      return 200 because the canonical AP record is correct, but we log the
 *      reconciliation gap so it can be back-filled. (The user's bill is paid;
 *      cash-flow charts will be off until the row is created.)
 *
 * Owner-only: business.user_id = auth.uid().
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import type {
  Bill,
  PaymentMethod,
  TransactionCategory,
} from '@/lib/supabase/types'

const FEATURE_BILLS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

const VALID_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'cash',
  'card',
  'check',
  'other',
]

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

interface PostBody {
  paid_at: string
  amount?: number
  method: PaymentMethod
  reference_number?: string | null
  confirmation_attachment_key?: string | null
  notes?: string | null
}

function pickBillCategory(
  lineItemCategories: Array<string | null>,
): TransactionCategory {
  // Use the first explicitly set category if it matches a known transaction
  // category, otherwise default to OTHER_EXPENSE.
  const allowed = new Set<TransactionCategory>([
    'GOVERNMENT',
    'SALARY',
    'RENT',
    'UTILITIES',
    'SUPPLIES',
    'TRANSPORT',
    'MARKETING',
    'PROFESSIONAL',
    'INSURANCE',
    'BANK_FEES',
    'OTHER_EXPENSE',
  ])
  for (const c of lineItemCategories) {
    if (c && allowed.has(c.toUpperCase() as TransactionCategory)) {
      return c.toUpperCase() as TransactionCategory
    }
  }
  return 'OTHER_EXPENSE'
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!FEATURE_BILLS_ENABLED) return err('Feature disabled', 404)
  let userId: string | null = null
  let createdPaymentId: string | null = null

  try {
    const { id: billId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return err('Unauthorized', 401)
    userId = user.id

    // Load bill + verify ownership
    const { data: billRow } = await supabase
      .from('bills')
      .select('*')
      .eq('id', billId)
      .maybeSingle()
    if (!billRow) return err('Bill not found', 404)
    const bill = billRow as unknown as Bill

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', bill.business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!biz) return err('Bill not found', 404)

    if (bill.status === 'paid') return err('Bill is already paid', 409)
    if (bill.status === 'void') return err('Cannot pay a voided bill', 409)

    const body = (await request.json().catch(() => null)) as PostBody | null
    if (!body) return err('Invalid request body', 400)
    if (!body.paid_at) return err('paid_at is required', 400)
    if (!VALID_METHODS.includes(body.method)) {
      return err('Invalid payment method', 400)
    }

    const amount = Number(body.amount ?? bill.total)
    if (!Number.isFinite(amount) || amount <= 0) {
      return err('amount must be greater than zero', 400)
    }

    // Step 1 — bill_payments insert
    const { data: paymentInsert, error: payErr } = await supabase
      .from('bill_payments')
      .insert({
        bill_id: billId,
        paid_at: body.paid_at,
        amount,
        method: body.method,
        reference_number: body.reference_number ?? null,
        confirmation_attachment_key: body.confirmation_attachment_key ?? null,
        notes: body.notes ?? null,
        created_by: user.id,
      } as never)
      .select('id')
      .single()

    if (payErr || !paymentInsert) {
      console.error('[api/bills/:id/payments] payment insert failed:', {
        userId,
        billId,
        error: payErr?.message,
      })
      return err('Failed to record payment', 500)
    }
    createdPaymentId = (paymentInsert as { id: string }).id

    // Step 2 — flip bill to paid
    const { error: updErr } = await supabase
      .from('bills')
      .update({
        status: 'paid',
        paid_at: body.paid_at,
      } as never)
      .eq('id', billId)

    if (updErr) {
      console.error('[api/bills/:id/payments] bill status update failed:', {
        userId,
        billId,
        error: updErr.message,
      })
      // best-effort rollback
      await supabase.from('bill_payments').delete().eq('id', createdPaymentId)
      return err('Failed to mark bill as paid', 500)
    }

    // Step 3 — Money Out transaction (non-fatal)
    const { data: lineItems } = await supabase
      .from('bill_line_items')
      .select('category')
      .eq('bill_id', billId)
    const { data: vendor } = await supabase
      .from('vendors')
      .select('name_en,name_ar')
      .eq('id', bill.vendor_id)
      .maybeSingle()

    const vendorName =
      (vendor as { name_en: string | null; name_ar: string | null } | null)
        ?.name_en ??
      (vendor as { name_en: string | null; name_ar: string | null } | null)
        ?.name_ar ??
      null
    const category = pickBillCategory(
      ((lineItems ?? []) as Array<{ category: string | null }>).map(
        (l) => l.category,
      ),
    )

    const description = bill.bill_number
      ? `Bill payment — ${bill.bill_number}`
      : 'Bill payment'

    const { error: txErr } = await supabase.from('transactions').insert({
      business_id: bill.business_id,
      date: body.paid_at.slice(0, 10),
      amount,
      type: 'EXPENSE',
      category,
      description,
      vendor_or_client: vendorName,
      source: 'MANUAL',
      source_file_id: null,
      receipt_url: null,
      linked_obligation_id: null,
      vat_amount: Number(bill.vat_amount) || null,
      ai_confidence: null,
      is_reviewed: true,
    } as never)

    if (txErr) {
      console.error(
        '[api/bills/:id/payments] money-out transaction insert failed (non-fatal):',
        { userId, billId, error: txErr.message },
      )
    }

    return NextResponse.json({
      ok: true,
      payment_id: createdPaymentId,
      transaction_created: !txErr,
    })
  } catch (e) {
    console.error('[api/bills/:id/payments] POST failed:', {
      userId,
      error: e instanceof Error ? e.message : 'Unknown error',
    })
    return err('Unexpected error', 500)
  }
}
