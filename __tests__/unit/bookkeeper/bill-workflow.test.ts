import { describe, it, expect } from 'vitest'

import {
  canTransition,
  type BillStatus,
} from '@/lib/bookkeeper/bill-workflow'

const STATUSES: BillStatus[] = [
  'draft',
  'pending',
  'approved',
  'overdue',
  'paid',
  'void',
]

/**
 * Ground-truth transition table per PRD state machine.
 * Row = from, Col = to. `true` means allowed.
 */
const ALLOWED: Record<BillStatus, Partial<Record<BillStatus, true>>> = {
  draft: { pending: true, void: true },
  pending: { approved: true, void: true, draft: true },
  approved: { paid: true, overdue: true, void: true },
  overdue: { paid: true, void: true },
  paid: {},
  void: {},
}

describe('canTransition — full 6x6 matrix', () => {
  for (const from of STATUSES) {
    for (const to of STATUSES) {
      const expected = Boolean(ALLOWED[from][to])
      it(`${from} → ${to} should be ${expected ? 'allowed' : 'rejected'}`, () => {
        expect(canTransition(from, to)).toBe(expected)
      })
    }
  }
})

describe('canTransition — PRD spot checks', () => {
  it('allows draft → pending', () => {
    expect(canTransition('draft', 'pending')).toBe(true)
  })

  it('allows pending → approved', () => {
    expect(canTransition('pending', 'approved')).toBe(true)
  })

  it('allows approved → paid', () => {
    expect(canTransition('approved', 'paid')).toBe(true)
  })

  it('allows any non-paid/non-void status to transition to void', () => {
    expect(canTransition('draft', 'void')).toBe(true)
    expect(canTransition('pending', 'void')).toBe(true)
    expect(canTransition('approved', 'void')).toBe(true)
    expect(canTransition('overdue', 'void')).toBe(true)
  })

  it('does not allow paid → anything (terminal)', () => {
    for (const to of STATUSES) {
      expect(canTransition('paid', to)).toBe(false)
    }
  })

  it('does not allow void → anything (terminal)', () => {
    for (const to of STATUSES) {
      expect(canTransition('void', to)).toBe(false)
    }
  })

  it('rejects self-transitions', () => {
    for (const s of STATUSES) {
      expect(canTransition(s, s)).toBe(false)
    }
  })

  it('rejects skipping pending (draft → approved)', () => {
    expect(canTransition('draft', 'approved')).toBe(false)
  })

  it('rejects approved → pending (no backward)', () => {
    expect(canTransition('approved', 'pending')).toBe(false)
  })
})
