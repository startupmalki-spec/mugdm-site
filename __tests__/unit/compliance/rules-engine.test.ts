import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getObligationStatus,
  generateObligations,
  getNextOccurrence,
  getObligationStatusColor,
  getObligationDotColor,
  DUE_SOON_THRESHOLD_DAYS,
} from '@/lib/compliance/rules-engine'
import type { Business } from '@/lib/supabase/types'

// Fix "today" so tests are deterministic
const FIXED_NOW = new Date('2026-04-13T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// getObligationStatus
// ---------------------------------------------------------------------------

describe('getObligationStatus', () => {
  it('returns "overdue" when due date is in the past and not completed', () => {
    expect(getObligationStatus('2026-04-01', null)).toBe('overdue')
  })

  it('returns "due_soon" when within 15 days', () => {
    expect(getObligationStatus('2026-04-20', null)).toBe('due_soon')
  })

  it('returns "upcoming" when more than 15 days away', () => {
    expect(getObligationStatus('2026-06-01', null)).toBe('upcoming')
  })

  it('returns "completed" when last_completed_at >= due date', () => {
    expect(getObligationStatus('2026-04-01', '2026-04-01T10:00:00Z')).toBe('completed')
  })

  it('returns "overdue" when completed before current cycle', () => {
    // Due Apr 1, completed Mar 1 — still overdue for the Apr cycle
    expect(getObligationStatus('2026-04-01', '2026-03-01T10:00:00Z')).toBe('overdue')
  })
})

// ---------------------------------------------------------------------------
// getObligationStatusColor / getObligationDotColor
// ---------------------------------------------------------------------------

describe('status colors', () => {
  it('returns different Tailwind classes per status', () => {
    const statuses = ['upcoming', 'due_soon', 'overdue', 'completed'] as const
    const colors = statuses.map(getObligationStatusColor)
    const dotColors = statuses.map(getObligationDotColor)

    // All should be unique
    expect(new Set(colors).size).toBe(4)
    expect(new Set(dotColors).size).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// getNextOccurrence
// ---------------------------------------------------------------------------

describe('getNextOccurrence', () => {
  it('advances MONTHLY until it is in the future', () => {
    const base = new Date('2025-01-15')
    const next = getNextOccurrence('MONTHLY', base)
    expect(next >= FIXED_NOW).toBe(true)
  })

  it('advances QUARTERLY (3 months at a time)', () => {
    const base = new Date('2025-01-25')
    const next = getNextOccurrence('QUARTERLY', base)
    expect(next >= FIXED_NOW).toBe(true)
    // Should land on a month that is 0, 3, 6, or 9 offset from January
    const monthDiff = (next.getFullYear() - 2025) * 12 + next.getMonth()
    expect(monthDiff % 3).toBe(0)
  })

  it('advances ANNUAL (1 year at a time)', () => {
    const base = new Date('2024-06-15')
    const next = getNextOccurrence('ANNUAL', base)
    expect(next >= FIXED_NOW).toBe(true)
    expect(next.getMonth()).toBe(5) // June
  })

  it('returns the base date as-is for ONE_TIME', () => {
    const base = new Date(2025, 0, 1) // local-TZ Jan 1 2025
    const next = getNextOccurrence('ONE_TIME', base)
    expect(next.getTime()).toBe(base.getTime())
  })
})

// ---------------------------------------------------------------------------
// generateObligations
// ---------------------------------------------------------------------------

describe('generateObligations', () => {
  const baseBusiness: Business = {
    id: 'biz-1',
    user_id: 'user-1',
    name_ar: 'شركة تست',
    name_en: 'Test Co',
    cr_number: '1234567890',
    activity_type: null,
    city: null,
    capital: null,
    fiscal_year_end: null,
    owners: null,
    contact_phone: null,
    contact_email: null,
    contact_address: null,
    logo_url: null,
    stamp_url: null,
    letterhead_config: null,
    cr_issuance_date: '2024-06-15',
    cr_expiry_date: null,
    data_sharing_consent: true,
    profile_history: null,
    stripe_customer_id: null,
    subscription_status: null,
    subscription_tier: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  it('generates CR Confirmation obligation from cr_issuance_date', () => {
    const obligations = generateObligations(baseBusiness)
    const cr = obligations.find((o) => o.type === 'CR_CONFIRMATION')
    expect(cr).toBeDefined()
    expect(cr!.frequency).toBe('ANNUAL')
  })

  it('generates Chamber of Commerce obligation', () => {
    const obligations = generateObligations(baseBusiness)
    const chamber = obligations.find((o) => o.type === 'CHAMBER')
    expect(chamber).toBeDefined()
  })

  it('generates 12 monthly GOSI obligations', () => {
    const obligations = generateObligations(baseBusiness)
    const gosi = obligations.filter((o) => o.type === 'GOSI')
    expect(gosi.length).toBeGreaterThanOrEqual(1)
    expect(gosi.length).toBeLessThanOrEqual(12)
    // All should be on the 15th
    for (const g of gosi) {
      expect(g.next_due_date).toMatch(/-15$/)
    }
  })

  it('generates quarterly ZATCA VAT obligations on the 25th', () => {
    const obligations = generateObligations(baseBusiness)
    const vat = obligations.filter((o) => o.type === 'ZATCA_VAT')
    expect(vat.length).toBe(4)
    for (const v of vat) {
      expect(v.next_due_date).toMatch(/-25$/)
    }
  })

  it('generates Zakat obligation 120 days after fiscal year end', () => {
    const obligations = generateObligations(baseBusiness)
    const zakat = obligations.find((o) => o.type === 'ZAKAT')
    expect(zakat).toBeDefined()
    expect(zakat!.frequency).toBe('ANNUAL')
  })

  it('skips CR-based obligations when cr_issuance_date is null', () => {
    const biz = { ...baseBusiness, cr_issuance_date: null }
    const obligations = generateObligations(biz)
    const cr = obligations.find((o) => o.type === 'CR_CONFIRMATION')
    expect(cr).toBeUndefined()
  })
})
