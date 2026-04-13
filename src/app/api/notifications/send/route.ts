import { createClient } from '@supabase/supabase-js'
import { differenceInDays } from 'date-fns'

import { sendEmail } from '@/lib/email/resend'
import { complianceReminderEmail, documentExpiryEmail } from '@/lib/email/templates'
import { emitServerEvent } from '@/lib/analytics/server-events'
import type { Obligation, Document } from '@/lib/supabase/types'

// Use service role for cron (no user session)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface NotificationResult {
  obligationsSent: number
  documentsSent: number
  errors: string[]
}

interface BusinessJoin {
  name_en: string | null
  name_ar: string
  user_id: string
}

type ObligationWithBusiness = Obligation & { businesses: BusinessJoin }
type DocumentWithBusiness = Document & { businesses: BusinessJoin }

type ReminderField = 'reminder_30d_sent' | 'reminder_15d_sent' | 'reminder_7d_sent' | 'reminder_1d_sent'

const REMINDER_THRESHOLDS: { days: number; field: ReminderField }[] = [
  { days: 30, field: 'reminder_30d_sent' },
  { days: 15, field: 'reminder_15d_sent' },
  { days: 7, field: 'reminder_7d_sent' },
  { days: 1, field: 'reminder_1d_sent' },
]

export async function POST(request: Request) {
  // Authenticate via cron secret
  const cronSecret = request.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const result: NotificationResult = {
    obligationsSent: 0,
    documentsSent: 0,
    errors: [],
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const thirtyDaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  // --- Obligation reminders (due within 30 days) ---
  try {
    const { data: obligations, error: obErr } = await supabase
      .from('obligations')
      .select('*, businesses!inner(name_en, name_ar, user_id)')
      .gte('next_due_date', todayStr)
      .lte('next_due_date', thirtyDaysStr)

    if (obErr) {
      result.errors.push(`Obligations query failed: ${obErr.message}`)
    } else if (obligations) {
      for (const row of obligations as unknown as ObligationWithBusiness[]) {
        const daysLeft = differenceInDays(new Date(row.next_due_date), today)

        // Find the applicable reminder threshold that hasn't been sent yet
        const threshold = REMINDER_THRESHOLDS.find(
          (t) => daysLeft <= t.days && !row[t.field]
        )
        if (!threshold) continue

        // Get business owner's email
        const business = row.businesses

        const { data: user, error: userErr } = await supabase.auth.admin.getUserById(
          business.user_id
        )
        if (userErr || !user?.user?.email) {
          result.errors.push(
            `Could not get email for user ${business.user_id}: ${userErr?.message ?? 'no email'}`
          )
          continue
        }

        const locale = (user.user.user_metadata?.locale as 'ar' | 'en') || 'ar'
        const businessName = locale === 'ar' ? business.name_ar : (business.name_en || business.name_ar)
        const { subject, html } = complianceReminderEmail(
          row.name,
          row.next_due_date,
          daysLeft,
          businessName,
          { locale }
        )

        const { error: sendErr } = await sendEmail({
          to: user.user.email,
          subject,
          html,
        })

        if (sendErr) {
          result.errors.push(
            `Failed to send obligation reminder for ${row.name}: ${String(sendErr)}`
          )
          continue
        }

        // Mark the reminder as sent
        await supabase
          .from('obligations')
          .update({ [threshold.field]: true })
          .eq('id', row.id)

        void emitServerEvent({
          event_name: 'notification.email_sent',
          event_category: 'notification',
          business_id: row.business_id,
          user_id: business.user_id,
          properties: { kind: 'obligation_reminder', obligation_name: row.name, days_left: daysLeft },
        })

        result.obligationsSent++
      }
    }
  } catch (err) {
    result.errors.push(`Obligation processing error: ${err instanceof Error ? err.message : String(err)}`)
  }

  // --- Document expiry reminders (expiring within 30 days) ---
  try {
    const { data: documents, error: docErr } = await supabase
      .from('documents')
      .select('*, businesses!inner(name_en, name_ar, user_id)')
      .eq('is_current', true)
      .gte('expiry_date', todayStr)
      .lte('expiry_date', thirtyDaysStr)

    if (docErr) {
      result.errors.push(`Documents query failed: ${docErr.message}`)
    } else if (documents) {
      for (const row of documents as unknown as DocumentWithBusiness[]) {
        const daysLeft = differenceInDays(new Date(row.expiry_date!), today)

        // Only send at 30, 15, 7, and 1 day thresholds
        if (![30, 15, 7, 1].includes(daysLeft)) continue

        const business = row.businesses

        const { data: user, error: userErr } = await supabase.auth.admin.getUserById(
          business.user_id
        )
        if (userErr || !user?.user?.email) {
          result.errors.push(
            `Could not get email for user ${business.user_id}: ${userErr?.message ?? 'no email'}`
          )
          continue
        }

        const locale = (user.user.user_metadata?.locale as 'ar' | 'en') || 'ar'
        const businessName = locale === 'ar' ? business.name_ar : (business.name_en || business.name_ar)
        const { subject, html } = documentExpiryEmail(
          row.name,
          row.expiry_date!,
          daysLeft,
          businessName,
          { locale }
        )

        const { error: sendErr } = await sendEmail({
          to: user.user.email,
          subject,
          html,
        })

        if (sendErr) {
          result.errors.push(
            `Failed to send document expiry email for ${row.name}: ${String(sendErr)}`
          )
          continue
        }

        void emitServerEvent({
          event_name: 'notification.email_sent',
          event_category: 'notification',
          business_id: row.business_id,
          user_id: business.user_id,
          properties: { kind: 'document_expiry', document_name: row.name, days_left: daysLeft },
        })

        result.documentsSent++
      }
    }
  } catch (err) {
    result.errors.push(`Document processing error: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Overdue obligation scan — emits compliance.obligation_overdue events used
  // by the churn-prevention + compliance-boost nudge rules.
  try {
    const { data: overdueRows } = await supabase
      .from('obligations')
      .select('id, business_id, name, next_due_date, businesses!inner(user_id)')
      .lt('next_due_date', todayStr)

    for (const row of (overdueRows ?? []) as unknown as Array<
      Obligation & { businesses: { user_id: string } }
    >) {
      void emitServerEvent({
        event_name: 'compliance.obligation_overdue',
        event_category: 'compliance',
        business_id: row.business_id,
        user_id: row.businesses.user_id,
        properties: {
          obligation_name: row.name,
          due_date: row.next_due_date,
          days_overdue: Math.max(1, differenceInDays(today, new Date(row.next_due_date))),
        },
      })
    }
  } catch (err) {
    result.errors.push(
      `Overdue scan error: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const status = result.errors.length > 0 ? 207 : 200
  return Response.json(
    {
      success: result.errors.length === 0,
      sent: {
        obligations: result.obligationsSent,
        documents: result.documentsSent,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    },
    { status }
  )
}
