// Supabase Edge Function — compute-profiles
// Runs every 6 hours (see supabase/config.toml schedule).
// For each business: reads the last 7d of events, recomputes engagement /
// health / churn / lifecycle, upserts user_profiles, refreshes
// feature_adoption and value_realization.
//
// Deno runtime — do NOT import from the Next.js src/ tree.

/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

/* ────────── Scoring (mirrored from src/lib/intelligence/scoring.ts) ────────── */

type LifecycleStage =
  | 'new'
  | 'onboarding'
  | 'activated'
  | 'engaged'
  | 'at_risk'
  | 'dormant'
  | 'churned'

interface ProfileInputs {
  daysSinceSignup: number
  daysActiveLast30: number
  aiCallsLast7d: number
  chatMessagesTotal: number
  featuresUsedCount: number
  onboardingStepsDone: number
  onboardingCompleted: boolean
  frustrationEvents7d: number
  errorsEncountered7d: number
  rateLimitsHit7d: number
  unresolvedIssuesCount: number
  lastActiveAt: Date | null
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)))

function calculateEngagementScore(p: ProfileInputs): number {
  const activityRatio = Math.min(p.daysActiveLast30 / 30, 1)
  const aiUsageRatio = Math.min(p.aiCallsLast7d / 20, 1)
  const breadthRatio = Math.min(p.featuresUsedCount / 5, 1)
  const chatRatio = Math.min(p.chatMessagesTotal / 50, 1)
  return clamp(activityRatio * 40 + breadthRatio * 25 + aiUsageRatio * 20 + chatRatio * 15)
}

function calculateHealthScore(p: ProfileInputs): number {
  let score = 100
  score -= Math.min(p.frustrationEvents7d * 8, 30)
  score -= Math.min(p.errorsEncountered7d * 4, 20)
  score -= Math.min(p.rateLimitsHit7d * 6, 20)
  score -= Math.min(p.unresolvedIssuesCount * 5, 20)
  if (p.daysSinceSignup > 7 && p.daysActiveLast30 < 2) score -= 15
  return clamp(score)
}

function calculateChurnRisk(p: ProfileInputs): number {
  const daysSinceActive = p.lastActiveAt
    ? Math.max(0, (Date.now() - p.lastActiveAt.getTime()) / 86400000)
    : p.daysSinceSignup
  let risk = 0
  if (daysSinceActive > 21) risk += 60
  else if (daysSinceActive > 14) risk += 45
  else if (daysSinceActive > 7) risk += 25
  else if (daysSinceActive > 3) risk += 10
  risk += Math.min(p.frustrationEvents7d * 5, 20)
  risk += Math.min(p.unresolvedIssuesCount * 4, 15)
  risk += Math.min(p.rateLimitsHit7d * 3, 10)
  if (!p.onboardingCompleted && p.daysSinceSignup > 7) risk += 10
  return clamp(risk)
}

function deriveLifecycleStage(p: ProfileInputs): LifecycleStage {
  const daysSinceActive = p.lastActiveAt
    ? Math.max(0, (Date.now() - p.lastActiveAt.getTime()) / 86400000)
    : p.daysSinceSignup
  if (daysSinceActive > 60) return 'churned'
  if (daysSinceActive > 30) return 'dormant'
  if (daysSinceActive > 14) return 'at_risk'
  if (p.featuresUsedCount >= 3 && p.daysActiveLast30 >= 10) return 'engaged'
  if (p.onboardingCompleted) return 'activated'
  if (p.onboardingStepsDone > 0) return 'onboarding'
  if (p.daysSinceSignup <= 1) return 'new'
  return 'onboarding'
}

/* ────────── Feature mapping ────────── */

function featureForEvent(eventName: string): string | null {
  // Map event.name → feature name for feature_adoption tracking.
  if (eventName.startsWith('bookkeeper.')) return 'bookkeeper'
  if (eventName.startsWith('chat.')) return 'chat'
  if (eventName.startsWith('onboarding.')) return 'onboarding'
  if (eventName.startsWith('compliance.')) return 'compliance'
  if (eventName.startsWith('documents.')) return 'documents'
  if (eventName.startsWith('team.')) return 'team'
  if (eventName.startsWith('reports.')) return 'reports'
  if (eventName.startsWith('notification.')) return 'notifications'
  return null
}

/* ────────── Behavioral pattern detection (PRD_ML §6.1 Signal 2) ────────── */

function detectErrorSpiral(events: Array<{ event_name: string; session_id: string | null }>): number {
  // Count distinct sessions with >3 error events.
  const perSession = new Map<string, number>()
  for (const e of events) {
    if (!e.session_id) continue
    if (e.event_name.endsWith('.error') || e.event_name.endsWith('.fail')) {
      perSession.set(e.session_id, (perSession.get(e.session_id) ?? 0) + 1)
    }
  }
  let spirals = 0
  for (const count of perSession.values()) if (count > 3) spirals++
  return spirals
}

/* ────────── Main ────────── */

Deno.serve(async (req: Request) => {
  // Allow manual trigger via POST with X-Cron-Secret or via Supabase scheduler.
  const secret = Deno.env.get('CRON_SECRET')
  const header = req.headers.get('x-cron-secret')
  if (secret && header !== secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  const { data: businesses, error: bizErr } = await supabase
    .from('businesses')
    .select('id, user_id, created_at')

  if (bizErr) return new Response(JSON.stringify({ error: bizErr.message }), { status: 500 })

  let processed = 0
  const errors: string[] = []

  for (const biz of businesses ?? []) {
    try {
      const { data: events30 } = await supabase
        .from('user_events')
        .select('event_name, event_category, session_id, created_at')
        .eq('business_id', biz.id)
        .gte('created_at', thirtyDaysAgo)

      const { data: aiCalls7d } = await supabase
        .from('ai_usage_log')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', biz.id)
        .eq('purpose', 'user')
        .gte('created_at', sevenDaysAgo)

      const { data: unresolvedIssues } = await supabase
        .from('detected_issues')
        .select('id, issue_type', { count: 'exact' })
        .eq('business_id', biz.id)
        .eq('status', 'open')

      const events = (events30 as any[]) ?? []
      const events7d = events.filter((e) => e.created_at >= sevenDaysAgo)

      const daysSinceSignup = Math.floor(
        (now.getTime() - new Date(biz.created_at as string).getTime()) / 86400000
      )

      const activeDays = new Set<string>()
      for (const e of events) activeDays.add((e.created_at as string).slice(0, 10))

      const sessions = new Set<string>()
      for (const e of events) if (e.session_id) sessions.add(e.session_id as string)

      const chatMessagesTotal = events.filter((e: any) => e.event_name === 'chat.message_sent').length
      const onboardingSteps = new Set<string>()
      for (const e of events) {
        if (e.event_name === 'onboarding.step_complete') {
          onboardingSteps.add((e as any).properties?.step ?? 'unknown')
        }
      }
      const onboardingStepsDone = onboardingSteps.size

      const featuresUsed = new Set<string>()
      for (const e of events) {
        const f = featureForEvent(e.event_name as string)
        if (f) featuresUsed.add(f)
      }

      const frustrationEvents7d = events7d.filter(
        (e: any) =>
          e.event_name === 'chat.tool_rejected' ||
          e.event_name.endsWith('.fail') ||
          e.event_name.endsWith('.error')
      ).length
      const errorsEncountered7d = events7d.filter((e: any) => e.event_name.endsWith('.error')).length
      const rateLimitsHit7d = events7d.filter((e: any) => e.event_name === 'rate_limit.hit').length

      const lastActive = events.length > 0
        ? new Date(Math.max(...events.map((e: any) => new Date(e.created_at).getTime())))
        : null

      const inputs: ProfileInputs = {
        daysSinceSignup,
        daysActiveLast30: activeDays.size,
        aiCallsLast7d: (aiCalls7d as any)?.count ?? 0,
        chatMessagesTotal,
        featuresUsedCount: featuresUsed.size,
        onboardingStepsDone,
        onboardingCompleted: onboardingStepsDone >= 5,
        frustrationEvents7d,
        errorsEncountered7d,
        rateLimitsHit7d,
        unresolvedIssuesCount: (unresolvedIssues as any)?.count ?? 0,
        lastActiveAt: lastActive,
      }

      const profile = {
        business_id: biz.id,
        user_id: biz.user_id,
        engagement_score: calculateEngagementScore(inputs),
        health_score: calculateHealthScore(inputs),
        churn_risk_score: calculateChurnRisk(inputs),
        lifecycle_stage: deriveLifecycleStage(inputs),
        total_sessions: sessions.size,
        total_events: events.length,
        last_active_at: lastActive?.toISOString() ?? null,
        days_since_signup: daysSinceSignup,
        days_active_last_30: activeDays.size,
        features_used: Array.from(featuresUsed),
        features_used_count: featuresUsed.size,
        onboarding_completed: inputs.onboardingCompleted,
        onboarding_steps_done: onboardingStepsDone,
        ai_calls_last_7d: inputs.aiCallsLast7d,
        chat_messages_total: chatMessagesTotal,
        frustration_events_7d: frustrationEvents7d,
        errors_encountered_7d: errorsEncountered7d,
        rate_limits_hit_7d: rateLimitsHit7d,
        computed_at: now.toISOString(),
        updated_at: now.toISOString(),
      }

      await supabase.from('user_profiles').upsert(profile, { onConflict: 'business_id' })

      // feature_adoption upserts — one row per (business, feature).
      for (const feature of featuresUsed) {
        const usages = events.filter((e: any) => featureForEvent(e.event_name) === feature)
        if (usages.length === 0) continue
        const timestamps = usages.map((e: any) => new Date(e.created_at).getTime()).sort((a, b) => a - b)
        const first = new Date(timestamps[0])
        const last = new Date(timestamps[timestamps.length - 1])
        const sevenMs = now.getTime() - 7 * 86400000
        const usage7d = timestamps.filter((t) => t >= sevenMs).length
        await supabase.from('feature_adoption').upsert(
          {
            business_id: biz.id,
            feature_name: feature,
            first_used_at: first.toISOString(),
            last_used_at: last.toISOString(),
            usage_count_total: usages.length,
            usage_count_7d: usage7d,
            usage_count_30d: usages.length,
            days_since_signup_at_first_use: Math.floor(
              (first.getTime() - new Date(biz.created_at as string).getTime()) / 86400000
            ),
          },
          { onConflict: 'business_id,feature_name' }
        )
      }

      // Behavioral pattern: error spirals → detected_issues
      const spirals = detectErrorSpiral(events7d)
      if (spirals > 0) {
        await supabase.from('detected_issues').insert({
          business_id: biz.id,
          issue_type: 'bug',
          severity: spirals >= 2 ? 'high' : 'medium',
          source: 'behavioral',
          title: 'Error spiral detected',
          description: `User hit >3 errors in ${spirals} session(s) over the last 7 days.`,
          evidence: { spiral_sessions: spirals },
        })
      }

      processed++
    } catch (err) {
      errors.push(
        `${biz.id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return new Response(
    JSON.stringify({ processed, errors: errors.length > 0 ? errors : undefined }),
    { headers: { 'content-type': 'application/json' }, status: errors.length > 0 ? 207 : 200 }
  )
})
