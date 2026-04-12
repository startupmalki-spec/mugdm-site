import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

export type SubscriptionTier = 'free' | 'pro' | 'business'

/** Daily AI call limits per subscription tier */
const TIER_LIMITS: Record<SubscriptionTier, number | null> = {
  free: 50,
  pro: 500,
  business: null, // unlimited
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number | null
  resetAt: string
  tier: SubscriptionTier
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

async function getSubscriptionTier(businessId: string): Promise<SubscriptionTier> {
  const supabase = getServiceRoleClient()
  const { data } = await supabase
    .from('businesses')
    .select('subscription_tier')
    .eq('id', businessId)
    .maybeSingle<{ subscription_tier: string | null }>()

  const tier = data?.subscription_tier as SubscriptionTier | null
  if (tier && tier in TIER_LIMITS) return tier
  return 'free'
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
  const [tier, used] = await Promise.all([
    getSubscriptionTier(businessId),
    countTodayAICalls(businessId),
  ])

  const dailyLimit = TIER_LIMITS[tier]
  const resetAt = getResetAt()

  // Business tier has unlimited calls
  if (dailyLimit === null) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: null,
      resetAt,
      tier,
    }
  }

  const remaining = Math.max(0, dailyLimit - used)

  return {
    allowed: used < dailyLimit,
    remaining,
    limit: dailyLimit,
    resetAt,
    tier,
  }
}
