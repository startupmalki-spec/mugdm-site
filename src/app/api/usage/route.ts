import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getUsageStats } from '@/lib/usage/tracker'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Verify user owns this business
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 403 })
    }

    const stats = await getUsageStats(businessId, supabase)
    return NextResponse.json(stats)
  } catch (error) {
    console.error('[API] usage failed:', error)
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
  }
}
