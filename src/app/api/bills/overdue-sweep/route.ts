import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron-invokable endpoint. Marks approved bills past their due date as 'overdue'.
 *
 * Auth: `X-Cron-Secret` header must match `process.env.CRON_SECRET`.
 */
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_FEATURE_BILLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const expected = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret')
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    const { data, error } = await supabase
      .from('bills')
      .update({ status: 'overdue' })
      .eq('status', 'approved')
      .lt('due_date', today)
      .select('id')

    if (error) {
      console.error('[API] bills/overdue-sweep failed:', error)
      return NextResponse.json({ error: 'Sweep failed' }, { status: 500 })
    }

    return NextResponse.json({ count: data?.length ?? 0 })
  } catch (error) {
    console.error('[API] bills/overdue-sweep exception:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
