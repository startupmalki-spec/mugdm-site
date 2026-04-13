/**
 * /api/invoicing/invoices
 *
 * POST — Create a new draft invoice plus its line items in a single logical
 *        operation. Uses sequential inserts with manual rollback on line-item
 *        failure, mirroring `src/app/api/invoicing/import/save/route.ts`.
 *
 *        Auto-numbering: for MVP we allocate `INV-YYYY-####` where YYYY is the
 *        issue year and #### is `MAX(existing) + 1` per (business_id, year).
 *        A real sequence table is a follow-up.
 *
 *        `zatca_uuid` decision: we generate the UUID at CREATE time and persist
 *        it on the draft row, so the same UUID is used if the user saves,
 *        previews, then later submits to ZATCA. This keeps the chain anchor
 *        stable and gives the UI a permanent identifier even before clearance.
 *
 * GET  — Paginated list of invoices for a business (used by task 60). Supports
 *        `businessId`, `page`, `pageSize`, and `status` filters.
 *
 * Body for POST:
 *   {
 *     businessId: string,
 *     invoice: {
 *       customer_id?: string | null,
 *       invoice_subtype?: 'invoice' | 'credit_note' | 'debit_note',
 *       language?: 'ar' | 'en' | 'both',
 *       issue_date: string (YYYY-MM-DD),
 *       supply_date?: string | null,
 *       due_date?: string | null,
 *       payment_terms?: string | null,
 *       notes?: string | null,
 *     },
 *     lineItems: Array<{
 *       line_number: number,
 *       description: string,
 *       quantity: number,
 *       unit_price: number,
 *       discount_amount?: number | null,
 *       vat_rate: number,
 *     }>
 *   }
 *
 * All errors use the bilingual { error: { ar, en } } envelope.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

import { createClient } from '@/lib/supabase/server'
import {
  calculateInvoiceTotals,
  calculateLine,
} from '@/lib/invoicing/calculations'
import type {
  InvoiceLanguage,
  InvoiceSubtype,
  InvoiceType,
  ZatcaStatus,
} from '@/lib/supabase/types'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

async function requireBusinessOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  businessId: string,
) {
  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { ok: false as const, status: 500 }
  if (!data) return { ok: false as const, status: 403 }
  return { ok: true as const }
}

/**
 * Compute the next invoice number for a (business_id, year) pair using a
 * simple `MAX()` scan. Acceptable for MVP; replace with a dedicated sequence
 * or PostgreSQL advisory-lock helper before high-volume usage.
 */
async function nextInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  year: number,
): Promise<string> {
  const prefix = `INV-${year}-`
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('business_id', businessId)
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // Non-fatal: fall back to 0001 — the DB unique constraint will catch
    // collisions if the query is genuinely racy.
    console.error('[api/invoicing/invoices] nextInvoiceNumber failed:', error)
  }

  let nextSeq = 1
  if (data?.invoice_number) {
    const tail = String(data.invoice_number).slice(prefix.length)
    const n = Number.parseInt(tail, 10)
    if (Number.isFinite(n) && n > 0) nextSeq = n + 1
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}

interface LineItemBody {
  line_number?: number
  description?: string
  quantity?: number
  unit_price?: number
  discount_amount?: number | null
  vat_rate?: number
}

interface CreateBody {
  businessId?: string
  invoice?: {
    customer_id?: string | null
    invoice_type?: InvoiceType
    invoice_subtype?: InvoiceSubtype
    language?: InvoiceLanguage
    issue_date?: string
    supply_date?: string | null
    due_date?: string | null
    payment_terms?: string | null
    notes?: string | null
  }
  lineItems?: LineItemBody[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const body = (await request.json().catch(() => null)) as CreateBody | null
    if (!body?.businessId || !body.invoice || !Array.isArray(body.lineItems)) {
      return bilingualError('حمولة غير صالحة.', 'Invalid request body.', 400)
    }

    const ownership = await requireBusinessOwnership(
      supabase,
      user.id,
      body.businessId,
    )
    if (!ownership.ok) {
      return bilingualError(
        'النشاط التجاري غير موجود أو لا يخصّك.',
        'Business not found or not owned by current user.',
        ownership.status,
      )
    }

    const issueDate = body.invoice.issue_date
    if (!issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
      return bilingualError(
        'تاريخ الإصدار مطلوب بصيغة YYYY-MM-DD.',
        'issue_date is required (YYYY-MM-DD).',
        400,
      )
    }
    if (body.lineItems.length === 0) {
      return bilingualError(
        'أضف بندًا واحدًا على الأقل.',
        'At least one line item is required.',
        400,
      )
    }

    // Normalize + compute monetary fields from canonical formulas.
    const normalizedLines = body.lineItems.map((li, idx) => {
      const r = calculateLine({
        quantity: li.quantity,
        unit_price: li.unit_price,
        discount_amount: li.discount_amount,
        vat_rate: li.vat_rate,
      })
      return {
        line_number: Number.isFinite(li.line_number) ? Number(li.line_number) : idx + 1,
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
        _lineExtension: r.lineExtension,
      }
    })

    for (const l of normalizedLines) {
      if (!l.description) {
        return bilingualError(
          'وصف البند مطلوب.',
          'Line description is required.',
          400,
        )
      }
      if (!(l.quantity > 0) || !(l.unit_price >= 0)) {
        return bilingualError(
          'الكمية يجب أن تكون أكبر من صفر وسعر الوحدة غير سالب.',
          'Quantity must be positive and unit price non-negative.',
          400,
        )
      }
    }

    const totals = calculateInvoiceTotals(
      normalizedLines.map((l) => ({
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_amount: l.discount_amount,
        vat_rate: l.vat_rate,
      })),
    )

    const year = Number.parseInt(issueDate.slice(0, 4), 10) || new Date().getFullYear()
    const invoiceNumber = await nextInvoiceNumber(
      supabase,
      body.businessId,
      year,
    )

    const invoiceType: InvoiceType =
      body.invoice.invoice_type === 'simplified' ? 'simplified' : 'standard'

    // B2C simplified invoices may omit customer_id (walk-in customer).
    // B2B standard invoices still require a customer for clearance.
    const customerId =
      invoiceType === 'simplified'
        ? (body.invoice.customer_id ?? null)
        : (body.invoice.customer_id ?? null)

    const invoiceRow = {
      business_id: body.businessId,
      customer_id: customerId,
      invoice_number: invoiceNumber,
      invoice_type: invoiceType,
      invoice_subtype: (body.invoice.invoice_subtype ?? 'invoice') as InvoiceSubtype,
      source: 'mugdm' as const,
      language: (body.invoice.language ?? 'both') as InvoiceLanguage,
      issue_date: issueDate,
      supply_date: body.invoice.supply_date ?? null,
      due_date: body.invoice.due_date ?? null,
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
      linked_invoice_id: null,
      linked_transaction_id: null,
      notes: body.invoice.notes ?? null,
      payment_terms: body.invoice.payment_terms ?? null,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('invoices')
      .insert(invoiceRow as never)
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('[api/invoicing/invoices] insert failed:', insertError)
      return bilingualError(
        'فشل إنشاء الفاتورة.',
        'Failed to create invoice.',
        500,
      )
    }

    const invoiceId = (inserted as { id: string }).id

    const lineRows = normalizedLines.map((l) => ({
      invoice_id: invoiceId,
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
      console.error('[api/invoicing/invoices] line item insert failed:', lineError)
      // Best-effort rollback.
      await supabase.from('invoices').delete().eq('id', invoiceId)
      return bilingualError(
        'فشل حفظ بنود الفاتورة.',
        'Failed to save invoice line items.',
        500,
      )
    }

    return NextResponse.json(
      { invoiceId, invoiceNumber },
      { status: 201 },
    )
  } catch (err) {
    console.error('[api/invoicing/invoices] POST failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    if (!businessId) {
      return bilingualError(
        'معرّف النشاط التجاري مطلوب.',
        'businessId is required.',
        400,
      )
    }

    const ownership = await requireBusinessOwnership(supabase, user.id, businessId)
    if (!ownership.ok) {
      return bilingualError(
        'النشاط التجاري غير موجود أو لا يخصّك.',
        'Business not found or not owned by current user.',
        ownership.status,
      )
    }

    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)) ||
          DEFAULT_PAGE_SIZE,
      ),
    )

    // New filter params (task 60). All optional, backward-compatible.
    // - status: single value OR CSV of ZatcaStatus (e.g. "draft,cleared")
    // - invoice_type: 'standard' | 'simplified'
    // - q: ILIKE search on invoice_number
    // - from / to: ISO date bounds (inclusive) on issue_date
    // - include=customer: join the linked customer row for list display
    const statusRaw = searchParams.get('status')
    const invoiceType = searchParams.get('invoice_type')
    const q = (searchParams.get('q') ?? '').trim()
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')
    const include = (searchParams.get('include') ?? '').split(',').map((s) => s.trim())
    const includeCustomer = include.includes('customer')

    const fromIdx = (page - 1) * pageSize
    const toIdx = fromIdx + pageSize - 1

    // Use a PostgREST embed to pull the customer row in a single round trip.
    const selectExpr = includeCustomer
      ? '*, customer:customers(id,name,name_en,vat_number)'
      : '*'

    let query = supabase
      .from('invoices')
      .select(selectExpr, { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx)

    if (statusRaw) {
      const statuses = statusRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as ZatcaStatus[]
      if (statuses.length === 1) {
        query = query.eq('zatca_status', statuses[0])
      } else if (statuses.length > 1) {
        query = query.in('zatca_status', statuses)
      }
    }

    if (invoiceType === 'standard' || invoiceType === 'simplified') {
      query = query.eq('invoice_type', invoiceType)
    }

    if (q) {
      // PostgREST ilike: escape % and _ to avoid pattern injection from input.
      const escaped = q.replace(/[%_]/g, (ch) => `\\${ch}`)
      query = query.ilike('invoice_number', `%${escaped}%`)
    }

    if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      query = query.gte('issue_date', dateFrom)
    }
    if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      query = query.lte('issue_date', dateTo)
    }

    const { data, error, count } = await query
    if (error) {
      console.error('[api/invoicing/invoices] list failed:', error)
      return bilingualError(
        'فشل تحميل الفواتير.',
        'Failed to load invoices.',
        500,
      )
    }

    return NextResponse.json({
      invoices: data ?? [],
      page,
      pageSize,
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
    })
  } catch (err) {
    console.error('[api/invoicing/invoices] GET failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
