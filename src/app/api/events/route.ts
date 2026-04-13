import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface EventPayload {
  event_name: string
  event_category: string
  business_id: string
  properties?: Record<string, unknown>
  session_id?: string | null
  page_path?: string | null
  locale?: 'en' | 'ar' | null
  device_type?: 'desktop' | 'mobile' | 'tablet' | null
}

/**
 * POST /api/events — server-side collector for client-emitted events.
 * RLS enforces that `business_id` belongs to the authenticated user.
 * Silent-fails on any error; analytics must never break the UI.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EventPayload | EventPayload[]
    const events = Array.isArray(body) ? body : [body]
    if (events.length === 0) return NextResponse.json({ ok: true })
    if (events.length > 50) {
      return NextResponse.json({ error: 'Batch too large' }, { status: 413 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = events
      .filter((e) => e && typeof e.event_name === 'string' && typeof e.business_id === 'string')
      .map((e) => ({
        business_id: e.business_id,
        user_id: user.id,
        event_name: e.event_name,
        event_category: e.event_category || 'uncategorized',
        properties: e.properties ?? {},
        session_id: e.session_id ?? null,
        page_path: e.page_path ?? null,
        locale: e.locale ?? null,
        device_type: e.device_type ?? null,
      }))

    if (rows.length === 0) return NextResponse.json({ ok: true })

    await supabase.from('user_events').insert(rows as never)
    return NextResponse.json({ ok: true, accepted: rows.length })
  } catch {
    // Silent: client collectors are fire-and-forget.
    return NextResponse.json({ ok: true })
  }
}
