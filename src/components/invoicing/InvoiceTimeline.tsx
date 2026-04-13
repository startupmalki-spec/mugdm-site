'use client'

/**
 * Vertical bilingual timeline of an invoice's lifecycle (Task 61).
 *
 * Renders a simple vertical list of the key state-transition timestamps:
 *   created_at → submitted_at → cleared_at | rejected_at
 *
 * `rejected_at` doesn't exist as a dedicated column in `invoices`; we surface
 * the rejection by colouring the "submitted" step red and adding a follow-up
 * "Rejected" entry that uses `zatca_submitted_at` as a best-effort approximation
 * (ZATCA returns the rejection synchronously, so the submission timestamp is
 * effectively the rejection timestamp). If a richer column is added later this
 * component just needs the new prop.
 */

import { useTranslations } from 'next-intl'
import { CheckCircle2, Clock, Send, XCircle, FileText } from 'lucide-react'

import type { ZatcaStatus } from '@/lib/supabase/types'

interface InvoiceTimelineProps {
  status: ZatcaStatus
  createdAt: string
  submittedAt: string | null
  clearedAt: string | null
  rejectedAt?: string | null
  rejectionReason?: string | null
  locale: 'ar' | 'en'
}

function formatDateTime(iso: string | null | undefined, locale: 'ar' | 'en') {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

interface Step {
  key: string
  icon: React.ReactNode
  label: string
  ts: string | null
  tone: 'muted' | 'active' | 'success' | 'error'
}

export function InvoiceTimeline({
  status,
  createdAt,
  submittedAt,
  clearedAt,
  rejectedAt,
  rejectionReason,
  locale,
}: InvoiceTimelineProps) {
  const t = useTranslations('invoicing.invoices.detail.timeline')

  const steps: Step[] = [
    {
      key: 'created',
      icon: <FileText className="w-4 h-4" />,
      label: t('created'),
      ts: formatDateTime(createdAt, locale),
      tone: 'success',
    },
    {
      key: 'submitted',
      icon: <Send className="w-4 h-4" />,
      label: t('submitted'),
      ts: formatDateTime(submittedAt, locale),
      tone: submittedAt
        ? status === 'rejected'
          ? 'error'
          : 'success'
        : status === 'pending_clearance'
          ? 'active'
          : 'muted',
    },
  ]

  if (status === 'rejected') {
    steps.push({
      key: 'rejected',
      icon: <XCircle className="w-4 h-4" />,
      label: t('rejected'),
      ts: formatDateTime(rejectedAt ?? submittedAt, locale),
      tone: 'error',
    })
  } else if (status === 'cleared' || status === 'reported' || clearedAt) {
    steps.push({
      key: 'cleared',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: status === 'reported' ? t('reported') : t('cleared'),
      ts: formatDateTime(clearedAt, locale),
      tone: 'success',
    })
  } else if (status === 'pending_clearance') {
    steps.push({
      key: 'pending',
      icon: <Clock className="w-4 h-4" />,
      label: t('pending'),
      ts: null,
      tone: 'active',
    })
  }

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <h3 className="text-sm font-semibold mb-4">{t('title')}</h3>
      <ol className="relative ms-2">
        {steps.map((s, i) => {
          const dotColor =
            s.tone === 'success'
              ? 'bg-emerald-500 text-white'
              : s.tone === 'error'
                ? 'bg-rose-500 text-white'
                : s.tone === 'active'
                  ? 'bg-amber-500 text-white'
                  : 'bg-muted text-muted-foreground'
          return (
            <li key={s.key} className="relative ps-8 pb-5 last:pb-0">
              {i < steps.length - 1 && (
                <span className="absolute start-3 top-6 bottom-0 w-px bg-border" />
              )}
              <span
                className={`absolute start-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded-full ${dotColor}`}
              >
                {s.icon}
              </span>
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground">
                {s.ts ?? t('notYet')}
              </div>
              {s.key === 'rejected' && rejectionReason && (
                <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                  {rejectionReason}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
