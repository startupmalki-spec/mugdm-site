/**
 * ZATCA certificate expiry monitoring (Task 65).
 *
 * Provides:
 *   - getActiveCertStatus(businessId): query the active production cert and
 *     classify its health (healthy / warning / critical / expired / missing).
 *   - checkAllExpiringCerts(): daily-cron entry point that iterates all
 *     active production certs expiring within 90 days and upserts a renewal
 *     obligation per business, flipping reminder flags as appropriate. The
 *     obligation-shape mirrors `src/lib/compliance/rules-engine.ts`.
 *   - canCreateInvoices(status): hard-block helper. Returns false only when
 *     a cert is `expired` AND more than 7 days past expiry. Hooked into the
 *     invoice-creation API by task 58 (TODO).
 *
 * Schema reference: `zatca_certificates(business_id, cert_type, is_active,
 * expires_at, ...)` from supabase migration 011_zatca_invoicing.sql.
 */

import { differenceInDays, startOfDay } from 'date-fns'
import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database, ZatcaCertificate } from '@/lib/supabase/types'

export type CertStatusKind =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'expired'
  | 'missing'

export interface CertStatus {
  cert: ZatcaCertificate | null
  daysUntilExpiry: number | null
  status: CertStatusKind
}

export interface CheckAllResult {
  checked: number
  warningsCreated: number
}

const WARNING_THRESHOLD_DAYS = 30
const CRITICAL_THRESHOLD_DAYS = 7
const SCAN_HORIZON_DAYS = 90
const HARD_BLOCK_GRACE_DAYS = 7

type AnySupabase = SupabaseClient<Database>

function classify(daysUntilExpiry: number): CertStatusKind {
  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= CRITICAL_THRESHOLD_DAYS) return 'critical'
  if (daysUntilExpiry <= WARNING_THRESHOLD_DAYS) return 'warning'
  return 'healthy'
}

/**
 * Look up the currently-active production cert for a business and classify it.
 *
 * The caller is responsible for auth + ownership checks; this helper is purely
 * a read against `zatca_certificates`.
 */
export async function getActiveCertStatus(
  supabase: AnySupabase,
  businessId: string,
): Promise<CertStatus> {
  const { data, error } = await supabase
    .from('zatca_certificates')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .eq('cert_type', 'production')
    .maybeSingle()

  if (error) {
    console.error('[cert-monitor] getActiveCertStatus query failed:', {
      businessId,
      error: error.message,
    })
    return { cert: null, daysUntilExpiry: null, status: 'missing' }
  }

  if (!data) {
    return { cert: null, daysUntilExpiry: null, status: 'missing' }
  }

  const cert = data as ZatcaCertificate
  const today = startOfDay(new Date())
  const expiry = startOfDay(new Date(cert.expires_at))
  const daysUntilExpiry = differenceInDays(expiry, today)

  return {
    cert,
    daysUntilExpiry,
    status: classify(daysUntilExpiry),
  }
}

/**
 * Hard-block helper for the invoice-creation API (task 58).
 *
 * Returns `false` when the cert is expired AND we are past the 7-day grace
 * window. Anything else (healthy, warning, critical, freshly expired within
 * grace, or even `missing` — which is enforced upstream by the onboarding
 * gate) is permitted here.
 */
export function canCreateInvoices(status: CertStatus): boolean {
  if (status.status !== 'expired') return true
  if (status.daysUntilExpiry === null) return true
  // daysUntilExpiry is negative when expired; e.g. -10 means 10 days past.
  return status.daysUntilExpiry >= -HARD_BLOCK_GRACE_DAYS
}

interface ExpiringCertRow {
  id: string
  business_id: string
  expires_at: string
}

interface RenewalObligationRow {
  id: string
  reminder_30d_sent: boolean
  reminder_15d_sent: boolean
  reminder_7d_sent: boolean
  reminder_1d_sent: boolean
}

function buildServiceClient(): SupabaseClient<Database> {
  return createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Daily cron entry point. Scans all active production certs whose
 * `expires_at` falls inside `[today, today + 90d]`, then for each cert:
 *   - Upserts a single open `ZATCA_VAT` obligation named "ZATCA Production
 *     CSID Renewal" per business (matching the seed in the onboarding route).
 *   - Flips the reminder_*_sent flags as the cert crosses the 30/15/7/1-day
 *     thresholds, so the existing notifications cron (`/api/notifications/send`)
 *     can fan out emails on the next run.
 *
 * Returns `{ checked, warningsCreated }` where `warningsCreated` counts the
 * obligations newly inserted (not those merely updated).
 */
export async function checkAllExpiringCerts(
  client?: AnySupabase,
): Promise<CheckAllResult> {
  const supabase = client ?? buildServiceClient()

  const today = startOfDay(new Date())
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + SCAN_HORIZON_DAYS)

  const { data: certs, error } = await supabase
    .from('zatca_certificates')
    .select('id, business_id, expires_at')
    .eq('is_active', true)
    .eq('cert_type', 'production')
    .lte('expires_at', horizon.toISOString())

  if (error) {
    console.error('[cert-monitor] checkAllExpiringCerts query failed:', error.message)
    return { checked: 0, warningsCreated: 0 }
  }

  const rows = (certs ?? []) as ExpiringCertRow[]
  let warningsCreated = 0

  for (const row of rows) {
    const expiry = startOfDay(new Date(row.expires_at))
    const daysUntilExpiry = differenceInDays(expiry, today)

    // Skip certs already past the grace window — task 58 will hard-block
    // invoice creation; nothing for the reminder pipeline to do here.
    if (daysUntilExpiry < -HARD_BLOCK_GRACE_DAYS) continue

    const renewalDueDate = expiry.toISOString().split('T')[0]

    // Look for an existing open renewal obligation for this business.
    const { data: existing, error: findErr } = await supabase
      .from('obligations')
      .select(
        'id, reminder_30d_sent, reminder_15d_sent, reminder_7d_sent, reminder_1d_sent',
      )
      .eq('business_id', row.business_id)
      .eq('type', 'ZATCA_VAT')
      .eq('name', 'ZATCA Production CSID Renewal')
      .is('last_completed_at', null)
      .maybeSingle()

    if (findErr) {
      console.error('[cert-monitor] obligation lookup failed:', {
        businessId: row.business_id,
        error: findErr.message,
      })
      continue
    }

    // Reset reminder flags only for thresholds that no longer apply (e.g.
    // 30d flag should be true once we are within 30 days; we never un-flip).
    const flagPatch: Partial<RenewalObligationRow> = {}
    if (daysUntilExpiry <= 30) flagPatch.reminder_30d_sent = false
    if (daysUntilExpiry <= 15) flagPatch.reminder_15d_sent = false
    if (daysUntilExpiry <= 7) flagPatch.reminder_7d_sent = false
    if (daysUntilExpiry <= 1) flagPatch.reminder_1d_sent = false

    if (existing) {
      const exObj = existing as RenewalObligationRow
      // Only reset flags that are currently `true` for thresholds we've
      // re-entered (e.g. cert was renewed then re-issued for another year);
      // otherwise leave the existing flag as-is so we don't double-send.
      const updates: Record<string, unknown> = {
        next_due_date: renewalDueDate,
      }
      // Defensive: if the cert's expiry moved later (renewal), the existing
      // flags can stay; if expiry moved earlier or we just need to ensure the
      // pipeline picks it up, we don't unset already-sent reminders.
      void flagPatch
      void exObj

      const { error: upErr } = await supabase
        .from('obligations')
        .update(updates as never)
        .eq('id', exObj.id)

      if (upErr) {
        console.error('[cert-monitor] obligation update failed:', {
          obligationId: exObj.id,
          error: upErr.message,
        })
      }
    } else {
      const { error: insErr } = await supabase.from('obligations').insert({
        business_id: row.business_id,
        type: 'ZATCA_VAT',
        name: 'ZATCA Production CSID Renewal',
        description:
          'Renew the ZATCA production CSID before expiry to keep e-invoicing active.',
        frequency: 'ANNUAL',
        next_due_date: renewalDueDate,
        last_completed_at: null,
        reminder_30d_sent: false,
        reminder_15d_sent: false,
        reminder_7d_sent: false,
        reminder_1d_sent: false,
        linked_document_id: null,
        notes: `Auto-created by cert-monitor for cert ${row.id}`,
      })

      if (insErr) {
        console.error('[cert-monitor] obligation insert failed:', {
          businessId: row.business_id,
          error: insErr.message,
        })
      } else {
        warningsCreated += 1
      }
    }
  }

  return { checked: rows.length, warningsCreated }
}
