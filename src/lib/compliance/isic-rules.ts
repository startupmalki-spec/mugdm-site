import type { ObligationType } from '@/lib/supabase/types'

/**
 * ISIC-based obligation applicability rules.
 *
 * Maps ISIC (International Standard Industrial Classification) code prefixes
 * to which Saudi compliance obligations are REQUIRED, NOT_APPLICABLE, or merely
 * SUGGESTED for a given business.
 *
 * The Wathq API returns `main_activity_code` (ISIC) and `sub_activities`
 * (additional ISIC codes) — we pass those through to classify obligations.
 */

export type Applicability = 'REQUIRED' | 'NOT_APPLICABLE' | 'SUGGESTED'

export interface ApplicabilityResult {
  type: ObligationType
  applicability: Applicability
  reason: { ar: string; en: string }
}

/* ───────── Reason strings ───────── */

const REASONS = {
  universalRequired: {
    en: 'Required for all registered Saudi businesses.',
    ar: 'إلزامي لجميع المنشآت المسجلة في المملكة.',
  },
  balady_notApplicable_digital: {
    en: 'Digital / professional service — typically no physical storefront, so Balady is not required.',
    ar: 'نشاط رقمي / مهني — غالباً بدون مقر فعلي، لذلك الرخصة البلدية غير مطلوبة.',
  },
  balady_required_food: {
    en: 'Food & accommodation businesses must hold a Balady license.',
    ar: 'منشآت الغذاء والضيافة يلزمها رخصة بلدية.',
  },
  balady_required_construction: {
    en: 'Construction businesses must hold a Balady license.',
    ar: 'منشآت المقاولات والبناء يلزمها رخصة بلدية.',
  },
  balady_required_health: {
    en: 'Health facilities must hold a Balady license.',
    ar: 'المنشآت الصحية يلزمها رخصة بلدية.',
  },
  balady_required_retail: {
    en: 'Retail businesses must hold a Balady license.',
    ar: 'منشآت التجزئة يلزمها رخصة بلدية.',
  },
  foodSafety_required: {
    en: 'Food & accommodation businesses are subject to SFDA food safety inspections.',
    ar: 'منشآت الغذاء والضيافة تخضع لتفتيش سلامة الغذاء من هيئة الغذاء والدواء.',
  },
  suggested_default: {
    en: 'We think this may apply — please confirm.',
    ar: 'نعتقد أن هذا قد ينطبق — يرجى التأكيد.',
  },
  noPhysicalPremises: {
    en: 'Confirm if you have physical premises.',
    ar: 'يرجى التأكيد إذا كان لديك مقر فعلي.',
  },
} as const

/* ───────── Universal obligations ───────── */

const UNIVERSAL_REQUIRED: ObligationType[] = [
  'CR_CONFIRMATION',
  'GOSI',
  'ZATCA_VAT',
  'CHAMBER',
  'ZAKAT',
]

/** All obligation types that the generator can emit. */
const ALL_OBLIGATION_TYPES: ObligationType[] = [
  'CR_CONFIRMATION',
  'GOSI',
  'ZATCA_VAT',
  'CHAMBER',
  'ZAKAT',
  'BALADY',
  'MISA',
  'INSURANCE',
  'QIWA',
  'FOOD_SAFETY',
  'SAFETY_CERT',
  'HEALTH_LICENSE',
]

/* ───────── ISIC prefix classifiers ───────── */

/** Extract the 2-digit division from an ISIC code (e.g. "6201" → 62). */
function isicDivision(code: string | null): number | null {
  if (!code) return null
  const digits = code.replace(/\D/g, '')
  if (digits.length < 2) return null
  const n = parseInt(digits.slice(0, 2), 10)
  return Number.isFinite(n) ? n : null
}

function isDigital(division: number | null): boolean {
  if (division === null) return false
  // 62xx IT, 63xx info services; 64-66xx financial; 69xx legal/accounting
  return (
    (division >= 62 && division <= 63) ||
    (division >= 64 && division <= 66) ||
    division === 69
  )
}

function isFoodAccommodation(division: number | null): boolean {
  return division !== null && division >= 55 && division <= 56
}

function isConstruction(division: number | null): boolean {
  return division !== null && division >= 41 && division <= 43
}

function isHealth(division: number | null): boolean {
  return division === 86
}

function isRetail(division: number | null): boolean {
  return division === 47
}

/* ───────── Public classifier ───────── */

/**
 * Classify every ObligationType for a business based on its ISIC code and
 * sub-activities. Returns one ApplicabilityResult per obligation type.
 *
 * Universal obligations (CR_CONFIRMATION, GOSI, ZATCA_VAT, CHAMBER, ZAKAT) are
 * always REQUIRED. Others default to SUGGESTED unless an ISIC rule overrides.
 */
export function classifyByIsic(
  isicCode: string | null,
  subActivities: string[] = []
): ApplicabilityResult[] {
  const divisions: number[] = []
  const mainDiv = isicDivision(isicCode)
  if (mainDiv !== null) divisions.push(mainDiv)
  for (const sub of subActivities) {
    const d = isicDivision(sub)
    if (d !== null) divisions.push(d)
  }

  // Aggregate indicators across main + sub-activities.
  const anyDigital = divisions.some(isDigital)
  const anyFood = divisions.some(isFoodAccommodation)
  const anyConstruction = divisions.some(isConstruction)
  const anyHealth = divisions.some(isHealth)
  const anyRetail = divisions.some(isRetail)
  const hasAnyIsic = divisions.length > 0

  const results: ApplicabilityResult[] = []

  for (const type of ALL_OBLIGATION_TYPES) {
    // Universal REQUIRED
    if (UNIVERSAL_REQUIRED.includes(type)) {
      results.push({
        type,
        applicability: 'REQUIRED',
        reason: REASONS.universalRequired,
      })
      continue
    }

    // BALADY — conditional on physical-location activities
    if (type === 'BALADY') {
      if (anyFood) {
        results.push({ type, applicability: 'REQUIRED', reason: REASONS.balady_required_food })
      } else if (anyConstruction) {
        results.push({ type, applicability: 'REQUIRED', reason: REASONS.balady_required_construction })
      } else if (anyHealth) {
        results.push({ type, applicability: 'REQUIRED', reason: REASONS.balady_required_health })
      } else if (anyRetail) {
        results.push({ type, applicability: 'REQUIRED', reason: REASONS.balady_required_retail })
      } else if (anyDigital && hasAnyIsic) {
        // IT / financial / legal — explicitly NOT_APPLICABLE
        results.push({ type, applicability: 'NOT_APPLICABLE', reason: REASONS.balady_notApplicable_digital })
      } else {
        results.push({ type, applicability: 'SUGGESTED', reason: REASONS.suggested_default })
      }
      continue
    }

    // FOOD_SAFETY — required for 55xx/56xx
    if (type === 'FOOD_SAFETY') {
      if (anyFood) {
        results.push({ type, applicability: 'REQUIRED', reason: REASONS.foodSafety_required })
      } else {
        results.push({ type, applicability: 'SUGGESTED', reason: REASONS.suggested_default })
      }
      continue
    }

    // SAFETY_CERT — required for construction (41-43)
    if (type === 'SAFETY_CERT') {
      if (anyConstruction) {
        results.push({
          type,
          applicability: 'REQUIRED',
          reason: {
            en: 'Construction businesses need an annual safety certificate.',
            ar: 'منشآت المقاولات تحتاج شهادة سلامة سنوية.',
          },
        })
      } else {
        results.push({ type, applicability: 'SUGGESTED', reason: REASONS.suggested_default })
      }
      continue
    }

    // HEALTH_LICENSE — required for human health (86)
    if (type === 'HEALTH_LICENSE') {
      if (anyHealth) {
        results.push({
          type,
          applicability: 'REQUIRED',
          reason: {
            en: 'Health facilities need an annual Ministry of Health license.',
            ar: 'المنشآت الصحية تحتاج ترخيص وزارة الصحة سنوياً.',
          },
        })
      } else {
        results.push({ type, applicability: 'SUGGESTED', reason: REASONS.suggested_default })
      }
      continue
    }

    // MISA, INSURANCE, QIWA — no ISIC-based auto-required rule yet; default SUGGESTED.
    results.push({ type, applicability: 'SUGGESTED', reason: REASONS.suggested_default })
  }

  return results
}

export const ISIC_REASONS = REASONS
