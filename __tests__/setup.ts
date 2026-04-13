/**
 * Vitest global setup — runs before every test file.
 *
 * Sets minimal env vars so modules that read process.env at import time
 * don't crash (e.g. Supabase client, Stripe).
 */

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.STRIPE_SECRET_KEY ??= 'sk_test_fake'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_fake'
process.env.RESEND_API_KEY ??= 're_test_fake'
