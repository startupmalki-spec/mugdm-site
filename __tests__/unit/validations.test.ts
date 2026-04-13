import { describe, it, expect } from 'vitest'
import {
  isValidCRNumber,
  isValidIqama,
  isValidSaudiPhone,
  formatSaudiPhone,
  maskIqama,
  isSaudiNational,
} from '@/lib/validations'

// ---------------------------------------------------------------------------
// CR Number Validation
// ---------------------------------------------------------------------------

describe('isValidCRNumber', () => {
  it('accepts exactly 10 digits', () => {
    expect(isValidCRNumber('1234567890')).toBe(true)
  })

  it('accepts digits with spaces (stripped)', () => {
    expect(isValidCRNumber('1234 567890')).toBe(true)
  })

  it('rejects 9 digits', () => {
    expect(isValidCRNumber('123456789')).toBe(false)
  })

  it('rejects 11 digits', () => {
    expect(isValidCRNumber('12345678901')).toBe(false)
  })

  it('rejects letters', () => {
    expect(isValidCRNumber('12345abcde')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidCRNumber('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Iqama Validation
// ---------------------------------------------------------------------------

describe('isValidIqama', () => {
  it('accepts 10 digits starting with 1 (Saudi)', () => {
    expect(isValidIqama('1234567890')).toBe(true)
  })

  it('accepts 10 digits starting with 2 (non-Saudi)', () => {
    expect(isValidIqama('2123456789')).toBe(true)
  })

  it('rejects starting with 0', () => {
    expect(isValidIqama('0123456789')).toBe(false)
  })

  it('rejects starting with 3', () => {
    expect(isValidIqama('3123456789')).toBe(false)
  })

  it('rejects wrong length', () => {
    expect(isValidIqama('12345')).toBe(false)
  })

  it('rejects non-digits', () => {
    expect(isValidIqama('123456789a')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Saudi Phone Validation
// ---------------------------------------------------------------------------

describe('isValidSaudiPhone', () => {
  it('accepts +966 5XXXXXXXX (mobile)', () => {
    expect(isValidSaudiPhone('+966512345678')).toBe(true)
  })

  it('accepts 966 5XXXXXXXX (no plus)', () => {
    expect(isValidSaudiPhone('966512345678')).toBe(true)
  })

  it('accepts 05XXXXXXXX (local mobile)', () => {
    expect(isValidSaudiPhone('0512345678')).toBe(true)
  })

  it('accepts 5XXXXXXXX (short)', () => {
    expect(isValidSaudiPhone('512345678')).toBe(true)
  })

  it('accepts landline +966 1XXXXXXXX', () => {
    expect(isValidSaudiPhone('+966112345678')).toBe(true)
  })

  it('accepts with dashes and spaces', () => {
    expect(isValidSaudiPhone('+966 51-234-5678')).toBe(true)
  })

  it('rejects international non-Saudi number', () => {
    expect(isValidSaudiPhone('+1234567890')).toBe(false)
  })

  it('rejects too short', () => {
    expect(isValidSaudiPhone('0512')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// formatSaudiPhone
// ---------------------------------------------------------------------------

describe('formatSaudiPhone', () => {
  it('formats +966 number with spaces', () => {
    expect(formatSaudiPhone('966512345678')).toBe('+966 51 234 5678')
  })

  it('formats local 05 number to international format', () => {
    expect(formatSaudiPhone('0512345678')).toBe('+966 51 234 5678')
  })

  it('returns original for unrecognized format', () => {
    expect(formatSaudiPhone('12345')).toBe('12345')
  })
})

// ---------------------------------------------------------------------------
// maskIqama
// ---------------------------------------------------------------------------

describe('maskIqama', () => {
  it('masks first 3 digits with ***', () => {
    expect(maskIqama('1234567890')).toBe('***4567890')
  })

  it('returns short strings as-is', () => {
    expect(maskIqama('12')).toBe('12')
  })
})

// ---------------------------------------------------------------------------
// isSaudiNational
// ---------------------------------------------------------------------------

describe('isSaudiNational', () => {
  it('returns true for iqama starting with 1', () => {
    expect(isSaudiNational('1234567890')).toBe(true)
  })

  it('returns false for iqama starting with 2', () => {
    expect(isSaudiNational('2123456789')).toBe(false)
  })
})
