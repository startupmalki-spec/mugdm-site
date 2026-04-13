import {
  addMonths,
  addDays,
  setDate,
  isBefore,
  startOfDay,
} from 'date-fns'

import { getNextOccurrence, buildSeed } from '@/lib/compliance/rules-engine'
import type { ObligationFrequency, ObligationType } from '@/lib/supabase/types'
import type { ObligationSeed } from '@/lib/compliance/rules-engine'
import {
  classifyByIsic,
  type Applicability,
  type ApplicabilityResult,
} from '@/lib/compliance/isic-rules'

/* ───────── Public interface ───────── */

export interface CRData {
  crNumber: string
  businessName: string
  activityType: string | null
  expiryDate: string | null
  city: string | null
  /** ISIC main activity code from Wathq (e.g. "6201"). */
  isicCode?: string | null
  /** ISIC sub-activity codes from Wathq. */
  subActivityCodes?: string[]
  /**
   * Whether the business has physical premises. `null` means unknown (we will
   * default to conservative behavior for location-dependent obligations).
   */
  hasPhysicalLocation?: boolean | null
  /**
   * Annual revenue in SAR. When unknown, Wathq `capital` is used as a proxy —
   * callers pass `capital` here if no revenue data is available.
   */
  annualRevenue?: number | null
}

export interface GeneratedObligation {
  type: ObligationType
  name: string
  description: string
  frequency: ObligationFrequency
  next_due_date: string
  /** Optional — present when generated via the applicability-aware pipeline. */
  applicability?: Applicability
  /** Optional bilingual rationale for SUGGESTED/NOT_APPLICABLE labels. */
  reason?: { ar: string; en: string }
}

/* ───────── Activity-type matchers ───────── */

const FOOD_KEYWORDS = ['food', 'restaurant', 'مطعم', 'مطاعم', 'أغذية', 'غذائي']
const CONSTRUCTION_KEYWORDS = ['construction', 'مقاولات', 'بناء', 'إنشاء', 'تشييد']
const MEDICAL_KEYWORDS = ['medical', 'طبي', 'طبية', 'صحي', 'صحية', 'مستشفى', 'عيادة']

function activityMatches(activityType: string | null, keywords: string[]): boolean {
  if (!activityType) return false
  const lower = activityType.toLowerCase()
  return keywords.some((kw) => lower.includes(kw.toLowerCase()))
}

/* ───────── Helpers ───────── */

/** Advance a date forward by the given frequency until it is on or after today. */
function advanceToFuture(
  baseDate: Date,
  frequency: ObligationFrequency
): Date {
  return getNextOccurrence(frequency, baseDate)
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

/* ───────── Generator ───────── */

/**
 * Given CR data extracted during onboarding, generate ALL relevant Saudi
 * compliance obligations for the business.
 */
export function generateObligationsFromCR(crData: CRData): GeneratedObligation[] {
  const obligations: GeneratedObligation[] = []
  const today = startOfDay(new Date())

  // ── 1. CR Confirmation — Annual, due on CR expiry date ──
  if (crData.expiryDate) {
    const crExpiry = new Date(crData.expiryDate)
    const nextCr = advanceToFuture(crExpiry, 'ANNUAL')
    obligations.push({
      type: 'CR_CONFIRMATION',
      name: 'CR Confirmation',
      description:
        'Annual Commercial Registration confirmation with the Ministry of Commerce',
      frequency: 'ANNUAL',
      next_due_date: toDateString(nextCr),
    })
  }

  // ── 2. GOSI — Monthly, due 15th of each month ──
  {
    const nextMonth = isBefore(setDate(today, 15), today)
      ? addMonths(today, 1)
      : today
    const gosiDate = setDate(nextMonth, 15)
    obligations.push({
      type: 'GOSI',
      name: 'GOSI Payment',
      description:
        'Monthly General Organization for Social Insurance payment',
      frequency: 'MONTHLY',
      next_due_date: toDateString(gosiDate),
    })
  }

  // ── 3. ZATCA VAT — Quarterly, due end of quarter month ──
  // Quarter end months: Mar (2), Jun (5), Sep (8), Dec (11)
  {
    const quarterEndMonths = [2, 5, 8, 11]
    const quarterEndDays = [31, 30, 30, 31] // Mar, Jun, Sep, Dec
    let nextVatDate: Date | null = null

    for (let yearOffset = 0; yearOffset <= 1 && !nextVatDate; yearOffset++) {
      const year = today.getFullYear() + yearOffset
      for (let i = 0; i < quarterEndMonths.length; i++) {
        const candidate = new Date(year, quarterEndMonths[i], quarterEndDays[i])
        if (!isBefore(candidate, today)) {
          nextVatDate = candidate
          break
        }
      }
    }

    if (nextVatDate) {
      obligations.push({
        type: 'ZATCA_VAT',
        name: 'VAT Return Filing',
        description:
          'Quarterly VAT return filing with ZATCA (assumes revenue above 375K SAR threshold)',
        frequency: 'QUARTERLY',
        next_due_date: toDateString(nextVatDate),
      })
    }
  }

  // ── 4. Zakat — Annual, 120 days after fiscal year end (Dec 31) ──
  {
    const currentFYEnd = new Date(today.getFullYear(), 11, 31)
    const zakatBase = addDays(currentFYEnd, 120)
    const nextZakat = advanceToFuture(zakatBase, 'ANNUAL')
    obligations.push({
      type: 'ZAKAT',
      name: 'Zakat Filing',
      description:
        'Annual Zakat declaration filing with ZATCA (120 days after fiscal year end)',
      frequency: 'ANNUAL',
      next_due_date: toDateString(nextZakat),
    })
  }

  // ── 5. Chamber of Commerce — Annual, same as CR expiry ──
  if (crData.expiryDate) {
    const crExpiry = new Date(crData.expiryDate)
    const nextChamber = advanceToFuture(crExpiry, 'ANNUAL')
    obligations.push({
      type: 'CHAMBER',
      name: 'Chamber of Commerce Renewal',
      description: 'Annual Chamber of Commerce membership renewal',
      frequency: 'ANNUAL',
      next_due_date: toDateString(nextChamber),
    })
  }

  // ── 6. Balady License — Annual, assume physical location ──
  {
    // Base on January 1 of next year if no specific date; city-dependent in
    // practice but we use a sensible default.
    const baladyBase = crData.expiryDate
      ? new Date(crData.expiryDate)
      : new Date(today.getFullYear() + 1, 0, 1)
    const nextBalady = advanceToFuture(baladyBase, 'ANNUAL')
    obligations.push({
      type: 'BALADY',
      name: 'Balady License Renewal',
      description: `Annual municipal (Balady) license renewal${crData.city ? ` — ${crData.city}` : ''}`,
      frequency: 'ANNUAL',
      next_due_date: toDateString(nextBalady),
    })
  }

  // ── Business-type-specific obligations ──

  // Food Safety inspection — quarterly
  if (activityMatches(crData.activityType, FOOD_KEYWORDS)) {
    const quarterEndMonths = [2, 5, 8, 11]
    const quarterEndDays = [31, 30, 30, 31]
    let nextInspection: Date | null = null

    for (let yearOffset = 0; yearOffset <= 1 && !nextInspection; yearOffset++) {
      const year = today.getFullYear() + yearOffset
      for (let i = 0; i < quarterEndMonths.length; i++) {
        const candidate = new Date(year, quarterEndMonths[i], quarterEndDays[i])
        if (!isBefore(candidate, today)) {
          nextInspection = candidate
          break
        }
      }
    }

    if (nextInspection) {
      obligations.push({
        type: 'FOOD_SAFETY',
        name: 'Food Safety Inspection',
        description:
          'Quarterly food safety inspection by the Saudi Food & Drug Authority (SFDA)',
        frequency: 'QUARTERLY',
        next_due_date: toDateString(nextInspection),
      })
    }
  }

  // Safety Certificate — annual (construction)
  if (activityMatches(crData.activityType, CONSTRUCTION_KEYWORDS)) {
    const safetyBase = crData.expiryDate
      ? new Date(crData.expiryDate)
      : new Date(today.getFullYear() + 1, 0, 1)
    const nextSafety = advanceToFuture(safetyBase, 'ANNUAL')
    obligations.push({
      type: 'SAFETY_CERT',
      name: 'Safety Certificate Renewal',
      description:
        'Annual safety certificate renewal for construction activities',
      frequency: 'ANNUAL',
      next_due_date: toDateString(nextSafety),
    })
  }

  // Health License — annual (medical)
  if (activityMatches(crData.activityType, MEDICAL_KEYWORDS)) {
    const healthBase = crData.expiryDate
      ? new Date(crData.expiryDate)
      : new Date(today.getFullYear() + 1, 0, 1)
    const nextHealth = advanceToFuture(healthBase, 'ANNUAL')
    obligations.push({
      type: 'HEALTH_LICENSE',
      name: 'Health License Renewal',
      description:
        'Annual health facility license renewal with the Ministry of Health',
      frequency: 'ANNUAL',
      next_due_date: toDateString(nextHealth),
    })
  }

  return obligations
}

/* ───────── Applicability-aware generator ───────── */

/** VAT threshold (SAR): above this is mandatory monthly filing. */
const VAT_MONTHLY_THRESHOLD = 40_000_000
/** VAT registration threshold (SAR). Below this VAT is optional — we skip it. */
const VAT_REGISTRATION_THRESHOLD = 375_000

function pickVatFrequency(
  annualRevenue: number | null | undefined
): { frequency: ObligationFrequency; skip: boolean } {
  if (annualRevenue === null || annualRevenue === undefined) {
    return { frequency: 'QUARTERLY', skip: false }
  }
  if (annualRevenue < VAT_REGISTRATION_THRESHOLD) {
    return { frequency: 'QUARTERLY', skip: true }
  }
  if (annualRevenue > VAT_MONTHLY_THRESHOLD) {
    return { frequency: 'MONTHLY', skip: false }
  }
  return { frequency: 'QUARTERLY', skip: false }
}

/**
 * Generate obligations with per-item applicability labels using ISIC rules
 * when available, falling back to free-text activity matching otherwise.
 *
 * Returned obligations all carry `applicability` + `reason`. Items classified
 * as NOT_APPLICABLE are filtered out. SUGGESTED items are returned alongside
 * REQUIRED ones so the UI can render a review step.
 *
 * Does NOT persist anything.
 */
export function generateObligationsWithApplicability(
  crData: CRData
): GeneratedObligation[] {
  const hasIsic = Boolean(
    (crData.isicCode && crData.isicCode.trim()) ||
      (crData.subActivityCodes && crData.subActivityCodes.length > 0)
  )

  // Build a lookup map: ObligationType → ApplicabilityResult
  const applicabilityMap = new Map<ObligationType, ApplicabilityResult>()
  if (hasIsic) {
    const results = classifyByIsic(
      crData.isicCode ?? null,
      crData.subActivityCodes ?? []
    )
    for (const r of results) applicabilityMap.set(r.type, r)
  }

  // Base set of obligations from the classic generator (activity-keyword based).
  const base = generateObligationsFromCR(crData)

  // VAT frequency adjustment (per revenue / capital proxy).
  // Note: `capital` is used as a proxy when no explicit annual revenue is
  // provided — it is imperfect but matches what Wathq gives us.
  const { frequency: vatFrequency, skip: skipVat } = pickVatFrequency(
    crData.annualRevenue
  )

  const enriched: GeneratedObligation[] = []

  for (const ob of base) {
    // VAT skipped under registration threshold
    if (ob.type === 'ZATCA_VAT' && skipVat) continue

    // Apply ISIC-derived applicability when we have it
    const fromIsic = applicabilityMap.get(ob.type)
    let applicability: Applicability = 'REQUIRED'
    let reason: { ar: string; en: string } | undefined

    if (fromIsic) {
      applicability = fromIsic.applicability
      reason = fromIsic.reason
    } else if (!hasIsic) {
      // No ISIC — keyword matching already picked the right base set. Universal
      // items stay REQUIRED, business-type items marked SUGGESTED.
      if (
        ob.type === 'CR_CONFIRMATION' ||
        ob.type === 'GOSI' ||
        ob.type === 'ZATCA_VAT' ||
        ob.type === 'CHAMBER' ||
        ob.type === 'ZAKAT'
      ) {
        applicability = 'REQUIRED'
      } else {
        applicability = 'SUGGESTED'
        reason = {
          en: 'We think this may apply based on your activity description — please confirm.',
          ar: 'نعتقد أن هذا قد ينطبق بناءً على وصف نشاطك — يرجى التأكيد.',
        }
      }
    }

    // Drop items explicitly NOT_APPLICABLE (e.g. Balady for IT shops).
    if (applicability === 'NOT_APPLICABLE') continue

    // Physical-location downgrade: Balady REQUIRED via ISIC but user says no
    // premises → downgrade to SUGGESTED with a note.
    let finalReason = reason
    if (
      ob.type === 'BALADY' &&
      applicability === 'REQUIRED' &&
      crData.hasPhysicalLocation === false
    ) {
      applicability = 'SUGGESTED'
      finalReason = {
        en: 'Confirm if you have physical premises.',
        ar: 'يرجى التأكيد إذا كان لديك مقر فعلي.',
      }
    }

    enriched.push({
      ...ob,
      frequency: ob.type === 'ZATCA_VAT' ? vatFrequency : ob.frequency,
      applicability,
      reason: finalReason,
    })
  }

  // Also emit SUGGESTED items that weren't in the base set (e.g. MISA/QIWA)
  // when we have ISIC data — so the review step can surface them. Use a
  // sensible default due date (Jan 1 next year).
  if (hasIsic) {
    const present = new Set(enriched.map((o) => o.type))
    const today = startOfDay(new Date())
    const defaultDue = new Date(today.getFullYear() + 1, 0, 1)
      .toISOString()
      .split('T')[0]

    for (const r of applicabilityMap.values()) {
      if (present.has(r.type)) continue
      if (r.applicability !== 'SUGGESTED') continue
      // Skip CUSTOM / universal types we've already handled
      if (
        r.type === 'CR_CONFIRMATION' ||
        r.type === 'GOSI' ||
        r.type === 'ZATCA_VAT' ||
        r.type === 'CHAMBER' ||
        r.type === 'ZAKAT' ||
        r.type === 'CUSTOM'
      )
        continue

      enriched.push({
        type: r.type,
        name: r.type,
        description: r.reason.en,
        frequency: 'ANNUAL',
        next_due_date: defaultDue,
        applicability: 'SUGGESTED',
        reason: r.reason,
      })
    }
  }

  return enriched
}

/**
 * Convert generated obligations into database-ready seeds for a specific business.
 */
export function toObligationSeeds(
  businessId: string,
  generated: GeneratedObligation[]
): ObligationSeed[] {
  return generated.map((g) =>
    buildSeed(
      businessId,
      g.type,
      g.name,
      g.description,
      g.frequency,
      new Date(g.next_due_date)
    )
  )
}
