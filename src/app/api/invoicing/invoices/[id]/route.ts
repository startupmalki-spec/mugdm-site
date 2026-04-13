/**
 * /api/invoicing/invoices/[id]
 *
 * GET    — Fetch the invoice plus its line items (ordered by line_number).
 * PATCH  — Update a DRAFT invoice (header fields + full replace of line items).
 *          Rejects updates to invoices that are no longer in `zatca_status='draft'`.
 * DELETE — Delete a DRAFT invoice (and its line items via FK cascade, if
 *          configured; otherwise line items are removed first explicitly).
 *
 * Ownership is checked through the invoice's business_id → businesses.user_id.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  calculateInvoiceTotals,
  calculateLine,
} from '@/lib/invoicing/calculations'
import type { InvoiceLanguage } from '@/lib/supabase/types'

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

async function loadOwnedInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  invoiceId: string,
  selectExpr: string = '*',
) {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(selectExpr)
    .eq('id', invoiceId)
    .maybeSingle()
  if (error) return { ok: false as const, status: 500 }
  if (!invoice) return { ok: false as const, status: 404 }

  const businessId = (invoice as unknown as { business_id: string }).business_id
  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!biz) return { ok: false as const, status: 403 }

  return { ok: true as const, invoice }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    // Optional embeds via ?include=customer,linked_invoice
    const include = (new URL(request.url).searchParams.get('include') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const parts = ['*']
    if (include.includes('customer')) {
      parts.push('customer:customers(id,name,name_en,vat_number,cr_number,address,email,phone)')
    }
    if (include.includes('linked_invoice')) {
      parts.push(
        'linked_invoice:invoices!linked_invoice_id(id,invoice_number,total_amount,issue_date,zatca_status,invoice_subtype)',
      )
    }
    const selectExpr = parts.join(', ')

    const loaded = await loadOwnedInvoice(supabase, user.id, id, selectExpr)
    if (!loaded.ok) {
      return bilingualError(
        'الفاتورة غير موجودة أو لا تخصّك.',
        'Invoice not found or not yours.',
        loaded.status,
      )
    }

    const { data: lineItems, error: lineErr } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('line_number', { ascending: true })

    if (lineErr) {
      console.error('[api/invoicing/invoices/:id] load lines failed:', lineErr)
      return bilingualError(
        'فشل تحميل بنود الفاتورة.',
        'Failed to load line items.',
        500,
      )
    }

    return NextResponse.json({
      invoice: loaded.invoice,
      lineItems: lineItems ?? [],
    })
  } catch (err) {
    console.error('[api/invoicing/invoices/:id] GET failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}

interface LineItemPatch {
  line_number?: number
  description?: string
  quantity?: number
  unit_price?: number
  discount_amount?: number | null
  vat_rate?: number
}

interface PatchBody {
  invoice?: {
    customer_id?: string | null
    language?: InvoiceLanguage
    issue_date?: string
    supply_date?: string | null
    due_date?: string | null
    payment_terms?: string | null
    notes?: string | null
  }
  lineItems?: LineItemPatch[]
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const loaded = await loadOwnedInvoice(supabase, user.id, id)
    if (!loaded.ok) {
      return bilingualError(
        'الفاتورة غير موجودة أو لا تخصّك.',
        'Invoice not found or not yours.',
        loaded.status,
      )
    }
    if ((loaded.invoice as unknown as { zatca_status: string }).zatca_status !== 'draft') {
      return bilingualError(
        'لا يمكن تعديل فاتورة مُرسلة إلى الهيئة.',
        'Only draft invoices can be edited.',
        409,
      )
    }

    const body = (await request.json().catch(() => null)) as PatchBody | null
    if (!body) {
      return bilingualError('حمولة غير صالحة.', 'Invalid request body.', 400)
    }

    const updates: Record<string, unknown> = {}
    if (body.invoice) {
      const i = body.invoice
      if (i.customer_id !== undefined) updates.customer_id = i.customer_id
      if (i.language !== undefined) updates.language = i.language
      if (i.issue_date !== undefined) updates.issue_date = i.issue_date
      if (i.supply_date !== undefined) updates.supply_date = i.supply_date
      if (i.due_date !== undefined) updates.due_date = i.due_date
      if (i.payment_terms !== undefined) updates.payment_terms = i.payment_terms
      if (i.notes !== undefined) updates.notes = i.notes
    }

    // If line items are supplied, we recompute totals and replace the set.
    if (Array.isArray(body.lineItems)) {
      const normalized = body.lineItems.map((li, idx) => {
        const r = calculateLine({
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_amount: li.discount_amount,
          vat_rate: li.vat_rate,
        })
        return {
          invoice_id: id,
          line_number: Number.isFinite(li.line_number)
            ? Number(li.line_number)
            : idx + 1,
          description: String(li.description ?? '').trim(),
          quantity: Number(li.quantity ?? 0),
          unit_price: Number(li.unit_price ?? 0),
          discount_amount:
            li.discount_amount === null || li.discount_amount === undefined
              ? null
              : Number(li.discount_amount),
          vat_rate: Number(li.vat_rate ?? 0),
          vat_amount: r.vat_amount,
          line_total: r.line_total,
        }
      })

      if (normalized.length === 0) {
        return bilingualError(
          'أضف بندًا واحدًا على الأقل.',
          'At least one line item is required.',
          400,
        )
      }

      const totals = calculateInvoiceTotals(normalized)
      updates.subtotal = totals.subtotal
      updates.total_vat = totals.total_vat
      updates.total_amount = totals.total_amount

      // Replace line items: delete + insert. Any failure after delete triggers
      // a best-effort rollback via re-inserting the previous rows — that's not
      // worth the complexity for a draft, so we just surface the error.
      const { error: delErr } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', id)
      if (delErr) {
        console.error('[api/invoicing/invoices/:id] delete lines failed:', delErr)
        return bilingualError(
          'فشل تحديث بنود الفاتورة.',
          'Failed to update line items.',
          500,
        )
      }
      const { error: insErr } = await supabase
        .from('invoice_line_items')
        .insert(normalized as never)
      if (insErr) {
        console.error('[api/invoicing/invoices/:id] insert lines failed:', insErr)
        return bilingualError(
          'فشل تحديث بنود الفاتورة.',
          'Failed to update line items.',
          500,
        )
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from('invoices')
        .update(updates as never)
        .eq('id', id)
      if (upErr) {
        console.error('[api/invoicing/invoices/:id] update failed:', upErr)
        return bilingualError(
          'فشل تحديث الفاتورة.',
          'Failed to update invoice.',
          500,
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/invoicing/invoices/:id] PATCH failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const loaded = await loadOwnedInvoice(supabase, user.id, id)
    if (!loaded.ok) {
      return bilingualError(
        'الفاتورة غير موجودة أو لا تخصّك.',
        'Invoice not found or not yours.',
        loaded.status,
      )
    }
    if ((loaded.invoice as unknown as { zatca_status: string }).zatca_status !== 'draft') {
      return bilingualError(
        'لا يمكن حذف فاتورة مُرسلة إلى الهيئة.',
        'Only draft invoices can be deleted.',
        409,
      )
    }

    // Remove line items first (in case no FK ON DELETE CASCADE).
    await supabase.from('invoice_line_items').delete().eq('invoice_id', id)

    const { error: delErr } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
    if (delErr) {
      console.error('[api/invoicing/invoices/:id] delete failed:', delErr)
      return bilingualError(
        'فشل حذف الفاتورة.',
        'Failed to delete invoice.',
        500,
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/invoicing/invoices/:id] DELETE failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
