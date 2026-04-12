import type { ObligationType } from '@/lib/supabase/types'

export interface PenaltyEstimate {
  amount: number
  description: string
}

/**
 * Estimate the penalty for a late Saudi compliance obligation.
 *
 * These are rough estimates based on publicly known regulatory penalties.
 * Actual penalties vary depending on the specific authority, severity, and
 * whether it is a first-time or repeated offence.
 */
export function estimatePenalty(
  obligationType: ObligationType,
  daysLate: number
): PenaltyEstimate {
  if (daysLate <= 0) {
    return { amount: 0, description: '' }
  }

  const monthsLate = Math.max(1, Math.ceil(daysLate / 30))

  switch (obligationType) {
    case 'GOSI': {
      // 2% of contribution per month late (assume average 3,000 SAR contribution)
      const avgContribution = 3000
      const penaltyRate = 0.02
      const amount = Math.round(avgContribution * penaltyRate * monthsLate)
      return {
        amount,
        description: `~${penaltyRate * 100}% of contribution per month (${monthsLate} month${monthsLate > 1 ? 's' : ''} late)`,
      }
    }

    case 'ZATCA_VAT': {
      // 5-25% of unpaid tax, scales with time
      // Use a graduated scale: 5% first month, +1% per additional month, max 25%
      const rate = Math.min(5 + (monthsLate - 1), 25)
      // Assume a modest quarterly VAT liability of 10,000 SAR
      const estimatedTax = 10000
      const amount = Math.round(estimatedTax * (rate / 100))
      return {
        amount,
        description: `${rate}% of unpaid VAT (estimated on avg quarterly liability)`,
      }
    }

    case 'CR_CONFIRMATION': {
      // SAR 500-10,000 fine for not renewing CR
      // Scale from 500 at 1 day to 10,000 at 12+ months
      const amount = Math.min(500 + monthsLate * 800, 10000)
      return {
        amount,
        description: `CR not renewed — fine ranges SAR 500 to 10,000`,
      }
    }

    case 'BALADY': {
      // SAR 1,000-5,000 for expired municipal license
      const amount = Math.min(1000 + monthsLate * 500, 5000)
      return {
        amount,
        description: `Balady license expired — fine ranges SAR 1,000 to 5,000`,
      }
    }

    case 'ZAKAT': {
      // 1% of unpaid Zakat per 30 days, plus potential suspension of services
      const estimatedZakat = 20000
      const rate = Math.min(monthsLate, 25)
      const amount = Math.round(estimatedZakat * (rate / 100))
      return {
        amount,
        description: `~1% of unpaid Zakat per 30 days (${monthsLate} month${monthsLate > 1 ? 's' : ''} late)`,
      }
    }

    case 'CHAMBER': {
      // Chamber membership fines are relatively modest: SAR 500-2,000
      const amount = Math.min(500 + monthsLate * 250, 2000)
      return {
        amount,
        description: `Chamber membership lapsed — estimated fine SAR 500 to 2,000`,
      }
    }

    case 'FOOD_SAFETY': {
      // SFDA fines for food safety violations: SAR 1,000-50,000
      const amount = Math.min(1000 + monthsLate * 2000, 50000)
      return {
        amount,
        description: `Food safety non-compliance — fines range SAR 1,000 to 50,000`,
      }
    }

    case 'SAFETY_CERT': {
      // Construction safety violations: SAR 5,000-25,000 + potential project suspension
      const amount = Math.min(5000 + monthsLate * 2000, 25000)
      return {
        amount,
        description: `Safety certificate expired — fine SAR 5,000 to 25,000 + possible project suspension`,
      }
    }

    case 'HEALTH_LICENSE': {
      // Health facility violations: SAR 10,000-100,000 + potential closure
      const amount = Math.min(10000 + monthsLate * 5000, 100000)
      return {
        amount,
        description: `Health license expired — fine SAR 10,000 to 100,000 + possible facility closure`,
      }
    }

    case 'MISA':
    case 'INSURANCE':
    case 'QIWA':
    case 'CUSTOM':
    default: {
      // Generic estimate for other obligation types
      const amount = Math.min(500 + monthsLate * 300, 5000)
      return {
        amount,
        description: `Estimated penalty for ${daysLate} day${daysLate > 1 ? 's' : ''} late`,
      }
    }
  }
}
