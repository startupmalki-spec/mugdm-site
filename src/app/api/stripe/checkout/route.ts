import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

const VALID_PRICE_IDS = new Set(
  [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID,
    process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID,
  ].filter(Boolean)
)

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { priceId, businessId } = body as { priceId: string; businessId: string }

    if (!priceId || !businessId) {
      return NextResponse.json(
        { error: 'priceId and businessId are required' },
        { status: 400 }
      )
    }

    if (!VALID_PRICE_IDS.has(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
    }

    // Verify the business belongs to this user
    // NOTE: stripe columns not yet in generated types — cast through unknown
    const { data: business, error: bizError } = await (supabase
      .from('businesses')
      .select('id, stripe_customer_id')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .maybeSingle() as unknown as Promise<{
        data: { id: string; stripe_customer_id: string | null } | null
        error: { message: string } | null
      }>)

    if (bizError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const stripe = getStripe()

    // Reuse existing Stripe customer or create one
    let customerId = business.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { businessId, userId: user.id },
      })
      customerId = customer.id

      await (supabase
        .from('businesses') as unknown as { update(values: Record<string, unknown>): { eq(col: string, val: string): Promise<unknown> } })
        .update({ stripe_customer_id: customerId })
        .eq('id', businessId)
    }

    const origin = new URL(request.url).origin

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/#pricing`,
      subscription_data: {
        metadata: { businessId },
      },
      metadata: { businessId, userId: user.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[API] stripe/checkout failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
