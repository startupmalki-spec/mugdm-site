import { NextResponse } from 'next/server'

import { checkRateLimit, type RateLimitResult } from '@/lib/rate-limit'

/**
 * Check rate limits for an API route and return a 429 response if exceeded.
 *
 * Usage in an API route:
 * ```ts
 * const rateLimitResponse = await enforceRateLimit(businessId)
 * if (rateLimitResponse) return rateLimitResponse
 * ```
 *
 * On success (rate limit not exceeded), returns `null` so the route can proceed.
 * On failure, returns a `NextResponse` with status 429 and rate-limit headers.
 */
export async function enforceRateLimit(
  businessId: string
): Promise<NextResponse | null> {
  const result = await checkRateLimit(businessId)

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        remaining: 0,
        limit: result.limit,
        resetAt: result.resetAt,
        tier: result.tier,
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(result),
      }
    )
  }

  return null
}

/**
 * Build standard rate-limit headers from a RateLimitResult.
 * Attach these to successful API responses so clients can track usage.
 *
 * Usage:
 * ```ts
 * const rateCheck = await checkRateLimit(businessId)
 * return NextResponse.json(data, { headers: buildRateLimitHeaders(rateCheck) })
 * ```
 */
export function buildRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Reset': result.resetAt,
  }

  if (result.limit !== null) {
    headers['X-RateLimit-Limit'] = String(result.limit)
    headers['X-RateLimit-Remaining'] = String(result.remaining)
  } else {
    // Business tier: unlimited
    headers['X-RateLimit-Limit'] = 'unlimited'
    headers['X-RateLimit-Remaining'] = 'unlimited'
  }

  return headers
}
