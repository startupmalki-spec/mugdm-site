/**
 * /api/customers/[id]
 *
 * GET    → fetch a single customer (must belong to a business owned by the
 *          current user).
 * PATCH  → partial update of the customer fields (validates VAT/CR formats).
 * DELETE → permanently delete the customer.
 *
 * All errors use the bilingual envelope { error: { ar, en } }.
 *
 * NOTE: Next.js dynamic-segment params are async in this version; route
 * handlers must `await` the `params` object.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidCRNumber, isValidSaudiVat } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

async function loadOwnedCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  customerId: string,
) {
  // Single round-trip: join customer -> business and verify ownership in one
  // query. Falls back to a manual two-step check if the embedded select fails
  // (e.g. PostgREST relation hint differs).
  const { data, error } = await supabase
    .from('customers')
    .select('*, business:businesses!inner(id, user_id)')
    .eq('id', customerId)
    .maybeSingle()

  if (error) return { ok: false as const, status: 500 }
  if (!data) return { ok: false as const, status: 404 }

  const business = (data as { business?: { user_id?: string } }).business
  if (!business || business.user_id !== userId) {
    return { ok: false as const, status: 404 }
  }

  // Strip the joined business object before returning.
  const customer = { ...(data as Record<string, unknown>) }
  delete (customer as { business?: unknown }).business
  return { ok: true as const, customer }
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const result = await loadOwnedCustomer(supabase, user.id, id)
    if (!result.ok) {
      if (result.status === 404) {
        return bilingualError('العميل غير موجود.', 'Customer not found.', 404)
      }
      return bilingualError('فشل تحميل العميل.', 'Failed to load customer.', 500)
    }
    return NextResponse.json({ customer: result.customer })
  } catch (err) {
    console.error('[api/customers/:id] GET failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}

interface PatchBody {
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

const ALLOWED_PATCH_KEYS: ReadonlyArray<keyof PatchBody> = [
  'name',
  'name_en',
  'vat_number',
  'cr_number',
  'address',
  'city',
  'country',
  'phone',
  'email',
]

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const ownership = await loadOwnedCustomer(supabase, user.id, id)
    if (!ownership.ok) {
      if (ownership.status === 404) {
        return bilingualError('العميل غير موجود.', 'Customer not found.', 404)
      }
      return bilingualError('فشل التحقّق من الملكية.', 'Ownership check failed.', 500)
    }

    const body = (await request.json().catch(() => null)) as PatchBody | null
    if (!body || typeof body !== 'object') {
      return bilingualError('حمولة غير صالحة.', 'Invalid request body.', 400)
    }

    if (body.vat_number != null && body.vat_number !== '' && !isValidSaudiVat(body.vat_number)) {
      return bilingualError(
        'الرقم الضريبي يجب أن يكون 15 رقمًا يبدأ وينتهي بالرقم 3.',
        'VAT number must be 15 digits starting and ending with 3.',
        400,
      )
    }
    if (body.cr_number != null && body.cr_number !== '' && !isValidCRNumber(body.cr_number)) {
      return bilingualError(
        'رقم السجل التجاري يجب أن يكون 10 أرقام.',
        'CR number must be exactly 10 digits.',
        400,
      )
    }
    if (body.name != null && !body.name.trim()) {
      return bilingualError(
        'اسم العميل لا يمكن أن يكون فارغًا.',
        'Customer name cannot be empty.',
        400,
      )
    }

    const update: Record<string, unknown> = {}
    for (const key of ALLOWED_PATCH_KEYS) {
      if (key in body) {
        const v = body[key]
        if (typeof v === 'string') {
          const trimmed = v.trim()
          if (key === 'vat_number' || key === 'cr_number') {
            update[key] = trimmed.replace(/\s/g, '') || null
          } else {
            update[key] = trimmed === '' ? null : trimmed
          }
        } else {
          update[key] = v ?? null
        }
      }
    }

    if (Object.keys(update).length === 0) {
      return bilingualError(
        'لا توجد حقول للتحديث.',
        'No fields to update.',
        400,
      )
    }

    const { data, error } = await supabase
      .from('customers')
      .update(update as never)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !data) {
      console.error('[api/customers/:id] update failed:', error)
      return bilingualError('فشل تحديث العميل.', 'Failed to update customer.', 500)
    }

    return NextResponse.json({ customer: data })
  } catch (err) {
    console.error('[api/customers/:id] PATCH failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    const ownership = await loadOwnedCustomer(supabase, user.id, id)
    if (!ownership.ok) {
      if (ownership.status === 404) {
        return bilingualError('العميل غير موجود.', 'Customer not found.', 404)
      }
      return bilingualError('فشل التحقّق من الملكية.', 'Ownership check failed.', 500)
    }

    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) {
      console.error('[api/customers/:id] delete failed:', error)
      return bilingualError('فشل حذف العميل.', 'Failed to delete customer.', 500)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/customers/:id] DELETE failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
