/**
 * POST /api/invoicing/import/save
 *
 * Body: { businessId: string, parsed: ParsedImportedInvoice }
 *
 * Inserts the parsed invoice + its line items as drafts (source=imported_xml,
 * zatca_status=draft). Downstream ZATCA submission is handled separately
 * (task 57) — this route purely persists.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  validateImportedInvoice,
  type ParsedImportedInvoice,
} from '@/lib/zatca/xml-import'

interface SaveBody {
  businessId?: string
  parsed?: ParsedImportedInvoice
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as SaveBody | null
    if (!body || !body.businessId || !body.parsed) {
      return NextResponse.json(
        {
          error: {
            ar: 'حمولة غير صالحة.',
            en: 'Invalid request body.',
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
      .eq('id', body.businessId)
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

    // Re-validate server-side to prevent trusting a mutated client payload.
    const { valid, errors } = validateImportedInvoice(body.parsed)
    if (!valid) {
      return NextResponse.json(
        {
          error: {
            ar: 'الفاتورة لا تجتاز التحقق.',
            en: 'Invoice failed validation.',
          },
          errors,
        },
        { status: 422 },
      )
    }

    const { invoice, lineItems } = body.parsed

    const invoiceRow = {
      ...invoice,
      business_id: body.businessId,
      source: 'imported_xml' as const,
      zatca_status: 'draft' as const,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('invoices')
      .insert(invoiceRow as never)
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error(
        '[api/invoicing/import/save] invoice insert failed:',
        insertError,
      )
      return NextResponse.json(
        {
          error: {
            ar: 'فشل حفظ الفاتورة.',
            en: 'Failed to save invoice.',
          },
        },
        { status: 500 },
      )
    }

    const invoiceId = (inserted as { id: string }).id

    if (lineItems.length > 0) {
      const lineRows = lineItems.map((li) => ({ ...li, invoice_id: invoiceId }))
      const { error: lineError } = await supabase
        .from('invoice_line_items')
        .insert(lineRows as never)

      if (lineError) {
        console.error(
          '[api/invoicing/import/save] line items insert failed:',
          lineError,
        )
        // Best-effort rollback.
        await supabase.from('invoices').delete().eq('id', invoiceId)
        return NextResponse.json(
          {
            error: {
              ar: 'فشل حفظ بنود الفاتورة.',
              en: 'Failed to save invoice line items.',
            },
          },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({ invoiceId }, { status: 201 })
  } catch (err) {
    console.error('[api/invoicing/import/save] failed:', err)
    return NextResponse.json(
      {
        error: {
          ar: 'فشل غير متوقّع أثناء الحفظ.',
          en: 'Unexpected save failure.',
        },
      },
      { status: 500 },
    )
  }
}
