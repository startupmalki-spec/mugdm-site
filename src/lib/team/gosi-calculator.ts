/**
 * GOSI (General Organization for Social Insurance) contribution calculator
 * Based on Saudi labor law rates (2024):
 *
 * Saudi employees:
 *   - Annuities: Employee 9.75%, Employer 9.75%
 *   - Occupational Hazards: Employer 2%
 *   - SANED (unemployment insurance): Employee 0.75%, Employer 0.75%
 *   - Total: Employee 10.5%, Employer 12.5%
 *
 * Non-Saudi employees:
 *   - Occupational Hazards: Employer 2%
 *   - Total: Employee 0%, Employer 2%
 */

export interface GOSIBreakdown {
  annuities: { employee: number; employer: number }
  occupationalHazards: { employer: number }
  sanedUnemployment?: { employee: number; employer: number }
}

export interface GOSIContribution {
  employeeShare: number
  employerShare: number
  total: number
  breakdown: GOSIBreakdown
}

// Rate constants
const SAUDI_ANNUITIES_EMPLOYEE = 0.0975
const SAUDI_ANNUITIES_EMPLOYER = 0.0975
const OCCUPATIONAL_HAZARDS_EMPLOYER = 0.02
const SAUDI_SANED_EMPLOYEE = 0.0075
const SAUDI_SANED_EMPLOYER = 0.0075

export function calculateGOSI(
  salary: number,
  isSaudi: boolean
): GOSIContribution {
  if (salary <= 0) {
    return {
      employeeShare: 0,
      employerShare: 0,
      total: 0,
      breakdown: {
        annuities: { employee: 0, employer: 0 },
        occupationalHazards: { employer: 0 },
      },
    }
  }

  if (isSaudi) {
    const annuitiesEmployee = round(salary * SAUDI_ANNUITIES_EMPLOYEE)
    const annuitiesEmployer = round(salary * SAUDI_ANNUITIES_EMPLOYER)
    const occupationalHazards = round(salary * OCCUPATIONAL_HAZARDS_EMPLOYER)
    const sanedEmployee = round(salary * SAUDI_SANED_EMPLOYEE)
    const sanedEmployer = round(salary * SAUDI_SANED_EMPLOYER)

    const employeeShare = round(annuitiesEmployee + sanedEmployee)
    const employerShare = round(
      annuitiesEmployer + occupationalHazards + sanedEmployer
    )

    return {
      employeeShare,
      employerShare,
      total: round(employeeShare + employerShare),
      breakdown: {
        annuities: { employee: annuitiesEmployee, employer: annuitiesEmployer },
        occupationalHazards: { employer: occupationalHazards },
        sanedUnemployment: {
          employee: sanedEmployee,
          employer: sanedEmployer,
        },
      },
    }
  }

  // Non-Saudi: only occupational hazards paid by employer
  const occupationalHazards = round(salary * OCCUPATIONAL_HAZARDS_EMPLOYER)

  return {
    employeeShare: 0,
    employerShare: occupationalHazards,
    total: occupationalHazards,
    breakdown: {
      annuities: { employee: 0, employer: 0 },
      occupationalHazards: { employer: occupationalHazards },
    },
  }
}

/**
 * Calculate tenure from a start date to today.
 * Returns { years, months, totalDays }.
 */
export function calculateTenure(startDate: string): {
  years: number
  months: number
  totalDays: number
} {
  const start = new Date(startDate)
  const now = new Date()

  if (isNaN(start.getTime()) || start > now) {
    return { years: 0, months: 0, totalDays: 0 }
  }

  const totalDays = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  )

  let years = now.getFullYear() - start.getFullYear()
  let months = now.getMonth() - start.getMonth()

  if (months < 0) {
    years--
    months += 12
  }

  if (now.getDate() < start.getDate()) {
    months--
    if (months < 0) {
      years--
      months += 12
    }
  }

  return { years, months, totalDays }
}

/**
 * Check if a 2-year contract is expiring within `warningDays` days.
 * Returns the number of days until expiry, or null if not within warning window.
 */
export function getContractExpiryWarning(
  startDate: string,
  contractYears: number = 2,
  warningDays: number = 60
): { daysUntilExpiry: number; expiryDate: Date } | null {
  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  const expiry = new Date(start)
  expiry.setFullYear(expiry.getFullYear() + contractYears)

  const now = new Date()
  const msUntilExpiry = expiry.getTime() - now.getTime()
  const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry <= warningDays && daysUntilExpiry >= 0) {
    return { daysUntilExpiry, expiryDate: expiry }
  }

  return null
}

/** Round to 2 decimal places */
function round(n: number): number {
  return Math.round(n * 100) / 100
}
