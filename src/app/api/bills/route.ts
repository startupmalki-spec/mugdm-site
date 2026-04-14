/**
 * /api/bills
 *
 * Feature-flagged on NEXT_PUBLIC_FEATURE_BILLS. 404 when off.
 *
 * POST { businessId, vendor_id, bill_number?, issue_date, due_date,
 *        subtotal, vat_amount, vat_rate, total, currency?, notes?,
 *        line_items: [{ description, quantity, unit_price, amount,
 *                        category?, cost_center? }],
 *        attachments?: [{ storage_key, filename, mime_type? }],
 *        submit?: boolean }
 *   → creates a bill. submit=true transitions status from 'draft' to
 *     'pending' (submit for approval). Otherwise left as 'draft'.
 *
 * Writes are performed with RLS under the caller's session. Line items and
 * attachments are inserted after the bill row; on any error we roll back by
 * deleting the parent bill so we never leave orphaned rows.
 *
 * The approval agent owns /api/bills/[id]/** for approve / pay / void /
 * edit. That agent should expect bills created here to have:
 *   - status in ('draft' | 'pending')
 *   - workflow_state = {}
 *   - created_by = auth.uid()
 *   - approved_by / approved_at / paid_at = null
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FEATURE_ENABLED = () => process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const AMOUNT_TOLERANCE = 0.02

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

async function requireBusinessOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  businessId: string,
): Promise<{ ok: true } | { ok: false; status: number }> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { ok: false, status: 500 }
  if (!data) return { ok: false, status: 403 }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Payload validation (hand-rolled; project has no direct zod dep).
// ---------------------------------------------------------------------------

interface LineItemInput {
  description?: unknown
  quantity?: unknown
  unit_price?: unknown
  amount?: unknown
  category?: unknown
  cost_center?: unknown
}

interface AttachmentInput {
  storage_key?: unknown
  filename?: unknown
  mime_type?: unknown
}

interface CreateBillBody {
  businessId?: unknown
  vendor_id?: unknown
  bill_number?: unknown
  issue_date?: unknown
  due_date?: unknown
  subtotal?: unknown
  vat_amount?: unknown
  vat_rate?: unknown
  total?: unknown
  currency?: unknown
  notes?: unknown
  line_items?: unknown
  attachments?: unknown
  submit?: unknown
}

type ValidatedLineItem = {
  description: string
  quantity: number
  unit_price: number
  amount: number
  category: string | null
  cost_center: string | null
}

type ValidatedAttachment = {
  storage_key: string
  filename: string
  mime_type: string | null
}

type ValidatedBill = {
  businessId: string
  vendor_id: string
  bill_number: string | null
  issue_date: string
  due_date: string
  subtotal: number
  vat_amount: number
  vat_rate: number
  total: number
  currency: string
  notes: string | null
  line_items: ValidatedLineItem[]
  attachments: ValidatedAttachment[]
  submit: boolean
}

function str(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function validate(body: CreateBillBody):
  | { ok: true; value: ValidatedBill }
  | { ok: false; ar: string; en: string } {
  const businessId = str(body.businessId)
  if (!businessId) return { ok: false, ar: 'معرّف النشاط التجاري مطلوب.', en: 'businessId is required.' }

  const vendor_id = str(body.vendor_id)
  if (!vendor_id) return { ok: false, ar: 'المورّد مطلوب.', en: 'vendor_id is required.' }

  const issue_date = str(body.issue_date, 10)
  const due_date = str(body.due_date, 10)
  if (!issue_date || !ISO_DATE_RE.test(issue_date)) {
    return { ok: false, ar: 'تاريخ الإصدار غير صالح.', en: 'Valid issue_date (YYYY-MM-DD) is required.' }
  }
  if (!due_date || !ISO_DATE_RE.test(due_date)) {
    return { ok: false, ar: 'تاريخ الاستحقاق غير صالح.', en: 'Valid due_date (YYYY-MM-DD) is required.' }
  }
  if (due_date < issue_date) {
    return {
      ok: false,
      ar: 'تاريخ الاستحقاق يجب أن يكون بعد تاريخ الإصدار أو مساوياً له.',
      en: 'due_date must be on or after issue_date.',
    }
  }

  const subtotal = num(body.subtotal) ?? 0
  const vat_amount = num(body.vat_amount) ?? 0
  const vat_rate = num(body.vat_rate) ?? 15
  const total = num(body.total)
  if (total === null || total <= 0) {
    return { ok: false, ar: 'المبلغ الإجمالي يجب أن يكون أكبر من صفر.', en: 'total must be greater than 0.' }
  }
  if (subtotal < 0 || vat_amount < 0 || vat_rate < 0) {
    return { ok: false, ar: 'القيم المالية يجب أن تكون موجبة.', en: 'Monetary fields must be non-negative.' }
  }

  if (Math.abs(subtotal + vat_amount - total) > AMOUNT_TOLERANCE) {
    return {
      ok: false,
      ar: 'الإجمالي لا يطابق المجموع الفرعي + ضريبة القيمة المضافة.',
      en: 'total must equal subtotal + vat_amount (within 0.02 SAR).',
    }
  }

  const rawLines = Array.isArray(body.line_items) ? (body.line_items as LineItemInput[]) : []
  if (rawLines.length === 0) {
    return { ok: false, ar: 'يجب إضافة بند واحد على الأقل.', en: 'At least one line item is required.' }
  }
  const line_items: ValidatedLineItem[] = []
  for (const l of rawLines) {
    if (!l || typeof l !== 'object') continue
    const description = str(l.description, 500)
    if (!description) {
      return { ok: false, ar: 'كل بند يجب أن يحتوي على وصف.', en: 'Each line item requires a description.' }
    }
    const quantity = num(l.quantity) ?? 1
    const unit_price = num(l.unit_price) ?? 0
    const amount = num(l.amount) ?? quantity * unit_price
    if (quantity <= 0) {
      return { ok: false, ar: 'الكمية يجب أن تكون أكبر من صفر.', en: 'quantity must be greater than 0.' }
    }
    if (amount < 0) {
      return { ok: false, ar: 'قيمة البند يجب أن تكون موجبة.', en: 'line amount must be non-negative.' }
    }
    line_items.push({
      description,
      quantity,
      unit_price,
      amount,
      category: str(l.category, 100),
      cost_center: str(l.cost_center, 100),
    })
  }

  const rawAttachments = Array.isArray(body.attachments) ? (body.attachments as AttachmentInput[]) : []
  const attachments: ValidatedAttachment[] = []
  for (const a of rawAttachments) {
    if (!a || typeof a !== 'object') continue
    const storage_key = str(a.storage_key, 500)
    const filename = str(a.filename, 255)
    if (!storage_key || !filename) continue
    attachments.push({
      storage_key,
      filename,
      mime_type: str(a.mime_type, 100),
    })
  }

  return {
    ok: true,
    value: {
      businessId,
      vendor_id,
      bill_number: str(body.bill_number, 100),
      issue_date,
      due_date,
      subtotal,
      vat_amount,
      vat_rate,
      total,
      currency: (str(body.currency, 10) ?? 'SAR').toUpperCase(),
      notes: str(body.notes, 2000),
      line_items,
      attachments,
      submit: body.submit === true,
    },
  }
}

// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!FEATURE_ENABLED()) return notFound()

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const raw = (await request.json().catch(() => null)) as CreateBillBody | null
    if (!raw || typeof raw !== 'object') {
      return bilingualError('جسم الطلب غير صالح.', 'Invalid request body.', 400)
    }

    const parsed = validate(raw)
    if (!parsed.ok) return bilingualError(parsed.ar, parsed.en, 400)
    const v = parsed.value

    const ownership = await requireBusinessOwnership(supabase, user.id, v.businessId)
    if (!ownership.ok) {
      return bilingualError(
        'النشاط التجاري غير موجود أو لا يخصّك.',
        'Business not found or not owned by current user.',
        ownership.status,
      )
    }

    // Vendor must belong to the same business.
    const { data: vendor, error: vendorErr } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', v.vendor_id)
      .eq('business_id', v.businessId)
      .maybeSingle()
    if (vendorErr || !vendor) {
      return bilingualError('المورّد غير موجود.', 'Vendor not found for this business.', 400)
    }

    const initialStatus: 'draft' | 'pending' = v.submit ? 'pending' : 'draft'

    const billInsert = {
      business_id: v.businessId,
      vendor_id: v.vendor_id,
      bill_number: v.bill_number,
      issue_date: v.issue_date,
      due_date: v.due_date,
      subtotal: v.subtotal,
      vat_amount: v.vat_amount,
      vat_rate: v.vat_rate,
      total: v.total,
      currency: v.currency,
      status: initialStatus,
      notes: v.notes,
      created_by: user.id,
    }

    const { data: billRow, error: billErr } = await supabase
      .from('bills')
      .insert(billInsert as never)
      .select('*')
      .single()

    if (billErr || !billRow) {
      console.error('[api/bills] bill insert failed:', billErr)
      return bilingualError('فشل إنشاء الفاتورة.', 'Failed to create bill.', 500)
    }

    const billId = (billRow as { id: string }).id

    // Insert line items with explicit ordering.
    const lineRows = v.line_items.map((l, idx) => ({
      bill_id: billId,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      amount: l.amount,
      category: l.category,
      cost_center: l.cost_center,
      line_order: idx,
    }))
    const { error: linesErr } = await supabase.from('bill_line_items').insert(lineRows as never)
    if (linesErr) {
      console.error('[api/bills] line items insert failed:', linesErr)
      await supabase.from('bills').delete().eq('id', billId)
      return bilingualError('فشل حفظ بنود الفاتورة.', 'Failed to save line items.', 500)
    }

    if (v.attachments.length > 0) {
      const attachmentRows = v.attachments.map((a) => ({
        bill_id: billId,
        storage_key: a.storage_key,
        filename: a.filename,
        mime_type: a.mime_type,
        uploaded_by: user.id,
      }))
      const { error: attErr } = await supabase
        .from('bill_attachments')
        .insert(attachmentRows as never)
      if (attErr) {
        console.error('[api/bills] attachments insert failed:', attErr)
        await supabase.from('bills').delete().eq('id', billId)
        return bilingualError('فشل حفظ المرفقات.', 'Failed to save attachments.', 500)
      }
    }

    return NextResponse.json(
      { bill: billRow, status: initialStatus },
      { status: 201 },
    )
  } catch (err) {
    console.error('[api/bills] POST failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
