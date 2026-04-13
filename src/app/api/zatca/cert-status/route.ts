/**
 * GET /api/zatca/cert-status?businessId=<uuid>
 *
 * Returns the active production-cert health for the requested business.
 * Auth + ownership: caller must be signed in and own the business
 * (via `businesses.user_id`).
 */

import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getActiveCertStatus } from '@/lib/zatca/cert-monitor'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const businessId = url.searchParams.get('businessId')?.trim()

  if (!businessId) {
    return NextResponse.json(
      { error: 'businessId query param is required' },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Ownership check.
  const { data: biz, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (bizError || !biz) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const status = await getActiveCertStatus(supabase, businessId)

  return NextResponse.json({
    status: status.status,
    daysUntilExpiry: status.daysUntilExpiry,
    expiresAt: status.cert?.expires_at ?? null,
  })
}
