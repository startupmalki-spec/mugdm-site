import { describe, it, expect } from 'vitest'

import { classifyByIsic } from '@/lib/compliance/isic-rules'
import { generateObligationsWithApplicability } from '@/lib/compliance/obligation-generator'

function findApplicability(
  results: ReturnType<typeof classifyByIsic>,
  type: string
) {
  return results.find((r) => r.type === type)
}

describe('classifyByIsic', () => {
  it('marks Balady as NOT_APPLICABLE for IT (62xx)', () => {
    const results = classifyByIsic('6201', [])
    const balady = findApplicability(results, 'BALADY')
    expect(balady?.applicability).toBe('NOT_APPLICABLE')
  })

  it('marks Balady as NOT_APPLICABLE for legal/accounting (69xx)', () => {
    const results = classifyByIsic('6920', [])
    expect(findApplicability(results, 'BALADY')?.applicability).toBe(
      'NOT_APPLICABLE'
    )
  })

  it('marks FOOD_SAFETY + BALADY REQUIRED for food (55xx)', () => {
    const results = classifyByIsic('5510', [])
    expect(findApplicability(results, 'FOOD_SAFETY')?.applicability).toBe(
      'REQUIRED'
    )
    expect(findApplicability(results, 'BALADY')?.applicability).toBe('REQUIRED')
  })

  it('marks BALADY REQUIRED for retail (47xx)', () => {
    const results = classifyByIsic('4711', [])
    expect(findApplicability(results, 'BALADY')?.applicability).toBe('REQUIRED')
  })

  it('marks SAFETY_CERT + BALADY REQUIRED for construction (41xx)', () => {
    const results = classifyByIsic('4100', [])
    expect(findApplicability(results, 'SAFETY_CERT')?.applicability).toBe(
      'REQUIRED'
    )
    expect(findApplicability(results, 'BALADY')?.applicability).toBe('REQUIRED')
  })

  it('marks HEALTH_LICENSE + BALADY REQUIRED for health (86xx)', () => {
    const results = classifyByIsic('8610', [])
    expect(findApplicability(results, 'HEALTH_LICENSE')?.applicability).toBe(
      'REQUIRED'
    )
    expect(findApplicability(results, 'BALADY')?.applicability).toBe('REQUIRED')
  })

  it('keeps universal obligations REQUIRED regardless of ISIC', () => {
    const results = classifyByIsic('6201', [])
    for (const t of ['CR_CONFIRMATION', 'GOSI', 'ZATCA_VAT', 'CHAMBER', 'ZAKAT']) {
      expect(findApplicability(results, t)?.applicability).toBe('REQUIRED')
    }
  })

  it('defaults non-universal to SUGGESTED when no ISIC match', () => {
    const results = classifyByIsic('9999', [])
    expect(findApplicability(results, 'BALADY')?.applicability).toBe('SUGGESTED')
    expect(findApplicability(results, 'FOOD_SAFETY')?.applicability).toBe(
      'SUGGESTED'
    )
  })

  it('uses sub-activity codes when main is ambiguous', () => {
    const results = classifyByIsic(null, ['5610'])
    expect(findApplicability(results, 'FOOD_SAFETY')?.applicability).toBe(
      'REQUIRED'
    )
  })

  it('provides bilingual reasons', () => {
    const results = classifyByIsic('5610', [])
    const food = findApplicability(results, 'FOOD_SAFETY')
    expect(food?.reason.en).toBeTruthy()
    expect(food?.reason.ar).toBeTruthy()
  })
})

describe('generateObligationsWithApplicability — missing ISIC falls back', () => {
  it('marks business-type obligations SUGGESTED when ISIC is missing', () => {
    const obligations = generateObligationsWithApplicability({
      crNumber: '1010000000',
      businessName: 'Test',
      activityType: 'food restaurant',
      expiryDate: '2030-01-01',
      city: 'Riyadh',
      isicCode: null,
      subActivityCodes: [],
    })
    const food = obligations.find((o) => o.type === 'FOOD_SAFETY')
    expect(food).toBeDefined()
    expect(food?.applicability).toBe('SUGGESTED')
  })

  it('keeps universal obligations REQUIRED without ISIC', () => {
    const obligations = generateObligationsWithApplicability({
      crNumber: '1010000000',
      businessName: 'Test',
      activityType: null,
      expiryDate: '2030-01-01',
      city: null,
    })
    const gosi = obligations.find((o) => o.type === 'GOSI')
    expect(gosi?.applicability).toBe('REQUIRED')
  })
})

describe('generateObligationsWithApplicability — hasPhysicalLocation downgrade', () => {
  it('downgrades Balady REQUIRED → SUGGESTED when hasPhysicalLocation=false', () => {
    const obligations = generateObligationsWithApplicability({
      crNumber: '1010000000',
      businessName: 'Test',
      activityType: 'retail',
      expiryDate: '2030-01-01',
      city: 'Riyadh',
      isicCode: '4711',
      subActivityCodes: [],
      hasPhysicalLocation: false,
    })
    const balady = obligations.find((o) => o.type === 'BALADY')
    expect(balady).toBeDefined()
    expect(balady?.applicability).toBe('SUGGESTED')
    expect(balady?.reason?.en).toMatch(/physical premises/i)
  })

  it('keeps Balady REQUIRED when hasPhysicalLocation=true', () => {
    const obligations = generateObligationsWithApplicability({
      crNumber: '1010000000',
      businessName: 'Test',
      activityType: 'retail',
      expiryDate: '2030-01-01',
      city: 'Riyadh',
      isicCode: '4711',
      subActivityCodes: [],
      hasPhysicalLocation: true,
    })
    const balady = obligations.find((o) => o.type === 'BALADY')
    expect(balady?.applicability).toBe('REQUIRED')
  })

  it('filters out Balady entirely for IT (NOT_APPLICABLE)', () => {
    const obligations = generateObligationsWithApplicability({
      crNumber: '1010000000',
      businessName: 'Test',
      activityType: 'software',
      expiryDate: '2030-01-01',
      city: 'Riyadh',
      isicCode: '6201',
      subActivityCodes: [],
    })
    const balady = obligations.find((o) => o.type === 'BALADY')
    expect(balady).toBeUndefined()
  })
})

describe('generateObligationsWithApplicability — VAT frequency', () => {
  it('skips VAT when revenue below 375K SAR', () => {
    const obligations = generateObligationsWithApplicability({
      crNumber: '1010000000',
      businessName: 'Test',
      activityType: null,
      expiryDate: '2030-01-01',
      city: null,
      annualRevenue: 100_000,
    })
    expect(obligations.find((o) => o.type === 'ZATCA_VAT')).toBeUndefined()
  })

  it('uses MONTHLY VAT when revenue above 40M SAR', () => {
    const obligations = generateObligationsWithApplicability({
      crNumber: '1010000000',
      businessName: 'Test',
      activityType: null,
      expiryDate: '2030-01-01',
      city: null,
      annualRevenue: 50_000_000,
    })
    const vat = obligations.find((o) => o.type === 'ZATCA_VAT')
    expect(vat?.frequency).toBe('MONTHLY')
  })

  it('uses QUARTERLY VAT when revenue is in mid range', () => {
    const obligations = generateObligationsWithApplicability({
      crNumber: '1010000000',
      businessName: 'Test',
      activityType: null,
      expiryDate: '2030-01-01',
      city: null,
      annualRevenue: 5_000_000,
    })
    const vat = obligations.find((o) => o.type === 'ZATCA_VAT')
    expect(vat?.frequency).toBe('QUARTERLY')
  })
})
