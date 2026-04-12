import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface UsageStats {
  aiCallsToday: number
  aiCallsLimit: number | null
  documentsStored: number
  teamMembers: number
  storageEstimateMB: number
  tier: string
}

/** Tier limits for display purposes */
export const TIER_LIMITS = {
  free: { aiCalls: 50, documents: 50, teamMembers: 5, storageMB: 100 },
  pro: { aiCalls: 500, documents: 500, teamMembers: 50, storageMB: 2048 },
  business: { aiCalls: null, documents: null, teamMembers: null, storageMB: null },
} as const

export async function getUsageStats(
  businessId: string,
  supabase: SupabaseClient
): Promise<UsageStats> {
  const [rateLimit, docsResult, teamResult] = await Promise.all([
    checkRateLimit(businessId),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_current', true),
    supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'ACTIVE'),
  ])

  const aiCallsToday =
    rateLimit.limit !== null
      ? rateLimit.limit - rateLimit.remaining
      : 0
  const documentsStored = docsResult.count ?? 0
  const teamMembers = teamResult.count ?? 0

  // Rough storage estimate: ~0.5 MB per document on average
  const storageEstimateMB = Math.round(documentsStored * 0.5 * 10) / 10

  return {
    aiCallsToday,
    aiCallsLimit: rateLimit.limit,
    documentsStored,
    teamMembers,
    storageEstimateMB,
    tier: rateLimit.tier,
  }
}
