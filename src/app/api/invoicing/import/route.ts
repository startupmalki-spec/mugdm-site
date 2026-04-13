/**
 * POST /api/invoicing/import?businessId=<uuid>
 *
 * Accepts a multipart form with a `file` field containing a UBL 2.1 invoice XML.
 * Parses + structurally validates it, and returns `{ parsed, errors }`.
 *
 * Does NOT write to the database — the caller previews the parsed invoice
 * and confirms via POST /api/invoicing/import/save.
 *
 * Auth: Supabase session cookie. The `businessId` query param must belong
 * to the current user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  parseImportedInvoice,
  validateImportedInvoice,
} from '@/lib/zatca/xml-import'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get('businessId')
    if (!businessId) {
      return NextResponse.json(
        {
          error: {
            ar: 'معرّف النشاط التجاري مطلوب.',
            en: 'businessId query param is required.',
          },
        },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: { ar: 'غير مصرّح.', en: 'Unauthorized.' } },
        { status: 401 },
      )
    }

    // Verify business ownership.
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (bizError || !business) {
      return NextResponse.json(
        {
          error: {
            ar: 'النشاط التجاري غير موجود أو لا يخصّك.',
            en: 'Business not found or not owned by current user.',
          },
        },
        { status: 403 },
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          error: {
            ar: 'ملف XML مطلوب.',
            en: 'XML file is required.',
          },
        },
        { status: 400 },
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: {
            ar: 'حجم الملف يتجاوز 5 ميجابايت.',
            en: 'File exceeds 5 MB limit.',
          },
        },
        { status: 413 },
      )
    }

    const xml = await file.text()

    let parsed
    try {
      parsed = parseImportedInvoice(xml)
    } catch (err) {
      const code = err instanceof Error ? err.message : 'PARSE_ERROR'
      const bilingual =
        code.startsWith('MALFORMED_XML') || code === 'EMPTY_XML'
          ? {
              ar: 'ملف XML غير صالح أو تالف.',
              en: 'Invalid or malformed XML file.',
            }
          : code === 'MISSING_INVOICE_ROOT'
            ? {
                ar: 'لم يتم العثور على عنصر <Invoice> الجذري.',
                en: 'Root <Invoice> element not found.',
              }
            : {
                ar: 'تعذّر قراءة الفاتورة.',
                en: 'Failed to read invoice.',
              }
      return NextResponse.json(
        { error: bilingual, code },
        { status: 400 },
      )
    }

    const { valid, errors } = validateImportedInvoice(parsed)

    return NextResponse.json({ parsed, valid, errors })
  } catch (err) {
    console.error('[api/invoicing/import] failed:', err)
    return NextResponse.json(
      {
        error: {
          ar: 'فشل غير متوقّع أثناء الاستيراد.',
          en: 'Unexpected import failure.',
        },
      },
      { status: 500 },
    )
  }
}
