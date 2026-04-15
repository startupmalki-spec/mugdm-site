/**
 * POST /api/wathq/lookup
 *
 * Body: { cr_number: string }
 * Returns: { ok: true, source: 'wathq_api', wizard, customer, status, vat_number }
 *      or: { ok: false, code, message } with appropriate HTTP status.
 *
 * - Requires an authenticated Supabase session.
 * - Rate-limited to 10 lookups per user per 24h.
 * - Gracefully degrades when WATHQ_API_KEY is unset (returns 503 with code
 *   NOT_CONFIGURED so callers can fall back).
 */

import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { isValidCRNumber } from '@/lib/validations'
import {
  isWathqConfigured,
  lookupCR,
  WathqError,
  type WathqErrorCode,
} from '@/lib/wathq/client'
import {
  checkWathqRateLimit,
  recordWathqLookup,
} from '@/lib/wathq/rate-limit'

const STATUS_BY_CODE: Record<WathqErrorCode, number> = {
  NOT_CONFIGURED: 503,
  INVALID_CR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 502,
  SUBSCRIPTION_DENIED: 503,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  TIMEOUT: 504,
  NETWORK_ERROR: 502,
}

const FRIENDLY_MESSAGE_BY_CODE: Partial<Record<WathqErrorCode, string>> = {
  SUBSCRIPTION_DENIED:
    'Your Wathq subscription does not grant access to this CR. This is expected on a Trial subscription with real CRs. Upload the CR document to continue.',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: 'Sign in required' },
      { status: 401 }
    )
  }

  let body: { cr_number?: unknown }
  try {
    body = (await request.json()) as { cr_number?: unknown }
  } catch {
    return NextResponse.json(
      { ok: false, code: 'BAD_JSON', message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const crRaw = typeof body.cr_number === 'string' ? body.cr_number : ''
  const crDigits = crRaw.replace(/\s/g, '')
  if (!isValidCRNumber(crDigits)) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_CR', message: 'CR number must be 10 digits' },
      { status: 400 }
    )
  }

  if (!isWathqConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: 'NOT_CONFIGURED',
        message: 'Wathq lookup is not available right now.',
      },
      { status: 503 }
    )
  }

  // Rate limit check (10/user/24h).
  const rate = await checkWathqRateLimit(user.id)
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: 'RATE_LIMITED',
        message: `Daily Wathq lookup limit reached (${rate.limit}/day).`,
        limit: rate.limit,
        remaining: 0,
      },
      { status: 429 }
    )
  }

  try {
    const result = await lookupCR(crDigits)
    await recordWathqLookup(user.id, crDigits, true).catch(() => {})

    // Map to the onboarding WizardData shape (camelCase fields).
    const wizard = {
      crNumber: result.data.cr_number ?? crDigits,
      nameAr: result.data.name_ar ?? '',
      nameEn: result.data.name_en ?? '',
      activityType: result.data.activity_type ?? '',
      city: result.data.city ?? '',
      capital: result.data.capital ?? '',
      crIssuanceDate: result.data.cr_issuance_date ?? '',
      crExpiryDate: result.data.cr_expiry_date ?? '',
      owners: result.data.owners.map((o) => ({
        name: o.name,
        nationality: '',
        share: o.share,
      })),
    }

    // Map to the ZATCA customer form shape (snake_case fields).
    const customer = {
      name: result.data.name_ar ?? '',
      name_en: result.data.name_en ?? '',
      cr_number: result.data.cr_number ?? crDigits,
      vat_number: result.vatNumber ?? '',
      city: result.data.city ?? '',
    }

    return NextResponse.json({
      ok: true,
      source: 'wathq_api' as const,
      status: result.status,
      vat_number: result.vatNumber,
      wizard,
      customer,
      data: result.data, // CRAgentData shape, for direct use by cr-agent callers
      remaining: rate.remaining - 1,
    })
  } catch (err) {
    const code: WathqErrorCode =
      err instanceof WathqError ? err.code : 'UPSTREAM_ERROR'
    const message =
      FRIENDLY_MESSAGE_BY_CODE[code] ??
      (err instanceof Error ? err.message : 'Wathq lookup failed')

    await recordWathqLookup(user.id, crDigits, false, code).catch(() => {})

    return NextResponse.json(
      { ok: false, code, message },
      { status: STATUS_BY_CODE[code] ?? 502 }
    )
  }
}
