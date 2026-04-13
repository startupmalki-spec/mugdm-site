import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateGOSI,
  calculateTenure,
  getContractExpiryWarning,
} from '@/lib/team/gosi-calculator'

const FIXED_NOW = new Date('2026-04-13T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// calculateGOSI
// ---------------------------------------------------------------------------

describe('calculateGOSI', () => {
  describe('Saudi employee', () => {
    it('calculates correct employee share (10.5%)', () => {
      const result = calculateGOSI(10000, true)
      // Employee: 9.75% annuities + 0.75% SANED = 10.5%
      expect(result.employeeShare).toBe(1050)
    })

    it('calculates correct employer share (12.5%)', () => {
      const result = calculateGOSI(10000, true)
      // Employer: 9.75% annuities + 2% occupational + 0.75% SANED = 12.5%
      expect(result.employerShare).toBe(1250)
    })

    it('total = employee + employer (23%)', () => {
      const result = calculateGOSI(10000, true)
      expect(result.total).toBe(2300)
      expect(result.total).toBe(result.employeeShare + result.employerShare)
    })

    it('includes SANED in breakdown', () => {
      const result = calculateGOSI(10000, true)
      expect(result.breakdown.sanedUnemployment).toBeDefined()
      expect(result.breakdown.sanedUnemployment!.employee).toBe(75)
      expect(result.breakdown.sanedUnemployment!.employer).toBe(75)
    })

    it('correctly calculates annuities (9.75% each)', () => {
      const result = calculateGOSI(10000, true)
      expect(result.breakdown.annuities.employee).toBe(975)
      expect(result.breakdown.annuities.employer).toBe(975)
    })
  })

  describe('Non-Saudi employee', () => {
    it('employee share is 0', () => {
      const result = calculateGOSI(10000, false)
      expect(result.employeeShare).toBe(0)
    })

    it('employer pays only 2% occupational hazards', () => {
      const result = calculateGOSI(10000, false)
      expect(result.employerShare).toBe(200)
      expect(result.total).toBe(200)
    })

    it('annuities are zero', () => {
      const result = calculateGOSI(10000, false)
      expect(result.breakdown.annuities.employee).toBe(0)
      expect(result.breakdown.annuities.employer).toBe(0)
    })
  })

  describe('Edge cases', () => {
    it('returns all zeros for salary <= 0', () => {
      const result = calculateGOSI(0, true)
      expect(result.total).toBe(0)
      expect(result.employeeShare).toBe(0)
      expect(result.employerShare).toBe(0)
    })

    it('returns all zeros for negative salary', () => {
      const result = calculateGOSI(-5000, true)
      expect(result.total).toBe(0)
    })

    it('handles decimal salaries with rounding', () => {
      const result = calculateGOSI(7777.77, true)
      // All amounts should be rounded to 2 decimal places
      expect(result.employeeShare).toBe(Math.round(7777.77 * 0.105 * 100) / 100)
    })
  })
})

// ---------------------------------------------------------------------------
// calculateTenure
// ---------------------------------------------------------------------------

describe('calculateTenure', () => {
  it('calculates years and months from start date', () => {
    const tenure = calculateTenure('2024-04-13')
    expect(tenure.years).toBe(2)
    expect(tenure.months).toBe(0)
  })

  it('handles partial months', () => {
    const tenure = calculateTenure('2025-06-01')
    expect(tenure.years).toBe(0)
    expect(tenure.months).toBeGreaterThanOrEqual(10)
  })

  it('returns zeros for future start date', () => {
    const tenure = calculateTenure('2027-01-01')
    expect(tenure.years).toBe(0)
    expect(tenure.months).toBe(0)
    expect(tenure.totalDays).toBe(0)
  })

  it('returns zeros for invalid date', () => {
    const tenure = calculateTenure('invalid-date')
    expect(tenure.years).toBe(0)
    expect(tenure.totalDays).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getContractExpiryWarning
// ---------------------------------------------------------------------------

describe('getContractExpiryWarning', () => {
  it('returns warning when contract expires within 60 days', () => {
    // Contract started 2024-05-01 → 2-year expiry = 2026-05-01
    // Today is 2026-04-13 → 18 days until expiry → within 60-day window
    const result = getContractExpiryWarning('2024-05-01', 2, 60)
    expect(result).not.toBeNull()
    expect(result!.daysUntilExpiry).toBeLessThanOrEqual(60)
    expect(result!.daysUntilExpiry).toBeGreaterThanOrEqual(0)
  })

  it('returns null when contract is not expiring soon', () => {
    // Contract started 2025-01-01 → expiry 2027-01-01 → >60 days away
    const result = getContractExpiryWarning('2025-01-01', 2, 60)
    expect(result).toBeNull()
  })

  it('returns null for invalid date', () => {
    expect(getContractExpiryWarning('not-a-date')).toBeNull()
  })

  it('returns null when contract already expired (negative days)', () => {
    // Started 2023-01-01, 2-year = expired 2025-01-01
    const result = getContractExpiryWarning('2023-01-01', 2, 60)
    expect(result).toBeNull()
  })
})
