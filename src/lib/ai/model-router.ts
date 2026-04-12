const MODEL_TIERS = {
  premium: 'claude-opus-4-0520',
  standard: 'claude-sonnet-4-20250514',
  efficient: 'claude-haiku-4-5-20251001',
} as const

type ModelTier = keyof typeof MODEL_TIERS

type TaskType =
  | 'onboarding'
  | 'document_analysis'
  | 'receipt_analysis'
  | 'chat'
  | 'classification'
  | 'insights'
  | 'statement_parsing'
  | 'cr_extraction'

interface RouteOptions {
  userId: string
  task: TaskType
  isFirstUse?: boolean
}

const STANDARD_TASKS = new Set<TaskType>([
  'document_analysis',
  'receipt_analysis',
  'onboarding',
  'chat',
  'insights',
  'statement_parsing',
  'cr_extraction',
])

export function selectModel(options: RouteOptions): string {
  if (options.isFirstUse) return MODEL_TIERS.premium

  if (STANDARD_TASKS.has(options.task)) return MODEL_TIERS.standard

  return MODEL_TIERS.efficient
}

export { MODEL_TIERS }
export type { ModelTier, TaskType, RouteOptions }
