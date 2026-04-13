/**
 * GET /api/invoicing/invoices/[id]/pdf  (Task 61)
 *
 * Streams a bilingual ZATCA invoice PDF (built via @react-pdf/renderer).
 * Auth + ownership check identical to the parent route. The QR PNG (if any)
 * is rendered server-side and embedded as an <Image>.
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'

import { createClient } from '@/lib/supabase/server'
import { generateQrCodeImage } from '@/lib/zatca/qr-code'
import { InvoicePdf } from '@/lib/invoicing/pdf/InvoicePdf'
import type {
  Invoice,
  InvoiceLineItem,
  Customer,
  Business,
} from '@/lib/supabase/types'

export const runtime = 'nodejs'

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

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error || !invoice) {
      return bilingualError(
        'الفاتورة غير موجودة.',
        'Invoice not found.',
        404,
      )
    }
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', invoice.business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!business) {
      return bilingualError('غير مصرّح.', 'Forbidden.', 403)
    }

    const [{ data: lineItems }, customerRes] = await Promise.all([
      supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', id)
        .order('line_number', { ascending: true }),
      invoice.customer_id
        ? supabase.from('customers').select('*').eq('id', invoice.customer_id).maybeSingle()
        : Promise.resolve({ data: null as Customer | null }),
    ])

    const qrDataUrl = invoice.zatca_qr_code
      ? await generateQrCodeImage(invoice.zatca_qr_code)
      : null

    const buffer = await renderToBuffer(
      createElement(InvoicePdf, {
        invoice: invoice as Invoice,
        lineItems: (lineItems ?? []) as InvoiceLineItem[],
        customer: (customerRes.data ?? null) as Customer | null,
        business: business as Business,
        qrDataUrl,
      }) as never,
    )

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[api/invoicing/invoices/:id/pdf] failed:', err)
    return bilingualError('فشل توليد ملف PDF.', 'Failed to generate PDF.', 500)
  }
}
