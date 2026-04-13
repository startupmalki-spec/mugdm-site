/**
 * Per-user-per-day Wathq lookup rate limit.
 *
 * The existing src/lib/rate-limit.ts is per-business AI calls; Wathq lookups
 * are user-scoped (a user can lookup CRs before any business exists, e.g.
 * during onboarding) so we use a dedicated table `wathq_lookup_log`.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

const DAILY_LIMIT = 10

export interface WathqRateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  used: number
}

function service() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function checkWathqRateLimit(userId: string): Promise<WathqRateLimitResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const supabase = service()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase.from('wathq_lookup_log') as any)
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)

  const used = count ?? 0
  return {
    allowed: used < DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - used),
    limit: DAILY_LIMIT,
    used,
  }
}

export async function recordWathqLookup(
  userId: string,
  crNumber: string,
  success: boolean,
  errorCode?: string | null
): Promise<void> {
  const supabase = service()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('wathq_lookup_log') as any).insert({
    user_id: userId,
    cr_number: crNumber,
    success,
    error_code: errorCode ?? null,
  })
}
