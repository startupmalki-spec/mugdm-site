/**
 * GET /api/invoicing/invoices/[id]/qr  (Task 61)
 *
 * Returns the ZATCA QR PNG as a `data:` URL JSON payload. We resolve the
 * rendered PNG server-side (Node's `qrcode` package isn't appropriate to ship
 * to the client) and return only the encoded image, never the raw TLV payload.
 *
 * Auth: same ownership check as the parent invoice route.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { generateQrCodeImage } from '@/lib/zatca/qr-code'

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
      .select('id, business_id, zatca_qr_code')
      .eq('id', id)
      .maybeSingle()
    if (error || !invoice) {
      return bilingualError(
        'الفاتورة غير موجودة.',
        'Invoice not found.',
        404,
      )
    }
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', invoice.business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!biz) {
      return bilingualError('غير مصرّح.', 'Forbidden.', 403)
    }

    if (!invoice.zatca_qr_code) {
      return bilingualError(
        'لا يوجد رمز QR لهذه الفاتورة بعد.',
        'No QR code is available for this invoice yet.',
        409,
      )
    }

    const dataUrl = await generateQrCodeImage(invoice.zatca_qr_code)
    return NextResponse.json({ dataUrl })
  } catch (err) {
    console.error('[api/invoicing/invoices/:id/qr] failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
