import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

const DAILY_LIMIT = 100

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: string
}

function getServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getTodayStart(): string {
  return new Date().toISOString().split('T')[0]
}

function getResetAt(): string {
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

async function countTodayAICalls(businessId: string): Promise<number> {
  const supabase = getServiceRoleClient()
  const today = getTodayStart()

  // Both counts run as a single parallel batch to minimize latency.
  // These are HEAD requests (no row data transferred), only counts.
  const results = await Promise.all([
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('uploaded_at', today)
      .not('ai_confidence', 'is', null),
    supabase
      .from('bank_statement_uploads')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', today),
  ])

  return results.reduce((sum, { count }) => sum + (count ?? 0), 0)
}

export async function checkRateLimit(businessId: string): Promise<RateLimitResult> {
  const used = await countTodayAICalls(businessId)
  const remaining = Math.max(0, DAILY_LIMIT - used)
  const resetAt = getResetAt()

  return {
    allowed: used < DAILY_LIMIT,
    remaining,
    resetAt,
  }
}
