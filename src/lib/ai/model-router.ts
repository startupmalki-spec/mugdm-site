const MODEL_TIERS = {
  premium: 'claude-opus-4-0520',
  standard: 'claude-sonnet-4-20250514',
  efficient: 'claude-haiku-4-5-20251001',
} as const

type ModelTier = keyof typeof MODEL_TIERS

type TaskType =
  // Legacy (kept for call-site compatibility)
  | 'onboarding'
  | 'document_analysis'
  | 'receipt_analysis'
  | 'chat'
  | 'classification'
  | 'insights'
  | 'statement_parsing'
  | 'cr_extraction'
  // Phase 1 additions
  | 'chat_simple'
  | 'chat_advisory'
  | 'chat_follow_up'
  | 'statement_parsing_csv'
  | 'statement_parsing_pdf'
  | 'document_analysis_complex'
  | 'categorization'
  | 'intelligence_classification'
  | 'bill_analysis'

type Purpose = 'user' | 'intelligence_classification' | 'system'

interface RouteOptions {
  userId: string
  task: TaskType
  isFirstUse?: boolean
  /** Intelligence classification calls are free of user rate limits. */
  purpose?: Purpose
  /** When retrying after a low-confidence Haiku result, force the standard tier. */
  escalated?: boolean
}

/** Cheap/structured tasks routed to Haiku. */
const HAIKU_TASKS = new Set<TaskType>([
  'receipt_analysis',
  'statement_parsing',
  'statement_parsing_csv',
  'classification',
  'categorization',
  'intelligence_classification',
  'chat_simple',
  'chat_follow_up',
])

/** Complex/advisory tasks routed to Sonnet. */
const SONNET_TASKS = new Set<TaskType>([
  'onboarding',
  'document_analysis',
  'document_analysis_complex',
  'statement_parsing_pdf',
  'cr_extraction',
  'chat',
  'chat_advisory',
  'insights',
  'bill_analysis',
])

export function selectModel(options: RouteOptions): string {
  if (options.isFirstUse) return MODEL_TIERS.premium
  if (options.escalated) return MODEL_TIERS.standard

  if (HAIKU_TASKS.has(options.task)) return MODEL_TIERS.efficient
  if (SONNET_TASKS.has(options.task)) return MODEL_TIERS.standard

  // Unknown task → safe default is standard.
  return MODEL_TIERS.standard
}

/** Confidence below this threshold triggers escalation to the standard tier (PRD_AI §3.1). */
export const CONFIDENCE_ESCALATION_THRESHOLD = 0.7

export function shouldEscalate(confidence: number | null | undefined): boolean {
  if (confidence == null || Number.isNaN(confidence)) return false
  return confidence < CONFIDENCE_ESCALATION_THRESHOLD
}

export { MODEL_TIERS, HAIKU_TASKS, SONNET_TASKS }
export type { ModelTier, TaskType, RouteOptions, Purpose }
