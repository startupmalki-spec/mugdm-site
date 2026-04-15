import { describe, it, expect } from 'vitest'
import { estimatePenalty } from '@/lib/compliance/penalties'

describe('estimatePenalty', () => {
  it('should return zero for non-late obligations (daysLate <= 0)', () => {
    const result = estimatePenalty('GOSI', 0)
    expect(result.amount).toBe(0)
    expect(result.description).toBe('')
  })

  it('should return zero for negative daysLate', () => {
    const result = estimatePenalty('ZATCA_VAT', -5)
    expect(result.amount).toBe(0)
  })

  it('should calculate GOSI penalty at 2% of contribution per month', () => {
    const result = estimatePenalty('GOSI', 30)
    expect(result.amount).toBe(60) // 3000 * 0.02 * 1
    expect(result.description).toContain('2%')
  })

  it('should scale GOSI penalty with months', () => {
    const oneMonth = estimatePenalty('GOSI', 30)
    const threeMonths = estimatePenalty('GOSI', 90)
    expect(threeMonths.amount).toBe(oneMonth.amount * 3)
  })

  it('should calculate ZATCA_VAT penalty with graduated rate', () => {
    const result = estimatePenalty('ZATCA_VAT', 1)
    expect(result.amount).toBe(500) // 10000 * 5%
  })

  it('should cap ZATCA_VAT penalty rate at 25%', () => {
    const result = estimatePenalty('ZATCA_VAT', 365 * 2)
    expect(result.amount).toBe(2500) // 10000 * 25%
  })

  it('should calculate CR_CONFIRMATION penalty', () => {
    const result = estimatePenalty('CR_CONFIRMATION', 1)
    expect(result.amount).toBeGreaterThanOrEqual(500)
    expect(result.amount).toBeLessThanOrEqual(10000)
  })

  it('should cap CR_CONFIRMATION penalty at 10000', () => {
    const result = estimatePenalty('CR_CONFIRMATION', 365 * 5)
    expect(result.amount).toBe(10000)
  })

  it('should calculate BALADY penalty', () => {
    const result = estimatePenalty('BALADY', 30)
    expect(result.amount).toBeGreaterThanOrEqual(1000)
    expect(result.amount).toBeLessThanOrEqual(5000)
  })

  it('should calculate ZAKAT penalty', () => {
    const result = estimatePenalty('ZAKAT', 30)
    expect(result.amount).toBeGreaterThan(0)
    expect(result.description).toContain('Zakat')
  })

  it('should calculate CHAMBER penalty', () => {
    const result = estimatePenalty('CHAMBER', 30)
    expect(result.amount).toBeGreaterThanOrEqual(500)
    expect(result.amount).toBeLessThanOrEqual(2000)
  })

  it('should calculate FOOD_SAFETY penalty', () => {
    const result = estimatePenalty('FOOD_SAFETY', 30)
    expect(result.amount).toBeGreaterThanOrEqual(1000)
  })

  it('should calculate SAFETY_CERT penalty', () => {
    const result = estimatePenalty('SAFETY_CERT', 30)
    expect(result.amount).toBeGreaterThanOrEqual(5000)
  })

  it('should calculate HEALTH_LICENSE penalty', () => {
    const result = estimatePenalty('HEALTH_LICENSE', 30)
    expect(result.amount).toBeGreaterThanOrEqual(10000)
  })

  it('should return generic penalty for CUSTOM type', () => {
    const result = estimatePenalty('CUSTOM', 30)
    expect(result.amount).toBeGreaterThan(0)
    expect(result.description).toContain('late')
  })

  it('should return generic penalty for MISA type', () => {
    const result = estimatePenalty('MISA', 60)
    expect(result.amount).toBeGreaterThan(0)
  })

  it('should return generic penalty for INSURANCE type', () => {
    const result = estimatePenalty('INSURANCE', 15)
    expect(result.amount).toBeGreaterThan(0)
  })

  it('should always return a positive amount for daysLate > 0', () => {
    const types = ['GOSI', 'ZATCA_VAT', 'CR_CONFIRMATION', 'BALADY', 'ZAKAT', 'CHAMBER', 'CUSTOM'] as const
    for (const type of types) {
      const result = estimatePenalty(type, 1)
      expect(result.amount).toBeGreaterThan(0)
    }
  })

  it('should treat 1 day late as 1 month for calculation', () => {
    const oneDay = estimatePenalty('GOSI', 1)
    const thirtyDays = estimatePenalty('GOSI', 30)
    expect(oneDay.amount).toBe(thirtyDays.amount)
  })
})
