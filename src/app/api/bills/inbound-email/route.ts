/**
 * /api/bills/inbound-email
 *
 * Webhook endpoint for email-to-bill ingestion. Accepts Postmark-shaped
 * inbound JSON. Mailgun/SendGrid callers should translate to Postmark
 * format at an upstream edge function (or a future adapter).
 *
 * Auth: `X-Inbound-Secret` header must match `process.env.INBOUND_EMAIL_SECRET`.
 *
 * Feature-flagged on both:
 *   - NEXT_PUBLIC_FEATURE_BILLS === 'true'
 *   - INBOUND_EMAIL_ENABLED === 'true'
 *
 * Flow per attachment (PDF/image only):
 *   1. Resolve target business from the `To` address.
 *   2. Upload attachment bytes to `documents` bucket under
 *      `bills/{businessId}/inbound/{timestamp}-{filename}`.
 *   3. Run OCR via `/api/analyze-bill` logic (best-effort; draft on failure).
 *   4. Insert a draft bill row + bill_attachments row.
 *   5. Create an in-app notification for the owner.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import {
  parseBusinessFromToAddress,
  extractPdfAttachments,
  deriveSlug,
  type InboundEmailPayload,
  type InboundAttachment,
} from '@/lib/bookkeeper/inbound-email-parser'
import type { BillExtractionResult } from '@/lib/bookkeeper/bill-extraction-types'

type ServiceClient = ReturnType<typeof createClient>

interface IngestResult {
  businessSlug: string
  attachmentsProcessed: number
  billsCreated: string[]
  skipped: string[]
}

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

function featureEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true' &&
    process.env.INBOUND_EMAIL_ENABLED === 'true'
  )
}

function serviceClient(): ServiceClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'attachment.bin'
}

/**
 * Finds a business whose name_en or name_ar slug-matches the inbound slug.
 * We do not yet have a dedicated `slug` column; when one is added, replace
 * this scan with an indexed lookup.
 */
async function resolveBusinessBySlug(
  supabase: ServiceClient,
  slug: string
): Promise<{ id: string; user_id: string; name_en: string | null; name_ar: string } | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, user_id, name_en, name_ar')
    .limit(1000)
  if (error || !data) return null
  const match = (data as Array<{ id: string; user_id: string; name_en: string | null; name_ar: string }>).find(
    (b) => deriveSlug(b.name_en) === slug || deriveSlug(b.name_ar) === slug
  )
  return match ?? null
}

async function uploadAttachment(
  supabase: ServiceClient,
  businessId: string,
  attachment: InboundAttachment
): Promise<{ storage_key: string; filename: string; mime_type: string } | null> {
  try {
    const buf = Buffer.from(attachment.Content, 'base64')
    if (buf.length === 0 || buf.length > 10 * 1024 * 1024) return null
    const safe = sanitizeFilename(attachment.Name)
    const storage_key = `bills/${businessId}/inbound/${Date.now()}-${safe}`
    const { error } = await supabase.storage.from('documents').upload(storage_key, buf, {
      contentType: attachment.ContentType.split(';')[0].trim(),
      upsert: false,
    })
    if (error) {
      console.warn('[inbound-email] upload failed:', error.message)
      return null
    }
    return { storage_key, filename: safe, mime_type: attachment.ContentType }
  } catch (err) {
    console.warn('[inbound-email] upload exception:', err)
    return null
  }
}

/**
 * Best-effort OCR. Calls the analyze-bill route internally via fetch.
 * Returns null on any failure — the caller falls back to a blank draft.
 */
async function tryExtract(
  base64: string,
  mediaType: string,
  businessId: string,
  origin: string,
  cookieHeader: string | null
): Promise<BillExtractionResult | null> {
  try {
    const res = await fetch(`${origin}/api/analyze-bill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ base64Data: base64, mediaType, businessId }),
    })
    if (!res.ok) return null
    return (await res.json()) as BillExtractionResult
  } catch {
    return null
  }
}

async function resolveVendor(
  supabase: ServiceClient,
  businessId: string,
  vendorName: string | null,
  vendorVat: string | null
): Promise<string | null> {
  const name = (vendorName ?? 'Unknown vendor (email ingest)').trim().slice(0, 200)
  // Try to reuse existing by name match.
  const { data: existing } = await supabase
    .from('vendors')
    .select('id')
    .eq('business_id', businessId)
    .eq('name', name)
    .maybeSingle()
  if (existing && (existing as { id: string }).id) return (existing as { id: string }).id

  const insert: Record<string, unknown> = {
    business_id: businessId,
    name,
  }
  if (vendorVat) insert.vat_number = vendorVat
  const { data: created, error } = await supabase
    .from('vendors')
    .insert(insert as never)
    .select('id')
    .single()
  if (error || !created) return null
  return (created as { id: string }).id
}

async function insertDraftBill(
  supabase: ServiceClient,
  businessId: string,
  vendorId: string,
  extraction: BillExtractionResult | null,
  uploaderId: string,
  storage: { storage_key: string; filename: string; mime_type: string }
): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10)
  const issue = extraction?.issue_date ?? today
  const due = extraction?.due_date ?? issue
  const subtotal = extraction?.subtotal ?? 0
  const vat = extraction?.vat_amount ?? 0
  const total = extraction?.total ?? subtotal + vat
  const vat_rate = extraction?.vat_rate ?? 15

  const billInsert = {
    business_id: businessId,
    vendor_id: vendorId,
    bill_number: extraction?.bill_number ?? null,
    issue_date: issue,
    due_date: due,
    subtotal,
    vat_amount: vat,
    vat_rate,
    total,
    currency: extraction?.currency ?? 'SAR',
    status: 'draft',
    notes: 'Ingested via email-to-bill',
    created_by: uploaderId,
  }

  const { data: bill, error } = await supabase
    .from('bills')
    .insert(billInsert as never)
    .select('id')
    .single()
  if (error || !bill) {
    console.error('[inbound-email] bill insert failed:', error)
    return null
  }
  const billId = (bill as { id: string }).id

  // line items — one per extracted row, or a single placeholder.
  const lineItems = extraction?.line_items?.length
    ? extraction.line_items.map((l, idx) => ({
        bill_id: billId,
        description: l.description,
        quantity: l.quantity ?? 1,
        unit_price: l.unit_price ?? 0,
        amount: l.amount ?? 0,
        category: l.category_hint ?? null,
        cost_center: null,
        line_order: idx,
      }))
    : [
        {
          bill_id: billId,
          description: 'Ingested attachment — review required',
          quantity: 1,
          unit_price: total,
          amount: total,
          category: null,
          cost_center: null,
          line_order: 0,
        },
      ]
  await supabase.from('bill_line_items').insert(lineItems as never)

  await supabase.from('bill_attachments').insert(
    {
      bill_id: billId,
      storage_key: storage.storage_key,
      filename: storage.filename,
      mime_type: storage.mime_type,
      uploaded_by: uploaderId,
    } as never
  )

  return billId
}

async function notifyOwner(
  supabase: ServiceClient,
  businessId: string,
  ownerId: string,
  billIds: string[],
  from: string | null
): Promise<void> {
  if (billIds.length === 0) return
  try {
    await supabase.from('in_app_notifications').insert(
      {
        business_id: businessId,
        user_id: ownerId,
        title: 'Bill received via email',
        body: `Ingested ${billIds.length} draft bill(s)${from ? ` from ${from}` : ''}. Review in the Bills inbox.`,
        action_url: '/bookkeeper/bills',
        action_label: 'Review bills',
        type: 'bookkeeper.bills.inbound',
      } as never
    )
  } catch (err) {
    console.warn('[inbound-email] notification insert failed:', err)
  }
}

export async function POST(request: Request) {
  if (!featureEnabled()) return notFound()

  const expected = process.env.INBOUND_EMAIL_SECRET
  const provided = request.headers.get('x-inbound-secret')
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: InboundEmailPayload
  try {
    payload = (await request.json()) as InboundEmailPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsedTo = parseBusinessFromToAddress(payload.To ?? null)
  if (!parsedTo) {
    return NextResponse.json(
      { error: 'Unrecognized To address', hint: 'Use bills+{slug}@mugdm.com or bills@{slug}.mugdm.com' },
      { status: 422 }
    )
  }

  const attachments = extractPdfAttachments(payload)
  if (attachments.length === 0) {
    return NextResponse.json(
      { ok: true, note: 'No bill-shaped attachments found', slug: parsedTo.slug },
      { status: 200 }
    )
  }

  const supabase = serviceClient()
  const business = await resolveBusinessBySlug(supabase, parsedTo.slug)
  if (!business) {
    return NextResponse.json(
      { error: 'Business not found for slug', slug: parsedTo.slug },
      { status: 404 }
    )
  }

  const origin = new URL(request.url).origin
  // Forward the inbound secret as a pseudo-cookie would not work — the
  // analyze-bill route requires an authenticated Supabase session that a
  // webhook does not have. TODO: refactor analyze-bill logic into a shared
  // module so we can call it without going through the HTTP layer.
  const cookieHeader = request.headers.get('cookie')

  const result: IngestResult = {
    businessSlug: parsedTo.slug,
    attachmentsProcessed: attachments.length,
    billsCreated: [],
    skipped: [],
  }

  for (const att of attachments) {
    const storage = await uploadAttachment(supabase, business.id, att)
    if (!storage) {
      result.skipped.push(att.Name)
      continue
    }
    const extraction = await tryExtract(
      att.Content,
      att.ContentType.split(';')[0].trim(),
      business.id,
      origin,
      cookieHeader
    )
    const vendorId = await resolveVendor(
      supabase,
      business.id,
      extraction?.vendor_name ?? (payload.FromName ?? null),
      extraction?.vendor_vat_number ?? null
    )
    if (!vendorId) {
      result.skipped.push(att.Name)
      continue
    }
    const billId = await insertDraftBill(
      supabase,
      business.id,
      vendorId,
      extraction,
      business.user_id,
      storage
    )
    if (billId) result.billsCreated.push(billId)
    else result.skipped.push(att.Name)
  }

  await notifyOwner(
    supabase,
    business.id,
    business.user_id,
    result.billsCreated,
    payload.From ?? null
  )

  return NextResponse.json({ ok: true, ...result }, { status: 200 })
}
