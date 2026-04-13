// Supabase Edge Function — evaluate-nudges
// Runs every 6h after compute-profiles. Walks active nudge rules and
// fires in_app notifications / email jobs when a user matches conditions
// (subject to cooldown and per-user cap).
//
// Deno runtime — no imports from Next.js src/.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

interface NudgeRule {
  id: string
  name: string
  trigger_conditions: Record<string, any>
  channel: 'in_app' | 'email' | 'both'
  template_key: string
  template_vars: Record<string, any> | null
  max_sends_per_user: number
  cooldown_hours: number
  priority: number
  min_health_score: number | null
  max_health_score: number | null
  is_active: boolean
}

interface Profile {
  business_id: string
  user_id: string
  engagement_score: number
  health_score: number
  churn_risk_score: number
  lifecycle_stage: string
  onboarding_steps_done: number
  onboarding_completed: boolean
  features_used: string[]
  features_used_count: number
  days_since_signup: number
  last_active_at: string | null
  last_nudge_sent_at: string | null
}

/* ────────── Condition evaluator ────────── */

function getField(profile: Profile, recentEventNames: Set<string>, key: string): any {
  if (key === 'recent_event' || key === 'event_trigger') {
    // Caller handles these separately.
    return null
  }
  return (profile as any)[key]
}

function cmp(actual: any, op: any): boolean {
  if (actual == null) return false
  if (op && typeof op === 'object' && !Array.isArray(op)) {
    for (const [k, v] of Object.entries(op)) {
      if (k === '$lt' && !(actual < (v as number))) return false
      if (k === '$lte' && !(actual <= (v as number))) return false
      if (k === '$gt' && !(actual > (v as number))) return false
      if (k === '$gte' && !(actual >= (v as number))) return false
      if (k === '$eq' && actual !== v) return false
      if (k === '$ne' && actual === v) return false
      if (k === '$in' && !(v as any[]).includes(actual)) return false
    }
    return true
  }
  return actual === op
}

function matches(rule: NudgeRule, profile: Profile, recentEventNames: Set<string>): boolean {
  const c = rule.trigger_conditions
  const daysSinceActive = profile.last_active_at
    ? (Date.now() - new Date(profile.last_active_at).getTime()) / 86400000
    : profile.days_since_signup

  for (const [key, expected] of Object.entries(c)) {
    if (key === 'recent_event') {
      if (!recentEventNames.has(expected as string)) return false
      continue
    }
    if (key === 'event_trigger') {
      // Event-triggered rules are fired from the event stream, not the
      // periodic profile scan; skip them here.
      return false
    }
    if (key === 'days_since_active') {
      if (!cmp(daysSinceActive, expected)) return false
      continue
    }
    if (key === 'features_used_not_contains') {
      if (profile.features_used?.includes(expected as string)) return false
      continue
    }
    const actual = getField(profile, recentEventNames, key)
    if (!cmp(actual, expected)) return false
  }

  // Health score gating.
  if (rule.min_health_score != null && profile.health_score < rule.min_health_score) return false
  if (rule.max_health_score != null && profile.health_score > rule.max_health_score) return false

  return true
}

/* ────────── In-app copy (Phase 1 minimal) ────────── */

const IN_APP_COPY: Record<string, { title: string; body: string; action_url?: string; action_label?: string }> = {
  nudgeOnboardingStall: {
    title: 'Keep going — you\'re almost there',
    body: 'Finish setting up your business profile to unlock your first compliance report.',
    action_url: '/onboarding',
    action_label: 'Resume setup',
  },
  nudgeFirstUpload: {
    title: 'Upload your first bank statement',
    body: 'Drop a CSV or PDF into the Bookkeeper and we\'ll categorize every transaction for you.',
    action_url: '/bookkeeper',
    action_label: 'Go to Bookkeeper',
  },
  nudgeFeatureDiscovery: {
    title: 'Discover a new feature',
    body: 'You\'ve been using one corner of Mugdm — explore the rest of the platform.',
    action_url: '/dashboard',
    action_label: 'Explore',
  },
  nudgeValueCelebration: {
    title: 'Nice work 🎉',
    body: 'You just hit a milestone — keep it up!',
  },
  nudgeComplianceBoost: {
    title: 'Overdue obligation',
    body: 'You have a compliance item that\'s past due. Mark it done or reschedule.',
    action_url: '/calendar',
    action_label: 'Open calendar',
  },
  nudgeReengagement: {
    title: 'We miss you at Mugdm',
    body: 'Your business picture has likely changed — let\'s catch up.',
    action_url: '/dashboard',
    action_label: 'See what\'s new',
  },
  nudgeChurnPrevention: {
    title: 'Need a hand?',
    body: 'Our team is here if something isn\'t working. Reply and we\'ll help.',
  },
}

/* ────────── Main ────────── */

Deno.serve(async (req: Request) => {
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

  const { data: rules } = await supabase
    .from('nudge_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')

  const activeRules = (rules as NudgeRule[]) ?? []
  const allProfiles = (profiles as Profile[]) ?? []

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  let sent = 0
  const errors: string[] = []

  for (const profile of allProfiles) {
    try {
      // Global cooldown — max 1 nudge per cycle per user.
      if (profile.last_nudge_sent_at && profile.last_nudge_sent_at > oneHourAgo) continue

      // Load recent events for recent_event triggers.
      const { data: recentEvents } = await supabase
        .from('user_events')
        .select('event_name')
        .eq('business_id', profile.business_id)
        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .limit(200)
      const recentEventNames = new Set<string>(
        ((recentEvents as any[]) ?? []).map((e) => e.event_name as string)
      )

      for (const rule of activeRules) {
        if (!matches(rule, profile, recentEventNames)) continue

        // Per-rule cooldown + max sends.
        const cooldownStart = new Date(
          now.getTime() - rule.cooldown_hours * 60 * 60 * 1000
        ).toISOString()
        const { data: prior } = await supabase
          .from('nudge_log')
          .select('id', { count: 'exact' })
          .eq('nudge_rule_id', rule.id)
          .eq('business_id', profile.business_id)
        const priorCount = (prior as any)?.length ?? 0
        if (priorCount >= rule.max_sends_per_user) continue

        const { data: recentSend } = await supabase
          .from('nudge_log')
          .select('id')
          .eq('nudge_rule_id', rule.id)
          .eq('business_id', profile.business_id)
          .gte('sent_at', cooldownStart)
          .maybeSingle()
        if (recentSend) continue

        // Dispatch — for Phase 1 we only insert in_app for `in_app` and `both`;
        // email sending is stubbed (logged but not yet fired) until the
        // bilingual nudge templates land in src/lib/email/templates.ts.
        const copy = IN_APP_COPY[rule.template_key] ?? {
          title: rule.name,
          body: rule.name,
        }

        if (rule.channel === 'in_app' || rule.channel === 'both') {
          await supabase.from('in_app_notifications').insert({
            business_id: profile.business_id,
            title: copy.title,
            body: copy.body,
            action_url: copy.action_url ?? null,
            action_label: copy.action_label ?? null,
            type: rule.template_key === 'nudgeValueCelebration' ? 'celebration' : 'nudge',
            nudge_rule_id: rule.id,
          })
        }

        await supabase.from('nudge_log').insert({
          nudge_rule_id: rule.id,
          business_id: profile.business_id,
          channel: rule.channel,
        })

        await supabase
          .from('user_profiles')
          .update({
            last_nudge_sent_at: now.toISOString(),
            nudges_sent_total: ((profile as any).nudges_sent_total ?? 0) + 1,
          })
          .eq('business_id', profile.business_id)

        sent++
        break // 1 nudge per cycle per user
      }
    } catch (err) {
      errors.push(
        `${profile.business_id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return new Response(
    JSON.stringify({ sent, errors: errors.length > 0 ? errors : undefined }),
    { headers: { 'content-type': 'application/json' }, status: errors.length > 0 ? 207 : 200 }
  )
})
