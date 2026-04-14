/**
 * Notification stubs for bill workflow events.
 *
 * Uses the existing Resend-backed sender at `src/lib/email/resend.ts`.
 * All functions are fire-and-forget — they swallow errors so the API
 * route never fails because email delivery failed.
 */

import { sendEmail } from '@/lib/email/resend'

export interface BillNotificationContext {
  billId: string
  billNumber?: string | null
  vendorName?: string | null
  total?: number | null
  currency?: string | null
  recipientEmail?: string | null
}

function fmtAmount(ctx: BillNotificationContext): string {
  if (ctx.total == null) return ''
  const cur = ctx.currency || 'SAR'
  return `${ctx.total.toFixed(2)} ${cur}`
}

function label(ctx: BillNotificationContext): string {
  const parts: string[] = []
  if (ctx.vendorName) parts.push(ctx.vendorName)
  if (ctx.billNumber) parts.push(`#${ctx.billNumber}`)
  return parts.length ? parts.join(' ') : `Bill ${ctx.billId}`
}

async function safeSend(to: string | null | undefined, subject: string, html: string) {
  if (!to) return
  try {
    await sendEmail({ to, subject, html })
  } catch (err) {
    console.warn('[bill-notifications] email send failed:', err)
  }
}

export async function notifyBillSubmitted(ctx: BillNotificationContext): Promise<void> {
  const subject = `Bill submitted for approval — ${label(ctx)}`
  const html = `<p>A bill has been submitted for approval.</p>
    <p><strong>${label(ctx)}</strong>${ctx.total != null ? ` — ${fmtAmount(ctx)}` : ''}</p>`
  await safeSend(ctx.recipientEmail, subject, html)
}

export async function notifyBillApproved(ctx: BillNotificationContext): Promise<void> {
  const subject = `Bill approved — ${label(ctx)}`
  const html = `<p>A bill has been approved.</p>
    <p><strong>${label(ctx)}</strong>${ctx.total != null ? ` — ${fmtAmount(ctx)}` : ''}</p>`
  await safeSend(ctx.recipientEmail, subject, html)
}

export async function notifyBillPaid(ctx: BillNotificationContext): Promise<void> {
  const subject = `Bill marked as paid — ${label(ctx)}`
  const html = `<p>A bill has been marked as paid.</p>
    <p><strong>${label(ctx)}</strong>${ctx.total != null ? ` — ${fmtAmount(ctx)}` : ''}</p>`
  await safeSend(ctx.recipientEmail, subject, html)
}
