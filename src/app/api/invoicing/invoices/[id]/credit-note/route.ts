/**
 * /api/invoicing/invoices/[id]/credit-note (POST)
 *
 * Clones an existing cleared/reported invoice into a new DRAFT credit note
 * (`invoice_subtype = 'credit_note'`, ZATCA InvoiceTypeCode 381). The clone:
 *
 *   - Copies seller (via business_id), customer, invoice_type and language.
 *   - Copies all line items at their original positive quantities. The user can
 *     edit quantities later — ZATCA expects positive amounts on the credit note
 *     (the subtype carries the refund semantics).
 *   - Sets `linked_invoice_id` to the original invoice id so the UBL generator
 *     emits the required `<cac:BillingReference>` block.
 *   - Allocates a new INV-YYYY-#### number under the same business.
 *
 * Validation:
 *   - User must own the business (via businesses.user_id).
 *   - Original invoice must be in `cleared` or `reported` state. Drafts /
 *     pending / rejected are rejected with HTTP 400 + bilingual message.
 *   - Production CSID must allow new invoice creation (canCreateInvoices).
 *
 * Bookkeeper integration:
 *   - If the original invoice has `linked_transaction_id`, cloning the
 *     transaction (negative of original) is intentionally NOT performed here —
 *     see report at the bottom of task 62 for the follow-up.
 *
 * Response: { invoiceId, invoiceNumber, editUrl }
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

import { createClient } from '@/lib/supabase/server'
import { calculateInvoiceTotals, calculateLine } from '@/lib/invoicing/calculations'
import { canCreateInvoices } from '@/lib/zatca/cert-monitor'
import { getActiveCertStatus } from '@/lib/zatca/cert-monitor'
import type {
  Invoice,
  InvoiceLineItem,
  ZatcaStatus,
} from '@/lib/supabase/types'

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

async function nextInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  year: number,
): Promise<string> {
  const prefix = `INV-${year}-`
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('business_id', businessId)
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  let nextSeq = 1
  if (data?.invoice_number) {
    const tail = String(data.invoice_number).slice(prefix.length)
    const n = Number.parseInt(tail, 10)
    if (Number.isFinite(n) && n > 0) nextSeq = n + 1
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}

export async function POST(
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

    const { data: originalRow, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (invErr) {
      return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
    }
    if (!originalRow) {
      return bilingualError(
        'الفاتورة غير موجودة.',
        'Invoice not found.',
        404,
      )
    }
    const original = originalRow as Invoice

    // Ownership.
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', original.business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!biz) {
      return bilingualError(
        'النشاط التجاري غير موجود أو لا يخصّك.',
        'Business not found or not owned by current user.',
        403,
      )
    }

    // Original must be cleared or reported. Anything else is meaningless to
    // credit (drafts can be edited; rejected never made it to ZATCA; pending
    // is still in flight).
    if (
      original.zatca_status !== 'cleared' &&
      original.zatca_status !== 'reported'
    ) {
      return bilingualError(
        'لا يمكن إصدار إشعار دائن إلا لفاتورة تم اعتمادها أو الإبلاغ عنها.',
        'Credit notes can only be issued for cleared or reported invoices.',
        400,
      )
    }

    // Cert hard-block (same gate as new-invoice creation).
    const certStatus = await getActiveCertStatus(supabase, original.business_id)
    if (!canCreateInvoices(certStatus)) {
      return bilingualError(
        'انتهت صلاحية شهادة الزكاة. يرجى تجديد CSID الإنتاج قبل إصدار إشعار دائن.',
        'ZATCA certificate has expired. Renew the production CSID before issuing credit notes.',
        403,
      )
    }

    const { data: linesData, error: liErr } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('line_number', { ascending: true })
    if (liErr) {
      return bilingualError(
        'فشل تحميل بنود الفاتورة.',
        'Failed to load original line items.',
        500,
      )
    }
    const originalLines = (linesData ?? []) as InvoiceLineItem[]

    // Recompute monetary fields off the cloned line set so totals are
    // canonical (and so any rounding drift in the original row is not carried
    // forward).
    const normalizedLines = originalLines.map((li, idx) => {
      const r = calculateLine({
        quantity: li.quantity,
        unit_price: li.unit_price,
        discount_amount: li.discount_amount,
        vat_rate: li.vat_rate,
      })
      return {
        line_number: idx + 1,
        description: li.description,
        quantity: Number(li.quantity),
        unit_price: Number(li.unit_price),
        discount_amount:
          li.discount_amount === null || li.discount_amount === undefined
            ? null
            : Number(li.discount_amount),
        vat_rate: Number(li.vat_rate),
        vat_amount: r.vat_amount,
        line_total: r.line_total,
      }
    })

    const totals = calculateInvoiceTotals(normalizedLines)

    const issueDate = new Date().toISOString().slice(0, 10)
    const year = Number.parseInt(issueDate.slice(0, 4), 10) || new Date().getFullYear()
    const invoiceNumber = await nextInvoiceNumber(
      supabase,
      original.business_id,
      year,
    )

    const invoiceRow = {
      business_id: original.business_id,
      customer_id: original.customer_id,
      invoice_number: invoiceNumber,
      invoice_type: original.invoice_type,
      invoice_subtype: 'credit_note' as const,
      source: 'mugdm' as const,
      language: original.language,
      issue_date: issueDate,
      supply_date: original.supply_date,
      due_date: null,
      subtotal: totals.subtotal,
      total_vat: totals.total_vat,
      total_amount: totals.total_amount,
      zatca_status: 'draft' as ZatcaStatus,
      zatca_uuid: randomUUID(),
      zatca_hash: null,
      zatca_qr_code: null,
      zatca_xml: null,
      zatca_response: null,
      zatca_submitted_at: null,
      zatca_cleared_at: null,
      zatca_rejection_reason: null,
      linked_invoice_id: original.id,
      linked_transaction_id: null,
      notes: null,
      payment_terms: null,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('invoices')
      .insert(invoiceRow as never)
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('[credit-note] insert failed:', insertError)
      return bilingualError(
        'فشل إنشاء إشعار الدائن.',
        'Failed to create credit note.',
        500,
      )
    }

    const newId = (inserted as { id: string }).id

    if (normalizedLines.length > 0) {
      const lineRows = normalizedLines.map((l) => ({
        invoice_id: newId,
        line_number: l.line_number,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_amount: l.discount_amount,
        vat_rate: l.vat_rate,
        vat_amount: l.vat_amount,
        line_total: l.line_total,
      }))
      const { error: lineError } = await supabase
        .from('invoice_line_items')
        .insert(lineRows as never)
      if (lineError) {
        console.error('[credit-note] line insert failed:', lineError)
        await supabase.from('invoices').delete().eq('id', newId)
        return bilingualError(
          'فشل حفظ بنود إشعار الدائن.',
          'Failed to save credit note line items.',
          500,
        )
      }
    }

    return NextResponse.json(
      {
        invoiceId: newId,
        invoiceNumber,
        editUrl: `/invoicing/invoices/${newId}/edit`,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[credit-note] POST failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
