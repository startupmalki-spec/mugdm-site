'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion } from 'framer-motion'
import {
  FolderArchive,
  Calculator,
  CalendarDays,
  Building2,
  Upload,
  Plus,
  Calendar,
  Eye,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { differenceInDays, format } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'

import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getExpiryStatus, getExpiryDotColor } from '@/lib/documents'
import {
  getObligationStatus,
  getObligationDotColor,
} from '@/lib/compliance/rules-engine'

// --- Constants ---

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

// --- Mock data for demonstration ---

const MOCK_DOC_COUNTS = { valid: 3, expiring: 1, expired: 1 }

const MOCK_OBLIGATION = {
  name: 'VAT Return Q2',
  dueDate: new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate() + 5
  ),
  type: 'ZATCA_VAT' as const,
}

const MOCK_OBLIGATION_COUNTS = { upcoming: 2, dueSoon: 1, overdue: 1 }

const MOCK_FINANCIALS = {
  moneyIn: 45200,
  moneyOut: 28750,
}

const QUICK_ACTIONS = [
  { href: '/vault', labelKey: 'uploadDocument', icon: Upload, color: 'text-blue-400' },
  { href: '/bookkeeper', labelKey: 'addTransaction', icon: Plus, color: 'text-emerald-400' },
  { href: '/calendar', labelKey: 'checkCalendar', icon: Calendar, color: 'text-amber-400' },
  { href: '/profile', labelKey: 'viewProfile', icon: Eye, color: 'text-purple-400' },
] as const

// --- Components ---

function StatDot({ className }: { className: string }) {
  return <span className={cn('h-2 w-2 rounded-full', className)} />
}

function ComplianceCard() {
  const t = useTranslations('dashboard')
  const tCal = useTranslations('calendar')
  const locale = useLocale()
  const dateLocale = locale === 'ar' ? ar : enUS

  const daysUntil = differenceInDays(MOCK_OBLIGATION.dueDate, new Date())
  const status = daysUntil <= 0 ? 'overdue' : daysUntil <= 15 ? 'due_soon' : 'upcoming'

  return (
    <motion.div variants={ITEM_VARIANTS}>
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

        {/* Next obligation */}
        <div className="mt-4 flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            status === 'overdue' ? 'bg-red-500/10' : status === 'due_soon' ? 'bg-amber-500/10' : 'bg-blue-500/10'
          )}>
            <Clock className={cn(
              'h-5 w-5',
              status === 'overdue' ? 'text-red-400' : status === 'due_soon' ? 'text-amber-400' : 'text-blue-400'
            )} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{MOCK_OBLIGATION.name}</p>
            <p className="text-xs text-muted-foreground">
              {format(MOCK_OBLIGATION.dueDate, 'dd MMM yyyy', { locale: dateLocale })}
              {' · '}
              {daysUntil > 0
                ? tCal('daysRemaining', { count: daysUntil })
                : daysUntil === 0
                  ? tCal('dueToday')
                  : tCal('daysOverdue', { count: Math.abs(daysUntil) })}
            </p>
          </div>
        </div>

        {/* Summary badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-blue-400">
            <StatDot className="bg-blue-400" />
            {MOCK_OBLIGATION_COUNTS.upcoming} {tCal('upcoming')}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <StatDot className="bg-amber-400" />
            {MOCK_OBLIGATION_COUNTS.dueSoon} {tCal('dueSoon')}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-red-400">
            <StatDot className="bg-red-400" />
            {MOCK_OBLIGATION_COUNTS.overdue} {tCal('overdue')}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function DocumentStatusCard() {
  const t = useTranslations('dashboard')
  const tVault = useTranslations('vault')

  return (
    <motion.div variants={ITEM_VARIANTS}>
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

        <div className="mt-4 flex items-end gap-6">
          <div>
            <p className="text-3xl font-bold text-foreground">
              {MOCK_DOC_COUNTS.valid + MOCK_DOC_COUNTS.expiring + MOCK_DOC_COUNTS.expired}
            </p>
            <p className="text-xs text-muted-foreground">{t('totalDocuments')}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <StatDot className="bg-emerald-400" />
            {MOCK_DOC_COUNTS.valid} {tVault('status.valid')}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-amber-400">
            <StatDot className="bg-amber-400" />
            {MOCK_DOC_COUNTS.expiring} {tVault('status.expiringSoon')}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-red-400">
            <StatDot className="bg-red-400" />
            {MOCK_DOC_COUNTS.expired} {tVault('status.expired')}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function FinancialSummaryCard() {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tBook = useTranslations('bookkeeper')

  const net = MOCK_FINANCIALS.moneyIn - MOCK_FINANCIALS.moneyOut
  const isPositive = net >= 0

  return (
    <motion.div variants={ITEM_VARIANTS}>
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

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-muted-foreground">{tBook('moneyIn')}</span>
            </div>
            <span className="text-sm font-semibold text-emerald-400">
              {MOCK_FINANCIALS.moneyIn.toLocaleString()} {tCommon('sar')}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="text-sm text-muted-foreground">{tBook('moneyOut')}</span>
            </div>
            <span className="text-sm font-semibold text-red-400">
              {MOCK_FINANCIALS.moneyOut.toLocaleString()} {tCommon('sar')}
            </span>
          </div>

          <div className="border-t border-border pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{tBook('netPosition')}</span>
              <span className={cn(
                'text-sm font-bold',
                isPositive ? 'text-emerald-400' : 'text-red-400'
              )}>
                {isPositive ? '+' : ''}{net.toLocaleString()} {tCommon('sar')}
              </span>
            </div>
          </div>
        </div>
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

// --- Page ---

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const locale = useLocale()

  return (
    <motion.div
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Welcome Header */}
      <motion.div variants={ITEM_VARIANTS}>
        <h1 className="text-2xl font-bold text-foreground">{t('welcomeDefault')}</h1>
        <p className="mt-1 text-muted-foreground">
          {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: locale === 'ar' ? ar : enUS })}
        </p>
      </motion.div>

      {/* Quick Actions */}
      <motion.section variants={ITEM_VARIANTS}>
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
                <span className="text-xs font-medium text-foreground">{t(action.labelKey)}</span>
              </Link>
            )
          })}
        </div>
      </motion.section>

      {/* Status Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ComplianceCard />
        <DocumentStatusCard />
        <FinancialSummaryCard />
      </div>

      {/* AI Warnings */}
      <AiWarningsCard />
    </motion.div>
  )
}
