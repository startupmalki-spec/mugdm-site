import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

/**
 * Server-side event emitter (PRD_ML §9.3).
 * Non-blocking: callers should fire-and-forget. Uses the service-role client
 * so any authenticated server context can record events without wrestling
 * with RLS. Never throws — analytics must not break a live request.
 */

export interface ServerEventInput {
  event_name: string
  business_id: string
  user_id: string
  event_category?: string
  properties?: Record<string, unknown>
  locale?: 'en' | 'ar' | null
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function categoryFor(eventName: string): string {
  const [prefix] = eventName.split('.')
  return prefix || 'uncategorized'
}

/**
 * Emit a server-side event. Non-blocking: awaits the insert internally but
 * swallows all errors so callers can `void emitServerEvent(...)` safely.
 */
export async function emitServerEvent(input: ServerEventInput): Promise<void> {
  const client = serviceClient()
  if (!client) return

  try {
    await client.from('user_events').insert({
      business_id: input.business_id,
      user_id: input.user_id,
      event_name: input.event_name,
      event_category: input.event_category ?? categoryFor(input.event_name),
      properties: input.properties ?? {},
      locale: input.locale ?? null,
    } as never)
  } catch {
    // Silent — never break the calling request.
  }
}
