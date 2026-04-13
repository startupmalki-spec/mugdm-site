import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/notifications/in-app?businessId=...
 * Returns the current user's unread + dismissed-within-7d in-app notifications.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = new URL(req.url).searchParams.get('businessId')
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('in_app_notifications')
    .select('id, title, body, action_url, action_label, type, is_read, dismissed_at, created_at')
    .eq('business_id', businessId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: data ?? [] })
}

/**
 * PATCH /api/notifications/in-app
 * Body: { id: string, action: 'read' | 'dismiss' }
 * RLS restricts updates to the user's own business.
 */
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; action?: 'read' | 'dismiss' }
  try {
    body = (await req.json()) as { id?: string; action?: 'read' | 'dismiss' }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.id || (body.action !== 'read' && body.action !== 'dismiss')) {
    return NextResponse.json({ error: 'id and action required' }, { status: 400 })
  }

  const updates =
    body.action === 'read'
      ? { is_read: true }
      : { dismissed_at: new Date().toISOString() }

  const { error } = await supabase
    .from('in_app_notifications')
    .update(updates as never)
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
