import { describe, it, expect } from 'vitest'
import { categorizeTransaction } from '@/lib/bookkeeper/smart-categorizer'

describe('categorizeTransaction', () => {
  // --- Saudi utility providers ---

  it('categorizes STC as UTILITIES', () => {
    const result = categorizeTransaction('STC monthly bill', 'STC')
    expect(result.category).toBe('UTILITIES')
    expect(result.source).toBe('rule')
  })

  it('categorizes Mobily as UTILITIES', () => {
    const result = categorizeTransaction('موبايلي اشتراك', '')
    expect(result.category).toBe('UTILITIES')
  })

  it('categorizes Saudi Electricity as UTILITIES', () => {
    const result = categorizeTransaction('Saudi Electricity Company bill', '')
    expect(result.category).toBe('UTILITIES')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  // --- Government entities ---

  it('categorizes GOSI as GOVERNMENT', () => {
    const result = categorizeTransaction('GOSI contribution', '')
    expect(result.category).toBe('GOVERNMENT')
  })

  it('categorizes ZATCA as GOVERNMENT', () => {
    const result = categorizeTransaction('الزكاة والضريبة payment', '')
    expect(result.category).toBe('GOVERNMENT')
  })

  it('categorizes SADAD as GOVERNMENT', () => {
    const result = categorizeTransaction('SADAD payment #123456', '')
    expect(result.category).toBe('GOVERNMENT')
  })

  // --- Salary ---

  it('categorizes salary transfers as SALARY', () => {
    const result = categorizeTransaction('راتب شهر مارس', '')
    expect(result.category).toBe('SALARY')
  })

  it('categorizes WPS as SALARY', () => {
    const result = categorizeTransaction('WPS transfer', '')
    expect(result.category).toBe('SALARY')
  })

  // --- Transport ---

  it('categorizes Aramco fuel as TRANSPORT', () => {
    const result = categorizeTransaction('Aramco fuel station', '')
    expect(result.category).toBe('TRANSPORT')
  })

  it('categorizes shipping companies as TRANSPORT', () => {
    const result = categorizeTransaction('DHL shipment', '')
    expect(result.category).toBe('TRANSPORT')
  })

  // --- Rent ---

  it('categorizes rent/ejar as RENT', () => {
    const result = categorizeTransaction('إيجار مكتب', '')
    expect(result.category).toBe('RENT')
  })

  // --- Insurance ---

  it('categorizes Tawuniya as INSURANCE', () => {
    const result = categorizeTransaction('', 'Tawuniya cooperative insurance')
    expect(result.category).toBe('INSURANCE')
  })

  // --- Marketing ---

  it('categorizes Google Ads as MARKETING', () => {
    const result = categorizeTransaction('Google Ads campaign', '')
    expect(result.category).toBe('MARKETING')
  })

  // --- Default fallback ---

  it('falls back to OTHER_EXPENSE for unknown transactions', () => {
    const result = categorizeTransaction('Random purchase XYZ', '')
    expect(result.category).toBe('OTHER_EXPENSE')
    expect(result.confidence).toBeLessThan(0.5)
    expect(result.source).toBe('default')
  })

  it('falls back to OTHER_EXPENSE for empty input', () => {
    const result = categorizeTransaction('', '')
    expect(result.category).toBe('OTHER_EXPENSE')
  })
})
