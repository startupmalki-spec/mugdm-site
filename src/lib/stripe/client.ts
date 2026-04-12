import Stripe from 'stripe'

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
  }
  return stripe
}

export const PRICE_IDS = {
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '',
  PRO_ANNUAL: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? '',
  BUSINESS_MONTHLY: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID ?? '',
  BUSINESS_ANNUAL: process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID ?? '',
} as const
