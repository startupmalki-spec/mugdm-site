import {
  addMonths,
  addYears,
  addDays,
  setDate,
  setMonth,
  differenceInDays,
  isBefore,
  startOfDay,
} from 'date-fns'

import type {
  Business,
  Obligation,
  ObligationFrequency,
  ObligationType,
} from '@/lib/supabase/types'

type ObligationStatus = 'upcoming' | 'due_soon' | 'overdue' | 'completed'

type ObligationSeed = Omit<Obligation, 'id' | 'created_at' | 'updated_at'>

const DUE_SOON_THRESHOLD_DAYS = 15

function getObligationStatus(
  dueDate: Date | string,
  lastCompletedAt: string | null
): ObligationStatus {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate

  if (lastCompletedAt) {
    const completed = new Date(lastCompletedAt)
    if (completed >= due || differenceInDays(due, completed) <= 0) {
      return 'completed'
    }
  }

  const today = startOfDay(new Date())
  const daysUntil = differenceInDays(due, today)

  if (daysUntil < 0) return 'overdue'
  if (daysUntil <= DUE_SOON_THRESHOLD_DAYS) return 'due_soon'
  return 'upcoming'
}

function getObligationStatusColor(status: ObligationStatus): string {
  switch (status) {
    case 'upcoming':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/20'
    case 'due_soon':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20'
    case 'overdue':
      return 'bg-red-500/15 text-red-400 border-red-500/20'
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
  }
}

function getObligationDotColor(status: ObligationStatus): string {
  switch (status) {
    case 'upcoming':
      return 'bg-blue-400'
    case 'due_soon':
      return 'bg-amber-400'
    case 'overdue':
      return 'bg-red-400'
    case 'completed':
      return 'bg-emerald-400'
  }
}

function getNextOccurrence(frequency: ObligationFrequency, baseDate: Date): Date {
  const today = startOfDay(new Date())
  let next = startOfDay(new Date(baseDate))

  switch (frequency) {
    case 'MONTHLY':
      while (isBefore(next, today)) {
        next = addMonths(next, 1)
      }
      return next

    case 'QUARTERLY':
      while (isBefore(next, today)) {
        next = addMonths(next, 3)
      }
      return next

    case 'ANNUAL':
      while (isBefore(next, today)) {
        next = addYears(next, 1)
      }
      return next

    case 'ONE_TIME':
    case 'CUSTOM':
    default:
      return next
  }
}

function formatLocalYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildSeed(
  businessId: string,
  type: ObligationType,
  name: string,
  description: string,
  frequency: ObligationFrequency,
  nextDueDate: Date
): ObligationSeed {
  return {
    business_id: businessId,
    type,
    name,
    description,
    frequency,
    next_due_date: formatLocalYMD(nextDueDate),
    last_completed_at: null,
    reminder_30d_sent: false,
    reminder_15d_sent: false,
    reminder_7d_sent: false,
    reminder_1d_sent: false,
    linked_document_id: null,
    notes: null,
  }
}

function generateObligations(business: Business): ObligationSeed[] {
  const obligations: ObligationSeed[] = []
  const today = new Date()

  // CR Confirmation: annual, anniversary of cr_issuance_date
  if (business.cr_issuance_date) {
    const crDate = new Date(business.cr_issuance_date)
    const nextCr = getNextOccurrence('ANNUAL', crDate)
    obligations.push(
      buildSeed(
        business.id,
        'CR_CONFIRMATION',
        'CR Confirmation',
        'Annual Commercial Registration confirmation with the Ministry of Commerce',
        'ANNUAL',
        nextCr
      )
    )
  }

  // Chamber of Commerce: annual, same date as CR
  if (business.cr_issuance_date) {
    const crDate = new Date(business.cr_issuance_date)
    const nextChamber = getNextOccurrence('ANNUAL', crDate)
    obligations.push(
      buildSeed(
        business.id,
        'CHAMBER',
        'Chamber of Commerce Renewal',
        'Annual Chamber of Commerce membership renewal',
        'ANNUAL',
        nextChamber
      )
    )
  }

  // GOSI: monthly on the 15th, generate next 12 months
  for (let i = 0; i < 12; i++) {
    const gosiDate = setDate(addMonths(today, i), 15)
    if (isBefore(gosiDate, today)) continue
    obligations.push(
      buildSeed(
        business.id,
        'GOSI',
        `GOSI Payment`,
        'Monthly General Organization for Social Insurance payment',
        'MONTHLY',
        gosiDate
      )
    )
  }

  // ZATCA VAT: quarterly (Apr 25, Jul 25, Oct 25, Jan 25)
  const vatMonths = [0, 3, 6, 9] // Jan, Apr, Jul, Oct
  const vatDay = 25
  for (const month of vatMonths) {
    let vatDate = setDate(setMonth(new Date(today.getFullYear(), 0, 1), month), vatDay)
    if (isBefore(vatDate, today)) {
      vatDate = setDate(setMonth(new Date(today.getFullYear() + 1, 0, 1), month), vatDay)
    }
    obligations.push(
      buildSeed(
        business.id,
        'ZATCA_VAT',
        'VAT Return Filing',
        'Quarterly VAT return filing with ZATCA',
        'QUARTERLY',
        vatDate
      )
    )
  }

  // Zakat: annual, 120 days after fiscal year end
  const fiscalYearEnd = business.fiscal_year_end
    ? new Date(business.fiscal_year_end)
    : new Date(today.getFullYear(), 11, 31) // Default Dec 31
  const zakatBase = addDays(fiscalYearEnd, 120)
  const nextZakat = getNextOccurrence('ANNUAL', zakatBase)
  obligations.push(
    buildSeed(
      business.id,
      'ZAKAT',
      'Zakat Filing',
      'Annual Zakat declaration filing with ZATCA (120 days after fiscal year end)',
      'ANNUAL',
      nextZakat
    )
  )

  return obligations
}

function getNextRecurrence(frequency: ObligationFrequency, fromDate: Date): Date {
  switch (frequency) {
    case 'MONTHLY':
      return addMonths(fromDate, 1)
    case 'QUARTERLY':
      return addMonths(fromDate, 3)
    case 'ANNUAL':
      return addYears(fromDate, 1)
    case 'ONE_TIME':
    case 'CUSTOM':
    default:
      return fromDate
  }
}

export {
  buildSeed,
  generateObligations,
  getNextOccurrence,
  getNextRecurrence,
  getObligationStatus,
  getObligationStatusColor,
  getObligationDotColor,
  DUE_SOON_THRESHOLD_DAYS,
}

export type { ObligationStatus, ObligationSeed }
