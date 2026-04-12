/**
 * Client-safe price ID constants.
 * These reference NEXT_PUBLIC_ env vars so they are available in browser code.
 * The actual Stripe operations happen server-side via the checkout API.
 */
export const PRICE_IDS = {
  PRO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID ?? '',
  PRO_ANNUAL: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID ?? '',
  BUSINESS_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PRICE_ID ?? '',
  BUSINESS_ANNUAL: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_ANNUAL_PRICE_ID ?? '',
} as const
