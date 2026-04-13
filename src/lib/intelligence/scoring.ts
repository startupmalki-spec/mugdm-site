/**
 * ML Intelligence scoring library (PRD_ML §§5.2–5.5).
 *
 * Pure functions — no I/O. Imported both by Next.js server code and (as a
 * duplicated copy) by the compute-profiles Deno Edge Function; keep it free
 * of Node/Next.js imports.
 */

export interface ProfileInputs {
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
  /** Previous lifecycle stage — used to resist backsliding from `activated`. */
  previousLifecycle?: LifecycleStage
}

export type LifecycleStage =
  | 'new'
  | 'onboarding'
  | 'activated'
  | 'engaged'
  | 'at_risk'
  | 'dormant'
  | 'churned'

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

/**
 * Engagement = how much they use the product. 0–100.
 * Heuristic weighting favors broad feature use over raw call volume so that
 * a lightweight-but-daily user can still score high.
 */
export function calculateEngagementScore(p: ProfileInputs): number {
  const activityRatio = Math.min(p.daysActiveLast30 / 30, 1) // 0–1
  const aiUsageRatio = Math.min(p.aiCallsLast7d / 20, 1) // saturates at 20 calls/week
  const breadthRatio = Math.min(p.featuresUsedCount / 5, 1) // saturates at 5 features
  const chatRatio = Math.min(p.chatMessagesTotal / 50, 1)

  const score =
    activityRatio * 40 +
    breadthRatio * 25 +
    aiUsageRatio * 20 +
    chatRatio * 15

  return clamp(score)
}

/**
 * Health = how well things are going. 0–100.
 * Starts at 100 and deducts for frustration, errors, rate limits, unresolved
 * issues. Low engagement also drags this down slightly (disengaged ≠ happy).
 */
export function calculateHealthScore(p: ProfileInputs): number {
  let score = 100

  score -= Math.min(p.frustrationEvents7d * 8, 30)
  score -= Math.min(p.errorsEncountered7d * 4, 20)
  score -= Math.min(p.rateLimitsHit7d * 6, 20)
  score -= Math.min(p.unresolvedIssuesCount * 5, 20)

  // Disengagement penalty (light).
  if (p.daysSinceSignup > 7 && p.daysActiveLast30 < 2) score -= 15

  return clamp(score)
}

/**
 * Churn risk = probability they leave. 0–100.
 * Dominant signals: recency of activity, lifecycle stage, unresolved pain.
 */
export function calculateChurnRisk(p: ProfileInputs): number {
  const daysSinceActive = p.lastActiveAt
    ? Math.max(0, (Date.now() - p.lastActiveAt.getTime()) / 86400000)
    : p.daysSinceSignup

  let risk = 0

  // Recency — the biggest single signal.
  if (daysSinceActive > 21) risk += 60
  else if (daysSinceActive > 14) risk += 45
  else if (daysSinceActive > 7) risk += 25
  else if (daysSinceActive > 3) risk += 10

  // Frustration + unresolved pain.
  risk += Math.min(p.frustrationEvents7d * 5, 20)
  risk += Math.min(p.unresolvedIssuesCount * 4, 15)
  risk += Math.min(p.rateLimitsHit7d * 3, 10)

  // Onboarding never completed + signed up a while ago.
  if (!p.onboardingCompleted && p.daysSinceSignup > 7) risk += 10

  return clamp(risk)
}

/**
 * Lifecycle stage derivation (PRD_ML §5.5).
 * Resists backsliding from `activated`/`engaged` into `new`/`onboarding` on
 * a quiet day — movement to `at_risk`/`dormant` requires real inactivity.
 */
export function deriveLifecycleStage(p: ProfileInputs): LifecycleStage {
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

  // Signed up but never touched onboarding.
  return 'onboarding'
}

export interface ComputedProfile {
  engagement_score: number
  health_score: number
  churn_risk_score: number
  lifecycle_stage: LifecycleStage
}

export function computeProfile(p: ProfileInputs): ComputedProfile {
  return {
    engagement_score: calculateEngagementScore(p),
    health_score: calculateHealthScore(p),
    churn_risk_score: calculateChurnRisk(p),
    lifecycle_stage: deriveLifecycleStage(p),
  }
}
