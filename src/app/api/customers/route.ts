/**
 * /api/customers
 *
 * GET  ?businessId=&q=&page=&pageSize=20  → paginated list of customers.
 *   - q matches name | name_en | vat_number | cr_number (case-insensitive).
 * POST { businessId, name, name_en?, vat_number?, cr_number?, address?,
 *        city?, country?, phone?, email? } → create customer.
 *
 * All requests require an authenticated session AND that the supplied
 * businessId belongs to the current user (RLS-equivalent check at the
 * application layer).
 *
 * Errors are returned as a bilingual envelope { error: { ar, en } }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidCRNumber, isValidSaudiVat } from '@/lib/validations'

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

    const q = (searchParams.get('q') ?? '').trim()
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)) ||
          DEFAULT_PAGE_SIZE,
      ),
    )

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (q.length > 0) {
      // Escape % and , which have special meaning in PostgREST `or` filters.
      const safe = q.replace(/[,()]/g, ' ').replace(/%/g, '\\%')
      const term = `%${safe}%`
      query = query.or(
        `name.ilike.${term},name_en.ilike.${term},vat_number.ilike.${term},cr_number.ilike.${term}`,
      )
    }

    const { data, error, count } = await query
    if (error) {
      console.error('[api/customers] list failed:', error)
      return bilingualError('فشل تحميل العملاء.', 'Failed to load customers.', 500)
    }

    return NextResponse.json({
      customers: data ?? [],
      page,
      pageSize,
      total: count ?? 0,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
    })
  } catch (err) {
    console.error('[api/customers] GET failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}

interface CreateBody {
  businessId?: string
  name?: string
  name_en?: string | null
  vat_number?: string | null
  cr_number?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
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
    if (!body || !body.businessId || !body.name?.trim()) {
      return bilingualError(
        'معرّف النشاط التجاري واسم العميل مطلوبان.',
        'businessId and name are required.',
        400,
      )
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

    if (body.vat_number && !isValidSaudiVat(body.vat_number)) {
      return bilingualError(
        'الرقم الضريبي يجب أن يكون 15 رقمًا يبدأ وينتهي بالرقم 3.',
        'VAT number must be 15 digits starting and ending with 3.',
        400,
      )
    }
    if (body.cr_number && !isValidCRNumber(body.cr_number)) {
      return bilingualError(
        'رقم السجل التجاري يجب أن يكون 10 أرقام.',
        'CR number must be exactly 10 digits.',
        400,
      )
    }

    const insertRow = {
      business_id: body.businessId,
      name: body.name.trim(),
      name_en: body.name_en?.trim() || null,
      vat_number: body.vat_number?.replace(/\s/g, '') || null,
      cr_number: body.cr_number?.replace(/\s/g, '') || null,
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      country: body.country?.trim() || 'SA',
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
    }

    const { data, error } = await supabase
      .from('customers')
      .insert(insertRow as never)
      .select('*')
      .single()

    if (error || !data) {
      console.error('[api/customers] insert failed:', error)
      return bilingualError(
        'فشل إنشاء العميل.',
        'Failed to create customer.',
        500,
      )
    }

    return NextResponse.json({ customer: data }, { status: 201 })
  } catch (err) {
    console.error('[api/customers] POST failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
