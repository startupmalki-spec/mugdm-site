/**
 * Task 64 — B2C reporting queue health widget.
 *
 * Shows pending / processing-soon / dead-letter counts for simplified
 * invoices that are waiting to be reported to ZATCA by the background
 * worker. Read-only: relies on the `zatca_report_queue` RLS SELECT policy
 * so users only see rows for businesses they own.
 *
 * NOTE (task 64 → task 60 coordination):
 *   This component is intentionally NOT imported anywhere yet. Task 60
 *   (invoices list page) is being built in parallel by another agent. Once
 *   that lands, add:
 *
 *     import { ReportQueueHealth } from '@/components/invoicing/ReportQueueHealth'
 *     ...
 *     <ReportQueueHealth businessId={businessId} locale={locale} />
 *
 *   near the top of `src/app/[locale]/(app)/invoicing/invoices/page.tsx`.
 */

'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface Props {
  businessId: string
  locale?: 'ar' | 'en'
}

interface Counts {
  pending: number
  retrying: number
  deadLetter: number
}

export function ReportQueueHealth({ businessId, locale = 'en' }: Props) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('zatca_report_queue')
        .select('attempts, dead_letter, next_attempt_at')
        .eq('business_id', businessId)
      if (cancelled) return
      if (error || !data) {
        setCounts({ pending: 0, retrying: 0, deadLetter: 0 })
        setLoading(false)
        return
      }
      const rows = data as Array<{
        attempts: number
        dead_letter: boolean
        next_attempt_at: string
      }>
      const next: Counts = { pending: 0, retrying: 0, deadLetter: 0 }
      for (const r of rows) {
        if (r.dead_letter) next.deadLetter += 1
        else if (r.attempts === 0) next.pending += 1
        else next.retrying += 1
      }
      setCounts(next)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [businessId])

  if (loading || !counts) return null
  const total = counts.pending + counts.retrying + counts.deadLetter
  if (total === 0) return null

  const isAr = locale === 'ar'
  const labels = {
    title: isAr ? 'حالة طابور الإبلاغ (فواتير مبسطة)' : 'Reporting queue (simplified invoices)',
    pending: isAr ? 'في الانتظار' : 'Pending',
    retrying: isAr ? 'إعادة المحاولة' : 'Retrying',
    deadLetter: isAr ? 'فشل متكرر' : 'Dead-lettered',
  }

  return (
    <div
      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="font-medium mb-1">{labels.title}</div>
      <div className="flex gap-4">
        <span>
          {labels.pending}: <strong>{counts.pending}</strong>
        </span>
        <span>
          {labels.retrying}: <strong>{counts.retrying}</strong>
        </span>
        <span className={counts.deadLetter > 0 ? 'text-red-700' : ''}>
          {labels.deadLetter}: <strong>{counts.deadLetter}</strong>
        </span>
      </div>
    </div>
  )
}
