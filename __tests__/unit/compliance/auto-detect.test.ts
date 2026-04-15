import { describe, it, expect } from 'vitest'
import { detectComplianceImplications } from '@/lib/compliance/auto-detect'

describe('detectComplianceImplications', () => {
  it('should return BALADY suggestion for LEASE documents', () => {
    const suggestions = detectComplianceImplications('LEASE', {})
    expect(suggestions.some((s) => s.obligationType === 'BALADY')).toBe(true)
  })

  it('should return INSURANCE suggestion for INSURANCE documents', () => {
    const suggestions = detectComplianceImplications('INSURANCE', {})
    expect(suggestions.some((s) => s.obligationType === 'INSURANCE')).toBe(true)
  })

  it('should return GOSI suggestion for GOSI_CERT documents', () => {
    const suggestions = detectComplianceImplications('GOSI_CERT', {})
    expect(suggestions.some((s) => s.obligationType === 'GOSI')).toBe(true)
  })

  it('should return CR_CONFIRMATION suggestion for CR documents', () => {
    const suggestions = detectComplianceImplications('CR', {})
    expect(suggestions.some((s) => s.obligationType === 'CR_CONFIRMATION')).toBe(true)
  })

  it('should return ZAKAT suggestion for ZAKAT_CLEARANCE documents', () => {
    const suggestions = detectComplianceImplications('ZAKAT_CLEARANCE', {})
    expect(suggestions.some((s) => s.obligationType === 'ZAKAT')).toBe(true)
  })

  it('should return CHAMBER suggestion for CHAMBER documents', () => {
    const suggestions = detectComplianceImplications('CHAMBER', {})
    expect(suggestions.some((s) => s.obligationType === 'CHAMBER')).toBe(true)
  })

  it('should return BALADY suggestion for BALADY documents', () => {
    const suggestions = detectComplianceImplications('BALADY', {})
    expect(suggestions.some((s) => s.obligationType === 'BALADY')).toBe(true)
  })

  it('should return MISA suggestion for MISA documents', () => {
    const suggestions = detectComplianceImplications('MISA', {})
    expect(suggestions.some((s) => s.obligationType === 'MISA')).toBe(true)
  })

  it('should return empty for OTHER documents without expiry', () => {
    const suggestions = detectComplianceImplications('OTHER', {})
    expect(suggestions.length).toBe(0)
  })

  it('should return empty for BANK_STATEMENT even with expiry', () => {
    const suggestions = detectComplianceImplications('BANK_STATEMENT', {
      expiryDate: '2027-01-01',
    })
    expect(suggestions.length).toBe(0)
  })

  it('should set autoCreate to false for all suggestions', () => {
    const types = ['CR', 'GOSI_CERT', 'LEASE', 'INSURANCE', 'CHAMBER'] as const
    for (const type of types) {
      const suggestions = detectComplianceImplications(type, {})
      for (const s of suggestions) {
        expect(s.autoCreate).toBe(false)
      }
    }
  })

  it('should include bilingual suggestions', () => {
    const suggestions = detectComplianceImplications('CR', {})
    for (const s of suggestions) {
      expect(s.suggestion).toBeTruthy()
      expect(s.suggestionAr).toBeTruthy()
    }
  })

  it('should add expiry reminder for documents with expiry date', () => {
    const suggestions = detectComplianceImplications('OTHER', {
      expiryDate: '2027-06-15',
    })
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions.some((s) => s.suggestion.includes('expiry'))).toBe(true)
  })
})
