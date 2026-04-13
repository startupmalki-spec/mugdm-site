import { describe, it, expect } from 'vitest'
import { toHijri, formatHijri, toArabicNumerals } from '@/lib/hijri'

// ---------------------------------------------------------------------------
// toHijri — Known date pairs (Gregorian → Hijri)
// ---------------------------------------------------------------------------

describe('toHijri', () => {
  it('converts a known date: 2026-03-27 ≈ 28 Ramadan 1447', () => {
    const hijri = toHijri(new Date('2026-03-27'))
    expect(hijri.year).toBe(1447)
    expect(hijri.month).toBe(9) // Ramadan
    // Allow +/- 1 day tolerance per the algorithm's documented accuracy
    expect(hijri.day).toBeGreaterThanOrEqual(27)
    expect(hijri.day).toBeLessThanOrEqual(29)
  })

  it('converts Jan 1 2026 to a Hijri date in 1447', () => {
    const hijri = toHijri(new Date('2026-01-01'))
    expect(hijri.year).toBe(1447)
    expect(hijri.month).toBeGreaterThanOrEqual(1)
    expect(hijri.day).toBeGreaterThanOrEqual(1)
  })

  it('returns valid day/month ranges', () => {
    const hijri = toHijri(new Date('2026-06-15'))
    expect(hijri.month).toBeGreaterThanOrEqual(1)
    expect(hijri.month).toBeLessThanOrEqual(12)
    expect(hijri.day).toBeGreaterThanOrEqual(1)
    expect(hijri.day).toBeLessThanOrEqual(30)
  })
})

// ---------------------------------------------------------------------------
// formatHijri
// ---------------------------------------------------------------------------

describe('formatHijri', () => {
  it('formats in English with English month name', () => {
    const formatted = formatHijri({ year: 1447, month: 9, day: 1 }, 'en')
    expect(formatted).toBe('1 Ramadan 1447')
  })

  it('formats in Arabic with Arabic month name and numerals', () => {
    const formatted = formatHijri({ year: 1447, month: 9, day: 1 }, 'ar')
    expect(formatted).toContain('رمضان')
    expect(formatted).toContain('١') // Arabic numeral for 1
  })

  it('uses correct month names for all 12 months in English', () => {
    const expectedMonths = [
      'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
      'Jumada al-Ula', 'Jumada al-Thani', 'Rajab', 'Shaaban',
      'Ramadan', 'Shawwal', 'Dhul Qadah', 'Dhul Hijjah',
    ]
    for (let i = 0; i < 12; i++) {
      const formatted = formatHijri({ year: 1447, month: i + 1, day: 1 }, 'en')
      expect(formatted).toContain(expectedMonths[i])
    }
  })
})

// ---------------------------------------------------------------------------
// toArabicNumerals
// ---------------------------------------------------------------------------

describe('toArabicNumerals', () => {
  it('converts 0-9 to Arabic-Indic numerals', () => {
    expect(toArabicNumerals('0123456789')).toBe('٠١٢٣٤٥٦٧٨٩')
  })

  it('leaves non-numeric characters unchanged', () => {
    expect(toArabicNumerals('abc')).toBe('abc')
  })

  it('handles mixed text and numbers', () => {
    expect(toArabicNumerals('Day 15')).toBe('Day ١٥')
  })
})
