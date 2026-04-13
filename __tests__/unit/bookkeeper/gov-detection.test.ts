import { describe, it, expect } from 'vitest'
import { detectGovernmentPayment } from '@/lib/bookkeeper/gov-detection'

describe('detectGovernmentPayment', () => {
  it('returns isGovernment=false for empty input', () => {
    const result = detectGovernmentPayment({ description: '', vendor_or_client: '' })
    expect(result.isGovernment).toBe(false)
    expect(result.confidence).toBe(0)
  })

  it('returns isGovernment=false for null input', () => {
    const result = detectGovernmentPayment({ description: null, vendor_or_client: null })
    expect(result.isGovernment).toBe(false)
  })

  // --- Exact pattern matches (confidence 1.0) ---

  it('detects GOSI from Arabic exact pattern', () => {
    const result = detectGovernmentPayment({
      description: 'دفعة التأمينات الاجتماعية',
      vendor_or_client: null,
    })
    expect(result.isGovernment).toBe(true)
    expect(result.obligationType).toBe('GOSI')
    expect(result.confidence).toBe(1.0)
  })

  it('detects ZATCA from Arabic exact pattern', () => {
    const result = detectGovernmentPayment({
      description: 'دفعة هيئة الزكاة',
      vendor_or_client: null,
    })
    expect(result.isGovernment).toBe(true)
    expect(result.obligationType).toBe('ZATCA_VAT')
    expect(result.confidence).toBe(1.0)
  })

  it('detects BALADY from English exact pattern', () => {
    const result = detectGovernmentPayment({
      description: 'Municipality license renewal',
      vendor_or_client: null,
    })
    expect(result.isGovernment).toBe(true)
    expect(result.obligationType).toBe('BALADY')
    expect(result.confidence).toBe(1.0)
  })

  it('detects CHAMBER from Arabic exact pattern', () => {
    const result = detectGovernmentPayment({
      description: 'رسوم الغرفة التجارية',
      vendor_or_client: null,
    })
    expect(result.isGovernment).toBe(true)
    expect(result.obligationType).toBe('CHAMBER')
    expect(result.confidence).toBe(1.0)
  })

  // --- Keyword matches (confidence 0.7) ---

  it('detects GOSI from English keyword', () => {
    const result = detectGovernmentPayment({
      description: 'GOSI monthly payment',
      vendor_or_client: null,
    })
    expect(result.isGovernment).toBe(true)
    expect(result.obligationType).toBe('GOSI')
    expect(result.confidence).toBe(0.7)
  })

  it('detects ZATCA from English keyword', () => {
    const result = detectGovernmentPayment({
      description: 'ZATCA VAT filing',
      vendor_or_client: null,
    })
    expect(result.isGovernment).toBe(true)
    expect(result.obligationType).toBe('ZATCA_VAT')
    expect(result.confidence).toBe(0.7)
  })

  it('detects QIWA from keyword', () => {
    const result = detectGovernmentPayment({
      description: null,
      vendor_or_client: 'Qiwa platform fees',
    })
    expect(result.isGovernment).toBe(true)
    expect(result.obligationType).toBe('QIWA')
    expect(result.confidence).toBe(0.7)
  })

  // --- Insurance detection ---

  it('detects INSURANCE from vendor name', () => {
    const result = detectGovernmentPayment({
      description: 'Annual premium',
      vendor_or_client: 'Bupa Arabia',
    })
    expect(result.isGovernment).toBe(true)
    expect(result.obligationType).toBe('INSURANCE')
  })

  // --- No match ---

  it('does not flag regular business transactions', () => {
    const result = detectGovernmentPayment({
      description: 'Office supplies from Jarir',
      vendor_or_client: 'Jarir Bookstore',
    })
    expect(result.isGovernment).toBe(false)
    expect(result.obligationType).toBeNull()
  })

  // --- Reads from both description and vendor ---

  it('matches against vendor_or_client field', () => {
    const result = detectGovernmentPayment({
      description: 'Monthly payment',
      vendor_or_client: 'التأمينات الاجتماعية',
    })
    expect(result.isGovernment).toBe(true)
    expect(result.obligationType).toBe('GOSI')
  })
})
