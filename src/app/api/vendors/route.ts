/**
 * /api/vendors
 *
 * Feature-flagged on NEXT_PUBLIC_FEATURE_BILLS. 404 when off.
 *
 * GET  ?businessId=&q=&limit=20 → search vendors for the given business.
 *   - q matches name_ar | name_en | vat_number (case-insensitive).
 * POST { businessId, name_ar?, name_en?, vat_number?, iban?, email?, phone?,
 *        default_category?, notes? } → create vendor. At least one of
 *        name_ar / name_en is required.
 *
 * Auth: requires a session AND businessId belonging to the current user.
 * Errors: bilingual envelope { error: { ar, en } }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidSaudiVat } from '@/lib/validations'
import type { Vendor } from '@/lib/supabase/types'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

const FEATURE_ENABLED = () => process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'

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
// Hand-rolled payload validation (project has no direct zod dep).
// ---------------------------------------------------------------------------

interface CreateVendorBody {
  businessId?: unknown
  name_ar?: unknown
  name_en?: unknown
  vat_number?: unknown
  iban?: unknown
  email?: unknown
  phone?: unknown
  default_category?: unknown
  notes?: unknown
}

function strOrNull(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t) return null
  return t.slice(0, max)
}

function validateCreatePayload(body: CreateVendorBody):
  | { ok: true; value: {
      businessId: string
      name_ar: string | null
      name_en: string | null
      vat_number: string | null
      iban: string | null
      email: string | null
      phone: string | null
      default_category: string | null
      notes: string | null
    } }
  | { ok: false; ar: string; en: string } {
  const businessId = strOrNull(body.businessId)
  if (!businessId) return { ok: false, ar: 'معرّف النشاط التجاري مطلوب.', en: 'businessId is required.' }

  const name_ar = strOrNull(body.name_ar, 200)
  const name_en = strOrNull(body.name_en, 200)
  if (!name_ar && !name_en) {
    return { ok: false, ar: 'اسم المورّد مطلوب.', en: 'Vendor name (AR or EN) is required.' }
  }

  const vat = strOrNull(body.vat_number, 20)?.replace(/\s/g, '') ?? null
  if (vat && !isValidSaudiVat(vat)) {
    return {
      ok: false,
      ar: 'الرقم الضريبي يجب أن يكون 15 رقمًا يبدأ وينتهي بالرقم 3.',
      en: 'VAT number must be 15 digits starting and ending with 3.',
    }
  }

  const email = strOrNull(body.email, 200)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, ar: 'بريد إلكتروني غير صالح.', en: 'Invalid email.' }
  }

  return {
    ok: true,
    value: {
      businessId,
      name_ar,
      name_en,
      vat_number: vat,
      iban: strOrNull(body.iban, 50),
      email,
      phone: strOrNull(body.phone, 50),
      default_category: strOrNull(body.default_category, 100),
      notes: strOrNull(body.notes, 2000),
    },
  }
}

// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    if (!businessId) {
      return bilingualError('معرّف النشاط التجاري مطلوب.', 'businessId is required.', 400)
    }

    const ownership = await requireBusinessOwnership(supabase, user.id, businessId)
    if (!ownership.ok) {
      return bilingualError(
        'النشاط التجاري غير موجود أو لا يخصّك.',
        'Business not found or not owned by current user.',
        ownership.status,
      )
    }

    const q = (searchParams.get('q') ?? '').trim()
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(searchParams.get('limit') ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT),
    )

    let query = supabase
      .from('vendors')
      .select('id,business_id,name_ar,name_en,vat_number,iban,email,phone,default_category,notes,created_at,updated_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (q.length > 0) {
      const safe = q.replace(/[,()]/g, ' ').replace(/%/g, '\\%')
      const term = `%${safe}%`
      query = query.or(`name_ar.ilike.${term},name_en.ilike.${term},vat_number.ilike.${term}`)
    }

    const { data, error } = await query
    if (error) {
      console.error('[api/vendors] list failed:', error)
      return bilingualError('فشل تحميل المورّدين.', 'Failed to load vendors.', 500)
    }

    return NextResponse.json({ vendors: (data ?? []) as Vendor[] })
  } catch (err) {
    console.error('[api/vendors] GET failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}

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

    const raw = (await request.json().catch(() => null)) as CreateVendorBody | null
    if (!raw || typeof raw !== 'object') {
      return bilingualError('جسم الطلب غير صالح.', 'Invalid request body.', 400)
    }

    const parsed = validateCreatePayload(raw)
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

    // Best-effort de-dupe by VAT number (unique index already enforces this).
    if (v.vat_number) {
      const { data: existing } = await supabase
        .from('vendors')
        .select('id,business_id,name_ar,name_en,vat_number,iban,email,phone,default_category,notes,created_at,updated_at')
        .eq('business_id', v.businessId)
        .eq('vat_number', v.vat_number)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ vendor: existing as Vendor, deduped: true }, { status: 200 })
      }
    }

    const insertRow = {
      business_id: v.businessId,
      name_ar: v.name_ar,
      name_en: v.name_en,
      vat_number: v.vat_number,
      iban: v.iban,
      email: v.email,
      phone: v.phone,
      default_category: v.default_category,
      notes: v.notes,
    }

    const { data, error } = await supabase
      .from('vendors')
      .insert(insertRow as never)
      .select('*')
      .single()

    if (error || !data) {
      console.error('[api/vendors] insert failed:', error)
      return bilingualError('فشل إنشاء المورّد.', 'Failed to create vendor.', 500)
    }

    return NextResponse.json({ vendor: data as Vendor }, { status: 201 })
  } catch (err) {
    console.error('[api/vendors] POST failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
