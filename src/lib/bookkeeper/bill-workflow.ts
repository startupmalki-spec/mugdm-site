/**
 * Bill approval workflow state machine.
 *
 * States (from bill_status enum in migration 015):
 *   draft → pending → approved → paid
 *   any non-paid → void
 *   approved → overdue (via cron sweep)
 */

export type BillStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'paid'
  | 'overdue'
  | 'void'

const TRANSITIONS: Record<BillStatus, BillStatus[]> = {
  draft: ['pending', 'void'],
  pending: ['approved', 'void', 'draft'],
  approved: ['paid', 'overdue', 'void'],
  overdue: ['paid', 'void'],
  paid: [],
  void: [],
}

/**
 * Pure predicate: can a bill transition from `from` to `to`?
 */
export function canTransition(from: BillStatus, to: BillStatus): boolean {
  if (from === to) return false
  const allowed = TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}
