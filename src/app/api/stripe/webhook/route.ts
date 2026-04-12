import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe/client'
import type Stripe from 'stripe'

// Use service role for webhook handlers (no user session available)
function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function tierFromPriceId(priceId: string): string {
  const proMonthly = process.env.STRIPE_PRO_MONTHLY_PRICE_ID
  const proAnnual = process.env.STRIPE_PRO_ANNUAL_PRICE_ID
  const businessMonthly = process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID
  const businessAnnual = process.env.STRIPE_BUSINESS_ANNUAL_PRICE_ID

  if (priceId === proMonthly || priceId === proAnnual) return 'pro'
  if (priceId === businessMonthly || priceId === businessAnnual) return 'business'
  return 'free'
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceSupabase()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const businessId = session.metadata?.businessId
        if (!businessId) break

        const subscriptionId = session.subscription as string | null
        if (!subscriptionId) break

        // Fetch the subscription to get price details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id ?? ''
        const tier = tierFromPriceId(priceId)

        await supabase
          .from('businesses')
          .update({
            stripe_customer_id: session.customer as string,
            subscription_status: 'active',
            subscription_tier: tier,
          })
          .eq('id', businessId)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const businessId = subscription.metadata?.businessId
        if (!businessId) break

        const priceId = subscription.items.data[0]?.price.id ?? ''
        const tier = tierFromPriceId(priceId)
        const status = subscription.status === 'active' ? 'active' : subscription.status

        await supabase
          .from('businesses')
          .update({
            subscription_status: status,
            subscription_tier: tier,
          })
          .eq('id', businessId)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const businessId = subscription.metadata?.businessId
        if (!businessId) break

        await supabase
          .from('businesses')
          .update({
            subscription_status: 'free',
            subscription_tier: 'free',
          })
          .eq('id', businessId)
        break
      }
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error handling event:', event.type, error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
