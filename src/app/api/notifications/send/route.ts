import { createClient } from '@supabase/supabase-js'
import { differenceInDays } from 'date-fns'

import { sendEmail } from '@/lib/email/resend'
import { complianceReminderEmail, documentExpiryEmail } from '@/lib/email/templates'
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

        const businessName = business.name_en || business.name_ar
        const { subject, html } = complianceReminderEmail(
          row.name,
          row.next_due_date,
          daysLeft,
          businessName
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

        const businessName = business.name_en || business.name_ar
        const { subject, html } = documentExpiryEmail(
          row.name,
          row.expiry_date!,
          daysLeft,
          businessName
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

        result.documentsSent++
      }
    }
  } catch (err) {
    result.errors.push(`Document processing error: ${err instanceof Error ? err.message : String(err)}`)
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
