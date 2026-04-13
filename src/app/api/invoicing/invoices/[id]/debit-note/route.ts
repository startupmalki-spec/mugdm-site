/**
 * /api/invoicing/invoices/[id]/debit-note (POST)
 *
 * Creates a new DRAFT debit note (`invoice_subtype = 'debit_note'`,
 * ZATCA InvoiceTypeCode 383) referencing the original invoice. Unlike credit
 * notes, debit notes typically represent additional charges (price increase,
 * extra fees), so we DO NOT clone the original line items — we leave the new
 * invoice empty so the caller adds whatever charges apply on the edit screen.
 *
 * Validation mirrors credit-note: original must be cleared/reported, the
 * caller must own the business, and the production cert must allow new
 * invoices.
 *
 * Response: { invoiceId, invoiceNumber, editUrl }
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

import { createClient } from '@/lib/supabase/server'
import {
  canCreateInvoices,
  getActiveCertStatus,
} from '@/lib/zatca/cert-monitor'
import type { Invoice, ZatcaStatus } from '@/lib/supabase/types'

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

    if (
      original.zatca_status !== 'cleared' &&
      original.zatca_status !== 'reported'
    ) {
      return bilingualError(
        'لا يمكن إصدار إشعار مدين إلا لفاتورة تم اعتمادها أو الإبلاغ عنها.',
        'Debit notes can only be issued for cleared or reported invoices.',
        400,
      )
    }

    const certStatus = await getActiveCertStatus(supabase, original.business_id)
    if (!canCreateInvoices(certStatus)) {
      return bilingualError(
        'انتهت صلاحية شهادة الزكاة. يرجى تجديد CSID الإنتاج قبل إصدار إشعار مدين.',
        'ZATCA certificate has expired. Renew the production CSID before issuing debit notes.',
        403,
      )
    }

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
      invoice_subtype: 'debit_note' as const,
      source: 'mugdm' as const,
      language: original.language,
      issue_date: issueDate,
      supply_date: original.supply_date,
      due_date: null,
      // Empty starter — caller fills line items via PATCH /api/invoicing/invoices/[id].
      subtotal: 0,
      total_vat: 0,
      total_amount: 0,
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
      console.error('[debit-note] insert failed:', insertError)
      return bilingualError(
        'فشل إنشاء إشعار المدين.',
        'Failed to create debit note.',
        500,
      )
    }

    const newId = (inserted as { id: string }).id

    return NextResponse.json(
      {
        invoiceId: newId,
        invoiceNumber,
        editUrl: `/invoicing/invoices/${newId}/edit`,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[debit-note] POST failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
