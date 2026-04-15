'use client'

/**
 * Outstanding AP summary card + overdue mini-badge.
 *
 * Renders only when NEXT_PUBLIC_FEATURE_BILLS === 'true'. Both the Dashboard
 * and the Bookkeeper page mount this component; the `ns` prop selects which
 * i18n namespace the card pulls labels from (dashboard.outstandingAp.* vs
 * bookkeeper.outstandingAp.*).
 *
 * Data: single client-side Supabase query that selects only `total, status`
 * from bills where status IN (pending, approved, overdue). RLS already scopes
 * to the authenticated business. This mirrors `sumApOutstanding` in
 * `src/lib/agents/bills-chat-tools.ts` but runs in the browser so we can
 * continue to render the existing client-rendered pages without refactoring
 * them to RSC. The query is small (3 statuses, two columns, no joins) and is
 * only fetched on mount.
 */

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion } from 'framer-motion'
import { Wallet, AlertTriangle } from 'lucide-react'

import { Link } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'
import { formatSAR } from '@/lib/bookkeeper/calculations'
import { cn } from '@/lib/utils'

export function billsFeatureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_BILLS === 'true'
}

interface ApTotals {
  count: number
  totalSar: number
  overdueCount: number
}

async function fetchApTotals(): Promise<ApTotals | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bills')
    .select('total, status')
    .in('status', ['pending', 'approved', 'overdue'])

  if (error) return null

  let count = 0
  let totalSar = 0
  let overdueCount = 0
  for (const row of (data ?? []) as Array<{ total: number | string; status: string }>) {
    count += 1
    totalSar += Number(row.total ?? 0)
    if (row.status === 'overdue') overdueCount += 1
  }
  return { count, totalSar, overdueCount }
}

const CARD_LINK = '/bookkeeper/bills?status=overdue,approved,pending'

interface OutstandingApCardProps {
  /** i18n namespace for labels: 'dashboard' or 'bookkeeper'. */
  ns: 'dashboard' | 'bookkeeper'
  className?: string
}

/**
 * Clickable summary card. Returns null when the feature flag is off.
 */
export function OutstandingApCard({ ns, className }: OutstandingApCardProps) {
  const t = useTranslations(`${ns}.outstandingAp`)
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [data, setData] = useState<ApTotals | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!billsFeatureEnabled()) return
    fetchApTotals()
      .then(setData)
      .finally(() => setLoaded(true))
  }, [])

  if (!billsFeatureEnabled()) return null

  const count = data?.count ?? 0
  const totalSar = data?.totalSar ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link
        href={CARD_LINK as '/bookkeeper'}
        className={cn(
          'group block rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:bg-surface-2',
          className
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{t('title')}</p>
          <div className="rounded-lg bg-amber-500/10 p-2">
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold tabular-nums text-amber-400" dir="ltr">
          {loaded ? formatSAR(totalSar, locale) : '—'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('countLabel', { count })} · {tCommon('sar')}
        </p>
      </Link>
    </motion.div>
  )
}

/**
 * Small red overdue badge for the Dashboard. Fetches independently (cheap) so
 * it can render next to the welcome header without the parent threading data
 * through. Renders null when feature flag off or no overdue bills exist.
 */
export function OverdueBillsBadge() {
  const t = useTranslations('dashboard.outstandingAp')
  const [overdue, setOverdue] = useState(0)

  useEffect(() => {
    if (!billsFeatureEnabled()) return
    fetchApTotals().then((d) => setOverdue(d?.overdueCount ?? 0))
  }, [])

  if (!billsFeatureEnabled() || overdue <= 0) return null

  return (
    <Link
      href={'/bookkeeper/bills?status=overdue' as '/bookkeeper'}
      className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
    >
      <AlertTriangle className="h-3 w-3" />
      {t('overdueBadge', { count: overdue })}
    </Link>
  )
}
