/**
 * CR status monitor.
 *
 * Walks the businesses table, calls Wathq for each CR, and (a) updates the
 * stored expiry date if Wathq disagrees, (b) records the latest status, and
 * (c) returns a list of "alerts" for callers (cron job / notifier) to act on.
 *
 * Designed to be invoked from the existing notifications cron at
 * src/app/api/notifications/send/route.ts. Graceful when WATHQ_API_KEY is
 * unset — returns an empty result with reason 'NOT_CONFIGURED'.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { isWathqConfigured, lookupCR, WathqError } from '@/lib/wathq/client'

export interface CRMonitorAlert {
  businessId: string
  crNumber: string
  kind: 'STATUS_CHANGED' | 'EXPIRY_CHANGED' | 'LOOKUP_FAILED'
  previousStatus?: string | null
  currentStatus?: string | null
  previousExpiry?: string | null
  currentExpiry?: string | null
  message?: string
}

export interface CRMonitorResult {
  checked: number
  updated: number
  alerts: CRMonitorAlert[]
  reason?: 'NOT_CONFIGURED'
}

interface BusinessRow {
  id: string
  cr_number: string | null
  cr_expiry_date: string | null
  wathq_cr_status: string | null
}

function service() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function monitorAllCRs(options?: { limit?: number }): Promise<CRMonitorResult> {
  if (!isWathqConfigured()) {
    return { checked: 0, updated: 0, alerts: [], reason: 'NOT_CONFIGURED' }
  }

  const supabase = service()
  const limit = options?.limit ?? 100

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase.from('businesses') as any)
    .select('id, cr_number, cr_expiry_date, wathq_cr_status')
    .not('cr_number', 'is', null)
    .order('wathq_last_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  const businesses: BusinessRow[] = (rows ?? []) as BusinessRow[]
  const alerts: CRMonitorAlert[] = []
  let updated = 0

  for (const biz of businesses) {
    if (!biz.cr_number) continue
    try {
      const result = await lookupCR(biz.cr_number)
      const nowIso = new Date().toISOString()
      const newStatus = result.status ?? null
      const newExpiry = result.data.cr_expiry_date ?? null

      if (newStatus && biz.wathq_cr_status && newStatus !== biz.wathq_cr_status) {
        alerts.push({
          businessId: biz.id,
          crNumber: biz.cr_number,
          kind: 'STATUS_CHANGED',
          previousStatus: biz.wathq_cr_status,
          currentStatus: newStatus,
        })
      }
      if (newExpiry && biz.cr_expiry_date && newExpiry !== biz.cr_expiry_date) {
        alerts.push({
          businessId: biz.id,
          crNumber: biz.cr_number,
          kind: 'EXPIRY_CHANGED',
          previousExpiry: biz.cr_expiry_date,
          currentExpiry: newExpiry,
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('businesses') as any)
        .update({
          wathq_last_checked_at: nowIso,
          wathq_cr_status: newStatus,
          cr_expiry_date: newExpiry ?? biz.cr_expiry_date,
        })
        .eq('id', biz.id)
      updated += 1
    } catch (err) {
      alerts.push({
        businessId: biz.id,
        crNumber: biz.cr_number,
        kind: 'LOOKUP_FAILED',
        message:
          err instanceof WathqError
            ? `${err.code}: ${err.message}`
            : err instanceof Error
              ? err.message
              : 'Unknown error',
      })
    }
  }

  return { checked: businesses.length, updated, alerts }
}
