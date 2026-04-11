'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Clock,
  Upload,
  Info,
  FileText,
  CreditCard,
  Receipt,
  PenLine,
  ArrowUpRight,
  Loader2,
  Search,
} from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  calculateSummary,
  calculateCategoryBreakdown,
  calculateMonthlyTrend,
  calculateCashFlow,
  calculateVATEstimate,
  formatSAR,
  getCategoryColor,
  type DateRange,
} from '@/lib/bookkeeper/calculations'
import { TransactionForm } from '@/components/bookkeeper/TransactionForm'
import { ReceiptCapture } from '@/components/bookkeeper/ReceiptCapture'
import { Skeleton } from '@/components/ui/skeleton'
import { ToastContainer, useToast } from '@/components/ui/toast'
import type { Transaction, TransactionCategory, TransactionSource } from '@/lib/supabase/types'

type PeriodKey = 'this_month' | '3_months' | '6_months' | 'this_year'

const PERIOD_KEYS: PeriodKey[] = ['this_month', '3_months', '6_months', 'this_year']

const CATEGORY_LABEL_MAP: Record<TransactionCategory, { en: string; ar: string }> = {
  REVENUE: { en: 'Revenue', ar: 'إيرادات' },
  OTHER_INCOME: { en: 'Other Income', ar: 'إيرادات أخرى' },
  GOVERNMENT: { en: 'Government', ar: 'حكومي' },
  SALARY: { en: 'Salaries', ar: 'رواتب' },
  RENT: { en: 'Rent', ar: 'إيجار' },
  UTILITIES: { en: 'Utilities', ar: 'مرافق' },
  SUPPLIES: { en: 'Supplies', ar: 'مستلزمات' },
  TRANSPORT: { en: 'Transport', ar: 'نقل' },
  MARKETING: { en: 'Marketing', ar: 'تسويق' },
  PROFESSIONAL: { en: 'Professional', ar: 'مهني' },
  INSURANCE: { en: 'Insurance', ar: 'تأمين' },
  BANK_FEES: { en: 'Bank Fees', ar: 'بنكية' },
  OTHER_EXPENSE: { en: 'Other', ar: 'أخرى' },
}

const SOURCE_ICONS: Record<TransactionSource, typeof FileText> = {
  BANK_STATEMENT_CSV: CreditCard,
  BANK_STATEMENT_PDF: FileText,
  RECEIPT_PHOTO: Receipt,
  MANUAL: PenLine,
}

function getPeriodRange(key: PeriodKey): DateRange {
  const now = new Date()
  switch (key) {
    case 'this_month':
      return { start: startOfMonth(now), end: endOfDay(now) }
    case '3_months':
      return { start: startOfMonth(subMonths(now, 2)), end: endOfDay(now) }
    case '6_months':
      return { start: startOfMonth(subMonths(now, 5)), end: endOfDay(now) }
    case 'this_year':
      return { start: startOfYear(now), end: endOfDay(now) }
  }
}

function getPeriodLabel(key: PeriodKey, locale: string): string {
  const labels: Record<PeriodKey, { en: string; ar: string }> = {
    this_month: { en: 'This Month', ar: 'هذا الشهر' },
    '3_months': { en: '3 Months', ar: '3 أشهر' },
    '6_months': { en: '6 Months', ar: '6 أشهر' },
    this_year: { en: 'This Year', ar: 'هذه السنة' },
  }
  return labels[key][locale === 'ar' ? 'ar' : 'en']
}

function getMonthsForPeriod(key: PeriodKey): number {
  switch (key) {
    case 'this_month': return 1
    case '3_months': return 3
    case '6_months': return 6
    case 'this_year': return 6
  }
}

const CHART_THEME = {
  gridColor: '#33334a',
  textColor: '#8888a8',
  tooltipBg: 'var(--color-card)',
  tooltipBorder: '#33334a',
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' as const },
  }),
}

export default function BookkeeperPage() {
  const t = useTranslations('bookkeeper')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [activePeriod, setActivePeriod] = useState<PeriodKey>('3_months')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [businessId, setBusinessId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [nextVatDueDate, setNextVatDueDate] = useState<string | null>(null)
  const [txSearch, setTxSearch] = useState('')
  const [txCategoryFilter, setTxCategoryFilter] = useState<TransactionCategory | 'ALL'>('ALL')
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')

  const { toasts, showToast, dismissToast } = useToast()

  useEffect(() => {
    async function loadTransactions() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setIsLoading(false)
          return
        }

        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('user_id', user.id)
          .single() as { data: { id: string } | null; error: unknown }

        if (!biz) {
          setIsLoading(false)
          return
        }

        setBusinessId(biz.id)

        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('business_id', biz.id)
          .order('date', { ascending: false }) as { data: Transaction[] | null; error: unknown }

        if (txData) setTransactions(txData)

        const { data: vatObligation } = await (supabase.from('obligations') as any)
          .select('next_due_date')
          .eq('business_id', biz.id)
          .eq('type', 'ZATCA_VAT')
          .order('next_due_date', { ascending: true })
          .limit(1)
          .single() as { data: { next_due_date: string } | null; error: unknown }

        if (vatObligation) setNextVatDueDate(vatObligation.next_due_date)
      } catch {
        showToast(locale === 'ar' ? 'فشل في تحميل البيانات' : 'Failed to load data', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    loadTransactions()
  }, [locale, showToast])

  const periodRange = useMemo(() => getPeriodRange(activePeriod), [activePeriod])

  const summary = useMemo(
    () => calculateSummary(transactions, periodRange),
    [transactions, periodRange]
  )

  const periodTransactions = useMemo(
    () => transactions.filter((tx) => {
      const d = new Date(tx.date)
      return d >= periodRange.start && d <= periodRange.end
    }),
    [transactions, periodRange]
  )

  const categoryBreakdown = useMemo(
    () => calculateCategoryBreakdown(periodTransactions),
    [periodTransactions]
  )

  const monthlyTrend = useMemo(
    () => calculateMonthlyTrend(transactions, getMonthsForPeriod(activePeriod)),
    [transactions, activePeriod]
  )

  const cashFlow = useMemo(
    () => calculateCashFlow(transactions),
    [transactions]
  )

  const vatEstimate = useMemo(
    () => calculateVATEstimate(periodTransactions),
    [periodTransactions]
  )

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions]
  )

  const filteredTransactions = useMemo(() => {
    let result = recentTransactions
    if (txTypeFilter !== 'ALL') {
      result = result.filter((tx) => tx.type === txTypeFilter)
    }
    if (txCategoryFilter !== 'ALL') {
      result = result.filter((tx) => tx.category === txCategoryFilter)
    }
    if (txSearch.trim()) {
      const query = txSearch.trim().toLowerCase()
      result = result.filter(
        (tx) =>
          tx.description?.toLowerCase().includes(query) ||
          tx.vendor_or_client?.toLowerCase().includes(query)
      )
    }
    return result
  }, [recentTransactions, txTypeFilter, txCategoryFilter, txSearch])

  const totalExpenses = useMemo(
    () => categoryBreakdown.reduce((sum, item) => sum + item.amount, 0),
    [categoryBreakdown]
  )

  const upcomingPaymentsCount = useMemo(() => {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    return transactions.filter((tx) => {
      const d = new Date(tx.date)
      return tx.type === 'EXPENSE' && d > now && d <= in30Days
    }).length
  }, [transactions])

  const handleAddTransaction = useCallback(async (data: {
    date: string; amount: number; type: 'INCOME' | 'EXPENSE';
    category: TransactionCategory; description: string; vendor_or_client: string
  }) => {
    if (!businessId) return

    const supabase = createClient()
    const payload = {
      business_id: businessId,
      date: data.date,
      amount: data.amount,
      type: data.type,
      category: data.category,
      description: data.description,
      vendor_or_client: data.vendor_or_client,
      source: 'MANUAL' as const,
      source_file_id: null,
      receipt_url: null,
      linked_obligation_id: null,
      vat_amount: null,
      ai_confidence: null,
      is_reviewed: true,
    }

    const { data: newTx } = await (supabase.from('transactions') as any)
      .insert(payload)
      .select()
      .single() as { data: Transaction | null; error: unknown }

    if (newTx) {
      setTransactions((prev) => [newTx, ...prev])
    }
  }, [businessId])

  const handleAddReceipt = useCallback(async (data: {
    amount: number; vendor: string; date: string;
    category: TransactionCategory; vatAmount: number; description: string
  }) => {
    if (!businessId) return

    const supabase = createClient()
    const payload = {
      business_id: businessId,
      date: data.date,
      amount: data.amount,
      type: 'EXPENSE' as const,
      category: data.category,
      description: data.description,
      vendor_or_client: data.vendor,
      source: 'RECEIPT_PHOTO' as const,
      source_file_id: null,
      receipt_url: null,
      linked_obligation_id: null,
      vat_amount: data.vatAmount,
      ai_confidence: 0.85,
      is_reviewed: true,
    }

    const { data: newTx } = await (supabase.from('transactions') as any)
      .insert(payload)
      .select()
      .single() as { data: Transaction | null; error: unknown }

    if (newTx) {
      setTransactions((prev) => [newTx, ...prev])
    }
  }, [businessId])

  const sarLabel = tCommon('sar')

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="space-y-8">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ReceiptCapture onSave={handleAddReceipt} />
            <TransactionForm onSave={handleAddTransaction} />
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-1 rounded-lg bg-surface-1 p-1">
          {PERIOD_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActivePeriod(key)}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all',
                activePeriod === key
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {getPeriodLabel(key, locale)}
            </button>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Money In */}
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('moneyIn')}</p>
              <div className="rounded-lg bg-green-500/10 p-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-green-400" dir="ltr">
              {formatSAR(summary.income, locale)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{sarLabel}</p>
          </motion.div>

          {/* Money Out */}
          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('moneyOut')}</p>
              <div className="rounded-lg bg-red-500/10 p-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-red-400" dir="ltr">
              {formatSAR(summary.expenses, locale)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{sarLabel}</p>
          </motion.div>

          {/* Net Position */}
          <motion.div
            custom={2}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('netPosition')}</p>
              <div className={cn(
                'rounded-lg p-2',
                summary.net >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'
              )}>
                <Scale className={cn(
                  'h-4 w-4',
                  summary.net >= 0 ? 'text-blue-400' : 'text-red-400'
                )} />
              </div>
            </div>
            <p
              className={cn(
                'mt-3 text-2xl font-bold tabular-nums',
                summary.net >= 0 ? 'text-blue-400' : 'text-red-400'
              )}
              dir="ltr"
            >
              {summary.net < 0 ? '-' : ''}{formatSAR(Math.abs(summary.net), locale)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{sarLabel}</p>
          </motion.div>

          {/* Upcoming Payments */}
          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {locale === 'ar' ? 'مدفوعات قادمة' : 'Upcoming Payments'}
              </p>
              <div className="rounded-lg bg-amber-500/10 p-2">
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-amber-400" dir="ltr">
              {upcomingPaymentsCount}
            </p>
            <Link
              href="/calendar"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
            >
              {locale === 'ar' ? 'عرض التقويم' : 'View Calendar'}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </motion.div>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Category Breakdown - Donut Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              {locale === 'ar' ? 'توزيع المصروفات' : 'Expense Breakdown'}
            </h3>
            {categoryBreakdown.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                {locale === 'ar' ? 'لا توجد بيانات للفترة المحددة' : 'No data for selected period'}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-52 w-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="amount"
                        strokeWidth={0}
                      >
                        {categoryBreakdown.map((entry) => (
                          <Cell key={entry.category} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null
                          const data = payload[0].payload as { category: TransactionCategory; amount: number }
                          return (
                            <div className="rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs shadow-xl">
                              <p className="font-medium text-foreground">
                                {CATEGORY_LABEL_MAP[data.category][locale === 'ar' ? 'ar' : 'en']}
                              </p>
                              <p className="text-muted-foreground" dir="ltr">
                                {formatSAR(data.amount)} {sarLabel}
                              </p>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Label */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground">
                      {locale === 'ar' ? 'الإجمالي' : 'Total'}
                    </p>
                    <p className="text-base font-bold tabular-nums text-foreground" dir="ltr">
                      {formatSAR(totalExpenses)}
                    </p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {categoryBreakdown.slice(0, 8).map((item) => (
                    <div key={item.category} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL_MAP[item.category][locale === 'ar' ? 'ar' : 'en']}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Monthly Trend - Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              {locale === 'ar' ? 'الاتجاه الشهري' : 'Monthly Trend'}
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} barGap={4}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_THEME.gridColor}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: CHART_THEME.tooltipBg,
                      border: `1px solid ${CHART_THEME.tooltipBorder}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#e8e8f0' }}
                    formatter={(value, name) => [
                      `${formatSAR(Number(value))} ${sarLabel}`,
                      name === 'income'
                        ? (locale === 'ar' ? 'الإيرادات' : 'Income')
                        : (locale === 'ar' ? 'المصروفات' : 'Expenses'),
                    ]}
                  />
                  <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Inline Legend */}
            <div className="mt-3 flex items-center justify-center gap-6">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">
                  {locale === 'ar' ? 'الإيرادات' : 'Income'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">
                  {locale === 'ar' ? 'المصروفات' : 'Expenses'}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Cash Flow Chart - Full Width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            {locale === 'ar' ? 'التدفق النقدي' : 'Cash Flow'}
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlow}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b5bff" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#5b5bff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_THEME.gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => {
                    const d = new Date(v)
                    return `${d.getMonth() + 1}/${d.getDate()}`
                  }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: CHART_THEME.textColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  width={45}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: CHART_THEME.tooltipBg,
                    border: `1px solid ${CHART_THEME.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#e8e8f0' }}
                  formatter={(value) => [
                    `${formatSAR(Number(value))} ${sarLabel}`,
                    locale === 'ar' ? 'الرصيد' : 'Balance',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#5b5bff"
                  strokeWidth={2}
                  fill="url(#balanceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* VAT Estimation Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-primary/20 bg-primary/5 p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {locale === 'ar'
                  ? 'تقدير ضريبة القيمة المضافة لهذا الربع'
                  : 'Estimated VAT Liability This Quarter'}
              </h3>
              <p className="mt-3 text-3xl font-bold tabular-nums text-primary" dir="ltr">
                {formatSAR(vatEstimate.netVAT, locale)} <span className="text-base font-normal text-muted-foreground">{sarLabel}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  {locale === 'ar' ? 'ضريبة المخرجات:' : 'Output VAT:'}
                  {' '}
                  <span className="font-medium tabular-nums text-foreground" dir="ltr">
                    {formatSAR(vatEstimate.outputVAT)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {locale === 'ar' ? 'ضريبة المدخلات:' : 'Input VAT:'}
                  {' '}
                  <span className="font-medium tabular-nums text-foreground" dir="ltr">
                    {formatSAR(vatEstimate.inputVAT)}
                  </span>
                </span>
              </div>
            </div>

            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  aria-label={locale === 'ar' ? 'معلومات' : 'Info'}
                >
                  <Info className="h-4 w-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="bottom"
                  sideOffset={8}
                  className="z-50 max-w-xs rounded-lg border border-border bg-surface-1 px-4 py-3 text-xs text-muted-foreground shadow-xl"
                >
                  {locale === 'ar'
                    ? 'يُحسب التقدير على أساس 15% على الفئات الخاضعة للضريبة (تُستثنى الرواتب والرسوم الحكومية والتأمين). هذا تقدير فقط — استشر محاسبك للتقديم الدقيق.'
                    : 'Estimated at 15% on VAT-eligible categories (excludes salaries, government fees, insurance). This is an estimate only — consult your accountant for exact filing.'}
                  <Tooltip.Arrow className="fill-surface-1" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {locale === 'ar' ? 'بناءً على المعاملات في الفترة المحددة' : 'Based on transactions in selected period'}
          </p>

          <div className="mt-3 flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              {locale === 'ar' ? 'موعد تقديم الضريبة التالي:' : 'Next VAT filing:'}
              {' '}
              {nextVatDueDate ? (
                <span className="font-medium tabular-nums text-foreground" dir="ltr">
                  {nextVatDueDate}
                </span>
              ) : (
                <span className="text-muted-foreground/70">
                  {locale === 'ar' ? 'لم يتم تحديد موعد' : 'No filing date set'}
                </span>
              )}
            </span>
          </div>

          <p className="mt-3 text-xs text-muted-foreground/70">
            {locale === 'ar'
              ? 'هذا تقدير تقريبي. استشر محاسبك لمعرفة المبلغ الدقيق للتقديم.'
              : 'This is an estimate. Consult your accountant for exact filing.'}
          </p>
        </motion.div>

        {/* Recent Transactions */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{t('recentTransactions')}</h2>
            <div className="flex gap-2">
              <Link
                href="/bookkeeper/upload"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
              >
                <Upload className="h-3.5 w-3.5" />
                {t('uploadStatement')}
              </Link>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder={locale === 'ar' ? 'بحث في المعاملات...' : 'Search transactions...'}
                className="h-9 w-full rounded-lg border border-border bg-surface-1 ps-9 pe-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex gap-1 rounded-lg border border-border bg-surface-1 p-1">
              {(['ALL', 'INCOME', 'EXPENSE'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTxTypeFilter(type)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-all',
                    txTypeFilter === type
                      ? 'bg-primary text-primary-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {type === 'ALL'
                    ? (locale === 'ar' ? 'الكل' : 'All')
                    : type === 'INCOME'
                    ? (locale === 'ar' ? 'وارد' : 'Income')
                    : (locale === 'ar' ? 'صادر' : 'Expense')}
                </button>
              ))}
            </div>

            <select
              value={txCategoryFilter}
              onChange={(e) => setTxCategoryFilter(e.target.value as TransactionCategory | 'ALL')}
              className="h-9 rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">
                {locale === 'ar' ? 'كل الفئات' : 'All Categories'}
              </option>
              {(Object.keys(CATEGORY_LABEL_MAP) as TransactionCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABEL_MAP[cat][locale === 'ar' ? 'ar' : 'en']}
                </option>
              ))}
            </select>
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 font-medium text-foreground">
                {locale === 'ar' ? 'لا توجد معاملات بعد' : 'No transactions yet'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === 'ar'
                  ? 'أضف معاملة يدوية أو ارفع كشف حساب بنكي للبدء'
                  : 'Add a manual transaction or upload a bank statement to get started'}
              </p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 font-medium text-foreground">
                {locale === 'ar' ? 'لا توجد نتائج' : 'No results'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === 'ar' ? 'جرب تغيير معايير البحث أو الفلتر' : 'Try adjusting your search or filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              {/* Table Header */}
              <div className="hidden border-b border-border bg-surface-2 px-4 py-3 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-12 sm:gap-3">
                <div className="col-span-2">{locale === 'ar' ? 'التاريخ' : 'Date'}</div>
                <div className="col-span-3">{locale === 'ar' ? 'الوصف' : 'Description'}</div>
                <div className="col-span-2">{locale === 'ar' ? 'الجهة' : 'Vendor/Client'}</div>
                <div className="col-span-2">{locale === 'ar' ? 'التصنيف' : 'Category'}</div>
                <div className="col-span-2 text-end">{locale === 'ar' ? 'المبلغ' : 'Amount'}</div>
                <div className="col-span-1 text-center">{locale === 'ar' ? 'المصدر' : 'Source'}</div>
              </div>

              {filteredTransactions.map((tx, index) => {
                const SourceIcon = SOURCE_ICONS[tx.source]
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/50"
                  >
                    {/* Mobile Layout */}
                    <div className="sm:hidden">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {tx.description}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground" dir="ltr">{tx.date}</span>
                            {tx.category && (
                              <span
                                className="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                style={{
                                  backgroundColor: `${getCategoryColor(tx.category)}15`,
                                  color: getCategoryColor(tx.category),
                                }}
                              >
                                {CATEGORY_LABEL_MAP[tx.category][locale === 'ar' ? 'ar' : 'en']}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            tx.type === 'INCOME' ? 'text-green-400' : 'text-red-400'
                          )}
                          dir="ltr"
                        >
                          {tx.type === 'INCOME' ? '+' : '-'}{formatSAR(tx.amount)}
                        </span>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:grid sm:grid-cols-12 sm:items-center sm:gap-3">
                      <div className="col-span-2 text-sm tabular-nums text-muted-foreground" dir="ltr">
                        {tx.date}
                      </div>
                      <div className="col-span-3 truncate text-sm font-medium text-foreground">
                        {tx.description}
                      </div>
                      <div className="col-span-2 truncate text-sm text-muted-foreground">
                        {tx.vendor_or_client}
                      </div>
                      <div className="col-span-2">
                        {tx.category && (
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: `${getCategoryColor(tx.category)}15`,
                              color: getCategoryColor(tx.category),
                            }}
                          >
                            {CATEGORY_LABEL_MAP[tx.category][locale === 'ar' ? 'ar' : 'en']}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-end">
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            tx.type === 'INCOME' ? 'text-green-400' : 'text-red-400'
                          )}
                          dir="ltr"
                        >
                          {tx.type === 'INCOME' ? '+' : '-'}{formatSAR(tx.amount)}
                        </span>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <div className="rounded-md bg-surface-2 p-1.5">
                              <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              side="top"
                              sideOffset={6}
                              className="z-50 rounded-md border border-border bg-surface-1 px-2 py-1 text-xs text-muted-foreground shadow-lg"
                            >
                              {tx.source.replace(/_/g, ' ').toLowerCase()}
                              <Tooltip.Arrow className="fill-surface-1" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Tooltip.Provider>
  )
}
