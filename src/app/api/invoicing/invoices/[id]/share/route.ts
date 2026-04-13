/**
 * POST /api/invoicing/invoices/[id]/share  (Task 61)
 *
 * Mints a 30-day JWT for the given invoice and returns a public share URL.
 * The token only carries `{ invoiceId }` — the public viewer re-loads the
 * invoice from the DB via the service-role client (bypassing RLS) once it
 * verifies the signature.
 *
 * Required env: `SHARE_LINK_SECRET` (HMAC secret for jsonwebtoken).
 * Optional: `NEXT_PUBLIC_APP_URL` (used to build the absolute share URL;
 * falls back to `request.nextUrl.origin`).
 */

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

import { createClient } from '@/lib/supabase/server'

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const secret = process.env.SHARE_LINK_SECRET
    if (!secret) {
      return bilingualError(
        'لم يتم ضبط مفتاح مشاركة الفاتورة.',
        'Server is missing SHARE_LINK_SECRET.',
        500,
      )
    }

    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, business_id')
      .eq('id', id)
      .maybeSingle()
    if (!invoice) {
      return bilingualError('الفاتورة غير موجودة.', 'Invoice not found.', 404)
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

    const token = jwt.sign({ invoiceId: id }, secret, {
      expiresIn: THIRTY_DAYS_SECONDS,
    })

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      request.nextUrl.origin
    const url = `${origin}/share/invoice/${token}`

    return NextResponse.json({ url, token, expiresInSeconds: THIRTY_DAYS_SECONDS })
  } catch (err) {
    console.error('[api/invoicing/invoices/:id/share] failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
