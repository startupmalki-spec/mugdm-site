'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion } from 'framer-motion'
import {
  FolderArchive,
  Calculator,
  CalendarDays,
  Upload,
  Plus,
  Calendar,
  Eye,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Sparkles,
  Building2,
  Lightbulb,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { differenceInDays, format, startOfMonth } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'

import { Link } from '@/i18n/routing'
import type { Insight } from '@/app/api/insights/route'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ToastContainer, useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { toHijri, formatHijri } from '@/lib/hijri'
import { getExpiryStatus } from '@/lib/documents'
import { getObligationStatus } from '@/lib/compliance/rules-engine'
import { createClient } from '@/lib/supabase/client'
import type { Obligation, Document, Transaction } from '@/lib/supabase/types'
import { GettingStartedChecklist } from '@/components/ui/getting-started-checklist'
import { TourOverlay, type TourStep } from '@/components/ui/tour-overlay'

// --- Tour steps ---

const TOUR_STEPS: TourStep[] = [
  { target: '[data-tour="welcome"]', titleKey: 'tourWelcomeTitle', descriptionKey: 'tourWelcomeDesc' },
  { target: '[data-tour="compliance"]', titleKey: 'tourComplianceTitle', descriptionKey: 'tourComplianceDesc' },
  { target: '[data-tour="documents"]', titleKey: 'tourDocumentsTitle', descriptionKey: 'tourDocumentsDesc' },
  { target: '[data-tour="financials"]', titleKey: 'tourFinancialsTitle', descriptionKey: 'tourFinancialsDesc' },
  { target: '[data-tour="quick-actions"]', titleKey: 'tourQuickActionsTitle', descriptionKey: 'tourQuickActionsDesc' },
  { target: '[data-tour="chat"]', titleKey: 'tourChatTitle', descriptionKey: 'tourChatDesc' },
]

// --- Constants ---

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

const QUICK_ACTIONS = [
  { href: '/vault', labelKey: 'uploadDocument', icon: Upload, color: 'text-blue-400' },
  { href: '/bookkeeper', labelKey: 'addTransaction', icon: Plus, color: 'text-emerald-400' },
  { href: '/calendar', labelKey: 'checkCalendar', icon: Calendar, color: 'text-amber-400' },
  { href: '/profile', labelKey: 'viewProfile', icon: Eye, color: 'text-purple-400' },
] as const

// --- Data types ---

interface DocCounts {
  valid: number
  expiring: number
  expired: number
}

interface ObligationCounts {
  upcoming: number
  dueSoon: number
  overdue: number
}

interface Financials {
  moneyIn: number
  moneyOut: number
}

interface DashboardData {
  docCounts: DocCounts
  nextObligation: Obligation | null
  obligationCounts: ObligationCounts
  financials: Financials
}

// --- Data fetching ---

async function fetchDashboardData(): Promise<DashboardData | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: business } = (await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .single()) as unknown as { data: { id: string } | null }

  if (!business) return null

  const businessId = business.id

  // Fetch documents, obligations, and transactions in parallel
  const [docsResult, obligationsResult, txResult] = await Promise.all([
    supabase.from('documents')
      .select('expiry_date')
      .eq('business_id', businessId)
      .eq('is_current', true) as unknown as Promise<{ data: Pick<Document, 'expiry_date'>[] | null }>,

    supabase.from('obligations')
      .select('*')
      .eq('business_id', businessId)
      .order('next_due_date', { ascending: true }) as unknown as Promise<{ data: Obligation[] | null }>,

    supabase.from('transactions')
      .select('type, amount')
      .eq('business_id', businessId)
      .gte('date', startOfMonth(new Date()).toISOString().split('T')[0]) as unknown as Promise<{
        data: Pick<Transaction, 'type' | 'amount'>[] | null
      }>,
  ])

  // Compute document counts
  const docCounts: DocCounts = { valid: 0, expiring: 0, expired: 0 }
  for (const doc of docsResult.data ?? []) {
    const status = getExpiryStatus(doc.expiry_date)
    if (status === 'valid') docCounts.valid++
    else if (status === 'expiring') docCounts.expiring++
    else if (status === 'expired') docCounts.expired++
  }

  // Compute obligation data
  const obligations = obligationsResult.data ?? []
  const nextObligation = obligations[0] ?? null

  const obligationCounts: ObligationCounts = { upcoming: 0, dueSoon: 0, overdue: 0 }
  for (const ob of obligations) {
    const status = getObligationStatus(ob.next_due_date, ob.last_completed_at)
    if (status === 'upcoming') obligationCounts.upcoming++
    else if (status === 'due_soon') obligationCounts.dueSoon++
    else if (status === 'overdue') obligationCounts.overdue++
  }

  // Compute financial summary
  const financials: Financials = { moneyIn: 0, moneyOut: 0 }
  for (const tx of txResult.data ?? []) {
    if (tx.type === 'INCOME') financials.moneyIn += tx.amount
    else if (tx.type === 'EXPENSE') financials.moneyOut += tx.amount
  }

  return { docCounts, nextObligation, obligationCounts, financials }
}

// --- Components ---

function StatDot({ className }: { className: string }) {
  return <span className={cn('h-2 w-2 rounded-full', className)} />
}

function ComplianceCard({
  nextObligation,
  obligationCounts,
}: {
  nextObligation: Obligation | null
  obligationCounts: ObligationCounts
}) {
  const t = useTranslations('dashboard')
  const tCal = useTranslations('calendar')
  const locale = useLocale()
  const dateLocale = locale === 'ar' ? ar : enUS

  return (
    <motion.div variants={ITEM_VARIANTS} data-tour="compliance">
      <Link
        href="/calendar"
        className="group block rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:bg-surface-2"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('complianceOverview')}
          </h3>
          <CalendarDays className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>

        {nextObligation ? (
          <>
            {/* Next obligation */}
            {(() => {
              const daysUntil = differenceInDays(
                new Date(nextObligation.next_due_date),
                new Date()
              )
              const status =
                daysUntil < 0 ? 'overdue' : daysUntil <= 15 ? 'due_soon' : 'upcoming'

              return (
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      status === 'overdue'
                        ? 'bg-red-500/10'
                        : status === 'due_soon'
                          ? 'bg-amber-500/10'
                          : 'bg-blue-500/10'
                    )}
                  >
                    <Clock
                      className={cn(
                        'h-5 w-5',
                        status === 'overdue'
                          ? 'text-red-400'
                          : status === 'due_soon'
                            ? 'text-amber-400'
                            : 'text-blue-400'
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {nextObligation.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(nextObligation.next_due_date), 'dd MMM yyyy', {
                        locale: dateLocale,
                      })}
                      {' · '}
                      {daysUntil > 0
                        ? tCal('daysRemaining', { count: daysUntil })
                        : daysUntil === 0
                          ? tCal('dueToday')
                          : tCal('daysOverdue', { count: Math.abs(daysUntil) })}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Summary badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                <StatDot className="bg-blue-400" />
                {obligationCounts.upcoming} {tCal('upcoming')}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                <StatDot className="bg-amber-400" />
                {obligationCounts.dueSoon} {tCal('dueSoon')}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-red-400">
                <StatDot className="bg-red-400" />
                {obligationCounts.overdue} {tCal('overdue')}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t('noDataYet')}</p>
        )}
      </Link>
    </motion.div>
  )
}

function DocumentStatusCard({ docCounts }: { docCounts: DocCounts }) {
  const t = useTranslations('dashboard')
  const tVault = useTranslations('vault')
  const total = docCounts.valid + docCounts.expiring + docCounts.expired

  return (
    <motion.div variants={ITEM_VARIANTS} data-tour="documents">
      <Link
        href="/vault"
        className="group block rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:bg-surface-2"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('documentStatus')}
          </h3>
          <FolderArchive className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>

        {total > 0 ? (
          <>
            <div className="mt-4 flex items-end gap-6">
              <div>
                <p className="text-3xl font-bold text-foreground">{total}</p>
                <p className="text-xs text-muted-foreground">{t('totalDocuments')}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <StatDot className="bg-emerald-400" />
                {docCounts.valid} {tVault('status.valid')}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                <StatDot className="bg-amber-400" />
                {docCounts.expiring} {tVault('status.expiringSoon')}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-red-400">
                <StatDot className="bg-red-400" />
                {docCounts.expired} {tVault('status.expired')}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t('noDataYet')}</p>
        )}
      </Link>
    </motion.div>
  )
}

function FinancialSummaryCard({ financials }: { financials: Financials }) {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tBook = useTranslations('bookkeeper')

  const net = financials.moneyIn - financials.moneyOut
  const isPositive = net >= 0
  const hasData = financials.moneyIn > 0 || financials.moneyOut > 0

  return (
    <motion.div variants={ITEM_VARIANTS} data-tour="financials">
      <Link
        href="/bookkeeper"
        className="group block rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:bg-surface-2"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('financialSummary')}
          </h3>
          <Calculator className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>

        {hasData ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-muted-foreground">{tBook('moneyIn')}</span>
              </div>
              <span className="text-sm font-semibold text-emerald-400">
                {financials.moneyIn.toLocaleString()} {tCommon('sar')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-sm text-muted-foreground">{tBook('moneyOut')}</span>
              </div>
              <span className="text-sm font-semibold text-red-400">
                {financials.moneyOut.toLocaleString()} {tCommon('sar')}
              </span>
            </div>

            <div className="border-t border-border pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {tBook('netPosition')}
                </span>
                <span
                  className={cn(
                    'text-sm font-bold',
                    isPositive ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {isPositive ? '+' : ''}
                  {net.toLocaleString()} {tCommon('sar')}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t('noDataYet')}</p>
        )}
      </Link>
    </motion.div>
  )
}

function AiWarningsCard() {
  const t = useTranslations('dashboard')

  return (
    <motion.div variants={ITEM_VARIANTS}>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">{t('attentionNeeded')}</h3>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-400">{t('allGood')}</p>
            <p className="text-xs text-muted-foreground">{t('allGoodDescription')}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// --- Insights cache helpers ---

const INSIGHTS_CACHE_KEY = 'mugdm_insights_cache'
const INSIGHTS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function getCachedInsights(): Insight[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(INSIGHTS_CACHE_KEY)
    if (!raw) return null
    const { insights, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > INSIGHTS_CACHE_TTL) {
      localStorage.removeItem(INSIGHTS_CACHE_KEY)
      return null
    }
    return insights
  } catch {
    return null
  }
}

function setCachedInsights(insights: Insight[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      INSIGHTS_CACHE_KEY,
      JSON.stringify({ insights, timestamp: Date.now() })
    )
  } catch {
    // localStorage may be full
  }
}

const PRIORITY_CONFIG = {
  high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertCircle },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Lightbulb },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Lightbulb },
}

function AiInsightsPanel() {
  const t = useTranslations('dashboard')
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchInsights = useCallback(async (force = false) => {
    if (!force) {
      const cached = getCachedInsights()
      if (cached) {
        setInsights(cached)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/insights')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const insightsList = data.insights ?? []
      setInsights(insightsList)
      setCachedInsights(insightsList)
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  return (
    <motion.div variants={ITEM_VARIANTS}>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{t('aiInsights')}</h3>
          </div>
          <button
            type="button"
            onClick={() => fetchInsights(true)}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            title={t('refreshInsights')}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {isLoading && insights.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-2" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 rounded-lg bg-red-500/5 border border-red-500/10 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <p className="text-sm text-red-400">{t('insightsError')}</p>
            </div>
          ) : insights.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-400">{t('allGood')}</p>
                <p className="text-xs text-muted-foreground">{t('allGoodDescription')}</p>
              </div>
            </div>
          ) : (
            insights.map((insight, i) => {
              const config = PRIORITY_CONFIG[insight.priority] || PRIORITY_CONFIG.low
              const Icon = config.icon
              return (
                <Link
                  key={i}
                  href={insight.action_url as '/calendar' | '/vault' | '/bookkeeper' | '/team' | '/profile'}
                  className={cn(
                    'group flex items-start gap-3 rounded-lg border p-3 transition-all hover:bg-surface-2',
                    config.border,
                    config.bg
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-medium', config.color)}>{insight.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{insight.description}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              )
            })
          )}
        </div>
      </div>
    </motion.div>
  )
}

function WeeklyActionItems({ obligationCounts, nextObligation }: { obligationCounts: ObligationCounts; nextObligation: Obligation | null }) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const dateLocale = locale === 'ar' ? ar : enUS

  const items: { label: string; href: string; urgent: boolean }[] = []

  if (obligationCounts.overdue > 0) {
    items.push({
      label: t('weeklyOverdueAction', { count: obligationCounts.overdue }),
      href: '/calendar',
      urgent: true,
    })
  }
  if (obligationCounts.dueSoon > 0) {
    items.push({
      label: t('weeklyDueSoonAction', { count: obligationCounts.dueSoon }),
      href: '/calendar',
      urgent: false,
    })
  }
  if (nextObligation) {
    const daysUntil = differenceInDays(new Date(nextObligation.next_due_date), new Date())
    if (daysUntil >= 0 && daysUntil <= 7) {
      items.push({
        label: t('weeklyNextAction', {
          name: nextObligation.name,
          date: format(new Date(nextObligation.next_due_date), 'dd MMM', { locale: dateLocale }),
        }),
        href: '/calendar',
        urgent: daysUntil <= 2,
      })
    }
  }

  if (items.length === 0) return null

  return (
    <motion.div variants={ITEM_VARIANTS}>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">{t('weeklyActionItems')}</h3>
        </div>
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li key={i}>
              <Link
                href={item.href as '/calendar'}
                className={cn(
                  'flex items-center gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-surface-2',
                  item.urgent ? 'text-red-400' : 'text-foreground'
                )}
              >
                <span className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  item.urgent ? 'bg-red-400' : 'bg-amber-400'
                )} />
                {item.label}
                <ArrowRight className="ms-auto h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

// --- Page ---

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const tEmpty = useTranslations('emptyStates')
  const locale = useLocale()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toasts, showToast, dismissToast } = useToast()

  useEffect(() => {
    fetchDashboardData()
      .then(setData)
      .catch(() => showToast(locale === 'ar' ? 'فشل في تحميل البيانات' : 'Failed to load data', 'error'))
      .finally(() => setIsLoading(false))
  }, [locale, showToast])

  const emptyData: DashboardData = {
    docCounts: { valid: 0, expiring: 0, expired: 0 },
    nextObligation: null,
    obligationCounts: { upcoming: 0, dueSoon: 0, overdue: 0 },
    financials: { moneyIn: 0, moneyOut: 0 },
  }

  const displayData = data ?? emptyData

  return (
    <motion.div
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Guided Tour */}
      <TourOverlay steps={TOUR_STEPS} ns="dashboard" />

      {/* Welcome Header */}
      <motion.div variants={ITEM_VARIANTS} data-tour="welcome">
        <h1 className="text-2xl font-bold text-foreground">{t('welcomeDefault')}</h1>
        <p className="mt-1 text-muted-foreground">
          {format(new Date(), 'EEEE, dd MMMM yyyy', {
            locale: locale === 'ar' ? ar : enUS,
          })}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground/70">
          {formatHijri(toHijri(new Date()), locale)}
        </p>
      </motion.div>

      {/* Quick Actions */}
      <motion.section variants={ITEM_VARIANTS} data-tour="quick-actions">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('quickActions')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-5 text-center transition-all hover:border-primary/30 hover:bg-surface-2"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 transition-colors group-hover:bg-primary/10">
                  <Icon className={cn('h-5 w-5', action.color)} />
                </div>
                <span className="text-xs font-medium text-foreground">
                  {t(action.labelKey)}
                </span>
              </Link>
            )
          })}
        </div>
      </motion.section>

      {/* Getting Started Checklist */}
      <motion.div variants={ITEM_VARIANTS}>
        <GettingStartedChecklist />
      </motion.div>

      {/* Loading state */}
      {isLoading ? (
        <motion.div variants={ITEM_VARIANTS} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
          <Skeleton className="h-24" />
        </motion.div>
      ) : data === null ? (
        <motion.div variants={ITEM_VARIANTS}>
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title={tEmpty('completeOnboarding')}
            description={tEmpty('completeOnboardingDesc')}
            actionLabel={tEmpty('completeOnboarding')}
            actionHref="/onboarding"
          />
        </motion.div>
      ) : (
        <>
          {/* Status Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ComplianceCard
              nextObligation={displayData.nextObligation}
              obligationCounts={displayData.obligationCounts}
            />
            <DocumentStatusCard docCounts={displayData.docCounts} />
            <FinancialSummaryCard financials={displayData.financials} />
          </div>

          {/* AI Insights Panel */}
          <AiInsightsPanel />

          {/* Weekly Action Items */}
          <WeeklyActionItems
            obligationCounts={displayData.obligationCounts}
            nextObligation={displayData.nextObligation}
          />

          {/* AI Warnings (legacy) */}
          <AiWarningsCard />
        </>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </motion.div>
  )
}
