import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

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
    const { businessId } = body as { businessId: string }

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

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

    if (bizError || !business || !business.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found for this business' },
        { status: 404 }
      )
    }

    const stripe = getStripe()
    const origin = new URL(request.url).origin

    const session = await stripe.billingPortal.sessions.create({
      customer: business.stripe_customer_id,
      return_url: `${origin}/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[API] stripe/portal failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
