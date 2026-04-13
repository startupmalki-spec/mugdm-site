/**
 * /api/invoicing/invoices/[id]/related-notes (GET)
 *
 * Returns all credit notes and debit notes that reference this invoice via
 * `linked_invoice_id`. Used by the invoice detail page (task 62) to render the
 * "Credit / Debit notes" section beneath a regular invoice.
 *
 * Response: { creditNotes: NoteSummary[], debitNotes: NoteSummary[] }
 *
 * Each NoteSummary contains the fields the detail UI needs to render a row
 * with a link back to the note (id, number, total, date, ZATCA status).
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

export async function GET(
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

    // Ownership check via the parent invoice's business.
    const { data: parent } = await supabase
      .from('invoices')
      .select('id, business_id')
      .eq('id', id)
      .maybeSingle()
    if (!parent) {
      return bilingualError(
        'الفاتورة غير موجودة.',
        'Invoice not found.',
        404,
      )
    }
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', (parent as { business_id: string }).business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!biz) {
      return bilingualError(
        'النشاط التجاري غير موجود أو لا يخصّك.',
        'Business not found or not owned by current user.',
        403,
      )
    }

    const { data: notes, error } = await supabase
      .from('invoices')
      .select(
        'id, invoice_number, invoice_subtype, total_amount, issue_date, zatca_status',
      )
      .eq('linked_invoice_id', id)
      .order('issue_date', { ascending: false })

    if (error) {
      console.error('[related-notes] query failed:', error)
      return bilingualError(
        'فشل تحميل الإشعارات المرتبطة.',
        'Failed to load related notes.',
        500,
      )
    }

    const rows = (notes ?? []) as Array<{
      id: string
      invoice_number: string
      invoice_subtype: 'invoice' | 'credit_note' | 'debit_note'
      total_amount: number
      issue_date: string
      zatca_status: string
    }>

    const creditNotes = rows.filter((n) => n.invoice_subtype === 'credit_note')
    const debitNotes = rows.filter((n) => n.invoice_subtype === 'debit_note')

    return NextResponse.json({ creditNotes, debitNotes })
  } catch (err) {
    console.error('[related-notes] GET failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
