import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/** Cost per million tokens by model (USD) — approximate as of 2026-04 */
const COST_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-opus-4-0520': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
}

const FREE_TIER_DAILY_LIMIT = 50
const PRO_TIER_DAILY_LIMIT = 500

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const rates = COST_PER_MILLION_TOKENS[model]
  if (!rates) return 0

  const inputCost = (tokensIn / 1_000_000) * rates.input
  const outputCost = (tokensOut / 1_000_000) * rates.output
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}

export async function trackUsage(
  supabase: SupabaseClient,
  userId: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): Promise<void> {
  const costEstimate = estimateCost(model, tokensIn, tokensOut)

  const { error } = await supabase.from('ai_usage_log').insert({
    user_id: userId,
    model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_estimate: costEstimate,
  } as never)

  if (error) {
    // Non-blocking — log but don't fail the request
    console.error('[UsageTracker] failed to insert usage log:', error.message)
  }
}

export async function getUserUsageToday(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())

  if (error) {
    console.error('[UsageTracker] failed to get usage count:', error.message)
    return 0
  }

  return count ?? 0
}

export async function isWithinLimit(
  supabase: SupabaseClient,
  userId: string,
  tier: 'free' | 'pro' | 'business'
): Promise<boolean> {
  if (tier === 'business') return true

  const limit = tier === 'pro' ? PRO_TIER_DAILY_LIMIT : FREE_TIER_DAILY_LIMIT
  const usageToday = await getUserUsageToday(supabase, userId)
  return usageToday < limit
}
