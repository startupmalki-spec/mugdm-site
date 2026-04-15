'use client'

import { useState, useMemo, useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import dynamic from 'next/dynamic'
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
  Calculator,
  ArrowUpRight,
  Search,
  Download,
  Printer,
  FileUp,
  RefreshCw,
  Bell,
  Repeat,
  X,
  Check,
  Loader2,
  BarChart3,
  FileSpreadsheet,
  ChevronDown,
  GitCompareArrows,
  AlertTriangle,
  TrendingUpDown,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'

const BookkeeperCharts = dynamic(
  () => import('@/components/bookkeeper/BookkeeperCharts'),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    ),
  }
)
import { startOfMonth, subMonths, startOfYear, endOfDay } from 'date-fns'
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
import { OutstandingApCard } from '@/components/bookkeeper/OutstandingApCard'
import {
  detectRecurringExpenses,
  calculateMonthlyRecurringCost,
  type RecurringPattern,
} from '@/lib/bookkeeper/recurring-detection'
import {
  reconcileTransactions,
  type ReconciliationResult,
} from '@/lib/bookkeeper/reconciliation'
import {
  detectFuzzyDuplicates,
  type DuplicateResolution,
} from '@/lib/bookkeeper/duplicate-detection'
import {
  forecastCashFlow,
  type CashFlowForecast,
} from '@/lib/bookkeeper/forecast'
import {
  exportTransactionsToExcel,
  downloadBlob,
  parseImportFile,
  type ImportPreviewRow,
} from '@/lib/bookkeeper/export'
import { generateVATReport, type VATReportData } from '@/lib/bookkeeper/vat-report'
import { generateProfitLoss, type ProfitLossData } from '@/lib/bookkeeper/profit-loss'
import { generateBalanceSheet, type BalanceSheetData } from '@/lib/bookkeeper/balance-sheet'
import { exportVATReportToExcel, exportProfitLossToExcel, exportBalanceSheetToExcel } from '@/lib/bookkeeper/report-export'
import { TransactionForm } from '@/components/bookkeeper/TransactionForm'
import { ReceiptCapture } from '@/components/bookkeeper/ReceiptCapture'
import { PossibleDuplicates } from '@/components/bookkeeper/PossibleDuplicates'
import { AgentInsights } from '@/components/bookkeeper/AgentInsights'
import { onTransactionsChanged } from '@/lib/cross-module/events'
import { Skeleton } from '@/components/ui/skeleton'
import { ToastContainer, useToast } from '@/components/ui/toast'
import type { Transaction, TransactionCategory, TransactionSource } from '@/lib/supabase/types'

type PeriodKey = 'this_month' | '3_months' | '6_months' | 'this_year'
type QuarterKey = 'q1' | 'q2' | 'q3' | 'q4'

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
  const tEmpty = useTranslations('emptyStates')
  const locale = useLocale()

  const [activePeriod, setActivePeriod] = useState<PeriodKey>('3_months')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [businessId, setBusinessId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [nextVatDueDate, setNextVatDueDate] = useState<string | null>(null)
  const [txSearch, setTxSearch] = useState('')
  const [txCategoryFilter, setTxCategoryFilter] = useState<TransactionCategory | 'ALL'>('ALL')
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[] | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  // Reports state
  const currentYear = new Date().getFullYear()
  const [vatQuarter, setVatQuarter] = useState<QuarterKey>(() => {
    const m = new Date().getMonth()
    if (m < 3) return 'q1'
    if (m < 6) return 'q2'
    if (m < 9) return 'q3'
    return 'q4'
  })
  const [vatYear, setVatYear] = useState(currentYear)
  const [vatReport, setVatReport] = useState<VATReportData | null>(null)
  const [plPeriod, setPlPeriod] = useState<PeriodKey>('this_year')
  const [plReport, setPlReport] = useState<ProfitLossData | null>(null)
  const [activeReportTab, setActiveReportTab] = useState<'vat' | 'pl' | 'bs'>('vat')
  const [bsReport, setBsReport] = useState<BalanceSheetData | null>(null)

  // Reconciliation state
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null)
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set())

  // Fuzzy duplicate detection
  const fuzzyDuplicatePairs = useMemo(
    () => detectFuzzyDuplicates(transactions),
    [transactions]
  )

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

        const { data: vatObligation } = (await supabase.from('obligations')
          .select('next_due_date')
          .eq('business_id', biz.id)
          .eq('type', 'ZATCA_VAT')
          .order('next_due_date', { ascending: true })
          .limit(1)
          .single()) as unknown as { data: { next_due_date: string } | null; error: unknown }

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

  const recurringPatterns = useMemo(
    () => detectRecurringExpenses(transactions),
    [transactions]
  )

  const monthlyRecurringCost = useMemo(
    () => calculateMonthlyRecurringCost(recurringPatterns),
    [recurringPatterns]
  )

  const lowConfidenceCount = useMemo(
    () => transactions.filter((tx) => tx.ai_confidence !== null && tx.ai_confidence < 0.7 && !tx.is_reviewed).length,
    [transactions]
  )

  const handleScrollToSection = useCallback((section: 'duplicates' | 'review' | 'vat' | 'forecast') => {
    const sectionIds: Record<string, string> = {
      duplicates: 'duplicates-section',
      review: 'review-section',
      vat: 'reports-section',
      forecast: 'forecast-section',
    }
    const el = document.getElementById(sectionIds[section])
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleExportExcel = useCallback(async () => {
    try {
      const blob = await exportTransactionsToExcel(filteredTransactions, 'Business')
      const dateStr = new Date().toISOString().split('T')[0]
      downloadBlob(blob, `transactions-${dateStr}.xlsx`)
    } catch {
      showToast(locale === 'ar' ? 'فشل في التصدير' : 'Export failed', 'error')
    }
  }, [filteredTransactions, locale, showToast])

  const handleExportPrint = useCallback(() => {
    window.print()
  }, [])

  const handleImportFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsParsing(true)
    try {
      const rows = await parseImportFile(file)
      if (rows.length === 0) {
        showToast(t('importNoData'), 'error')
      } else {
        // Run fuzzy duplicate detection against existing transactions
        const candidateTxs: Transaction[] = rows.map((row, i) => ({
          id: `import-preview-${i}`,
          business_id: businessId,
          date: row.date,
          amount: row.amount,
          type: row.type,
          category: (row.category || 'OTHER_EXPENSE') as TransactionCategory,
          description: row.description,
          vendor_or_client: row.vendor_or_client || null,
          source: 'BANK_STATEMENT_CSV' as const,
          source_file_id: null,
          receipt_url: null,
          linked_obligation_id: null,
          vat_amount: null,
          ai_confidence: null,
          is_reviewed: false,
          created_at: new Date().toISOString(),
        }))
        const combined = [...transactions, ...candidateTxs]
        const dupes = detectFuzzyDuplicates(combined)
        if (dupes.length > 0) {
          showToast(
            locale === 'ar'
              ? `تم اكتشاف ${dupes.length} عملية مكررة محتملة`
              : `${dupes.length} possible duplicate${dupes.length !== 1 ? 's' : ''} detected`,
            'info'
          )
        }
        setImportPreview(rows)
      }
    } catch {
      showToast(locale === 'ar' ? 'فشل في تحليل الملف' : 'Failed to parse file', 'error')
    } finally {
      setIsParsing(false)
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }, [locale, businessId, transactions, showToast, t])

  const handleConfirmImport = useCallback(async () => {
    if (!importPreview || !businessId) return
    setIsImporting(true)
    try {
      const supabase = createClient()
      let imported = 0
      for (const row of importPreview) {
        const payload = {
          business_id: businessId,
          date: row.date,
          amount: row.amount,
          type: row.type,
          category: (row.category || 'OTHER_EXPENSE') as TransactionCategory,
          description: row.description,
          vendor_or_client: row.vendor_or_client || null,
          source: 'BANK_STATEMENT_CSV' as const,
          source_file_id: null,
          receipt_url: null,
          linked_obligation_id: null,
          vat_amount: null,
          ai_confidence: null,
          is_reviewed: false,
        }
        const { data: newTx } = (await supabase.from('transactions')
          .insert(payload as never)
          .select()
          .single()) as unknown as { data: Transaction | null; error: unknown }
        if (newTx) {
          setTransactions((prev) => [newTx, ...prev])
          imported++
        }
      }
      showToast(t('importSuccess', { count: imported }), 'success')
      setImportPreview(null)
    } catch {
      showToast(locale === 'ar' ? 'فشل في الاستيراد' : 'Import failed', 'error')
    } finally {
      setIsImporting(false)
    }
  }, [importPreview, businessId, locale, showToast, t])

  const handleResolveDuplicate = useCallback(async (pairIndex: number, resolution: DuplicateResolution) => {
    const pair = fuzzyDuplicatePairs[pairIndex]
    if (!pair || !businessId) return

    try {
      const supabase = createClient()

      if (resolution === 'keep_both') {
        await supabase
          .from('transactions')
          .update({ is_reviewed: true })
          .in('id', [pair.transactionA.id, pair.transactionB.id])
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === pair.transactionA.id || tx.id === pair.transactionB.id
              ? { ...tx, is_reviewed: true }
              : tx
          )
        )
        showToast(t('duplicates.kept'), 'success')
      } else if (resolution === 'delete_a') {
        await supabase.from('transactions').delete().eq('id', pair.transactionA.id)
        setTransactions((prev) => prev.filter((tx) => tx.id !== pair.transactionA.id))
        showToast(t('duplicates.deleted'), 'success')
      } else if (resolution === 'delete_b') {
        await supabase.from('transactions').delete().eq('id', pair.transactionB.id)
        setTransactions((prev) => prev.filter((tx) => tx.id !== pair.transactionB.id))
        showToast(t('duplicates.deleted'), 'success')
      } else if (resolution === 'merge') {
        const keeper = (pair.transactionA.ai_confidence ?? 0) >= (pair.transactionB.ai_confidence ?? 0)
          ? pair.transactionA
          : pair.transactionB
        const discard = keeper.id === pair.transactionA.id ? pair.transactionB : pair.transactionA
        await supabase.from('transactions').update({ is_reviewed: true }).eq('id', keeper.id)
        await supabase.from('transactions').delete().eq('id', discard.id)
        setTransactions((prev) =>
          prev
            .filter((tx) => tx.id !== discard.id)
            .map((tx) => (tx.id === keeper.id ? { ...tx, is_reviewed: true } : tx))
        )
        showToast(t('duplicates.merged'), 'success')
      }
    } catch {
      showToast(t('duplicates.error'), 'error')
    }
  }, [fuzzyDuplicatePairs, businessId, showToast, t])

  const handleSetReminder = useCallback(async (pattern: RecurringPattern) => {
    if (!businessId) return
    try {
      const supabase = createClient()
      const freq = pattern.frequency === 'monthly' ? 'MONTHLY'
        : pattern.frequency === 'quarterly' ? 'QUARTERLY'
        : 'ANNUAL'
      await supabase.from('obligations').insert({
        business_id: businessId,
        type: 'CUSTOM',
        name: `${pattern.vendor} - ${pattern.description}`.slice(0, 100),
        description: `Recurring ${pattern.frequency} expense: ~${pattern.averageAmount} SAR`,
        frequency: freq,
        next_due_date: pattern.nextExpectedDate,
      } as never)
      showToast(
        t('recurring.reminderCreated', { vendor: pattern.vendor ?? '' }),
        'success'
      )
    } catch {
      showToast(locale === 'ar' ? 'فشل في إنشاء التذكير' : 'Failed to create reminder', 'error')
    }
  }, [businessId, locale, showToast, t])

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

    const { data: newTx } = (await supabase.from('transactions')
      .insert(payload as never)
      .select()
      .single()) as unknown as { data: Transaction | null; error: unknown }

    if (newTx) {
      setTransactions((prev) => [newTx, ...prev])
      onTransactionsChanged(supabase, businessId).catch(() => {})
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

    const { data: newTx } = (await supabase.from('transactions')
      .insert(payload as never)
      .select()
      .single()) as unknown as { data: Transaction | null; error: unknown }

    if (newTx) {
      setTransactions((prev) => [newTx, ...prev])
      onTransactionsChanged(supabase, businessId).catch(() => {})
    }
  }, [businessId])

  // Report generation handlers
  const getQuarterDates = useCallback((quarter: QuarterKey, year: number) => {
    const quarters: Record<QuarterKey, { start: string; end: string }> = {
      q1: { start: `${year}-01-01`, end: `${year}-03-31` },
      q2: { start: `${year}-04-01`, end: `${year}-06-30` },
      q3: { start: `${year}-07-01`, end: `${year}-09-30` },
      q4: { start: `${year}-10-01`, end: `${year}-12-31` },
    }
    return quarters[quarter]
  }, [])

  const handleGenerateVATReport = useCallback(() => {
    const dates = getQuarterDates(vatQuarter, vatYear)
    const report = generateVATReport(transactions, dates.start, dates.end)
    setVatReport(report)
  }, [transactions, vatQuarter, vatYear, getQuarterDates])

  const handleGeneratePLReport = useCallback(() => {
    const range = getPeriodRange(plPeriod)
    const startStr = range.start.toISOString().split('T')[0]
    const endStr = range.end.toISOString().split('T')[0]
    const report = generateProfitLoss(transactions, startStr, endStr)
    setPlReport(report)
  }, [transactions, plPeriod])

  const handleExportVATExcel = useCallback(async () => {
    if (!vatReport) return
    try {
      await exportVATReportToExcel(vatReport, 'Business')
    } catch {
      showToast(locale === 'ar' ? 'فشل في التصدير' : 'Export failed', 'error')
    }
  }, [vatReport, locale, showToast])

  const handleExportPLExcel = useCallback(async () => {
    if (!plReport) return
    try {
      await exportProfitLossToExcel(plReport, 'Business')
    } catch {
      showToast(locale === 'ar' ? 'فشل في التصدير' : 'Export failed', 'error')
    }
  }, [plReport, locale, showToast])

  const handleGenerateBSReport = useCallback(() => {
    const range = getPeriodRange(plPeriod)
    const startStr = range.start.toISOString().split('T')[0]
    const endStr = range.end.toISOString().split('T')[0]
    const report = generateBalanceSheet(transactions, startStr, endStr)
    setBsReport(report)
  }, [transactions, plPeriod])

  const handleExportBSExcel = useCallback(async () => {
    if (!bsReport) return
    try {
      await exportBalanceSheetToExcel(bsReport, 'Business')
    } catch {
      showToast(locale === 'ar' ? 'فشل في التصدير' : 'Export failed', 'error')
    }
  }, [bsReport, locale, showToast])

  const handlePrintReport = useCallback(() => {
    window.print()
  }, [])

  // --- Reconciliation ---
  const handleReconcile = useCallback(() => {
    const bankTx = transactions.filter(
      (tx) => tx.source === 'BANK_STATEMENT_CSV' || tx.source === 'BANK_STATEMENT_PDF'
    )
    const manualTx = transactions.filter((tx) => tx.source === 'MANUAL')
    const result = reconcileTransactions(bankTx, manualTx)
    setReconciliationResult(result)
    setVerifiedIds(new Set())
  }, [transactions])

  const handleMarkVerified = useCallback((id: string) => {
    setVerifiedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  // --- Cash Flow Forecast ---
  const cashFlowForecast = useMemo<CashFlowForecast | null>(() => {
    if (transactions.length === 0) return null
    return forecastCashFlow(transactions, 3)
  }, [transactions])

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
            <ReceiptCapture businessId={businessId} onSave={handleAddReceipt} />
            <TransactionForm onSave={handleAddTransaction} />
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              <Download className="h-3.5 w-3.5" />
              {t('exportExcel')}
            </button>
            <button
              type="button"
              onClick={handleExportPrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              <Printer className="h-3.5 w-3.5" />
              {t('exportPrint')}
            </button>
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              disabled={isParsing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {isParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              {isParsing ? t('importParsing') : t('importExcel')}
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFileChange}
            />
          </div>
        </div>

        {/* Agent Insights */}
        <AgentInsights
          duplicateCount={fuzzyDuplicatePairs.length}
          lowConfidenceCount={lowConfidenceCount}
          recurringPatterns={recurringPatterns}
          monthlyRecurringCost={monthlyRecurringCost}
          cashFlowForecast={cashFlowForecast}
          nextVatDueDate={nextVatDueDate}
          vatEstimate={vatEstimate?.netVAT ?? null}
          onScrollTo={handleScrollToSection}
        />

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
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

          {/* Outstanding AP (feature-flagged, renders null if bills feature off) */}
          <OutstandingApCard ns="bookkeeper" />
        </div>

        {/* Charts Section - lazy loaded to reduce initial bundle size */}
        <BookkeeperCharts
          locale={locale}
          sarLabel={sarLabel}
          categoryBreakdown={categoryBreakdown}
          totalExpenses={totalExpenses}
          monthlyTrend={monthlyTrend}
          cashFlow={cashFlow}
        />

        {/* Cash Flow Forecast Card */}
        {cashFlowForecast && cashFlowForecast.projections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUpDown className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{t('forecast.title')}</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-surface-1 px-3 py-1">
                  <span className="text-xs text-muted-foreground">
                    {t('forecast.currentBalance')}:{' '}
                    <span className={cn('font-medium tabular-nums', cashFlowForecast.currentBalance >= 0 ? 'text-foreground' : 'text-red-400')} dir="ltr">
                      {formatSAR(cashFlowForecast.currentBalance, locale)}
                    </span>{' '}
                    {sarLabel}
                  </span>
                </div>
                <div className={cn(
                  'rounded-lg px-3 py-1',
                  cashFlowForecast.projectedBalance >= 0 ? 'bg-primary/10' : 'bg-red-500/10'
                )}>
                  <span className="text-xs font-medium">
                    <span className={cashFlowForecast.projectedBalance >= 0 ? 'text-primary' : 'text-red-400'}>
                      {t('forecast.projectedBalance')}:{' '}
                      <span className="tabular-nums" dir="ltr">{formatSAR(cashFlowForecast.projectedBalance, locale)}</span>{' '}
                      {sarLabel}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {cashFlowForecast.goesNegative && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span className="text-xs font-medium text-red-400">{t('forecast.warningNegative')}</span>
              </div>
            )}

            <p className="mb-4 text-xs text-muted-foreground">{t('forecast.subtitle')}</p>

            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowForecast.projections} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} vertical={false} />
                  <XAxis
                    dataKey="label"
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
                      name === 'projectedIncome'
                        ? t('forecast.income')
                        : t('forecast.expenses'),
                    ]}
                  />
                  <Bar dataKey="projectedIncome" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} name="projectedIncome" />
                  <Bar dataKey="projectedExpenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} name="projectedExpenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-center gap-6">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">{t('forecast.income')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">{t('forecast.expenses')}</span>
              </div>
            </div>
          </motion.div>
        )}

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

        {/* Recurring Expenses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t('recurring.title')}</h3>
            </div>
            {recurringPatterns.length > 0 && (
              <div className="rounded-lg bg-primary/10 px-3 py-1">
                <span className="text-xs font-medium text-primary">
                  {t('recurring.totalMonthly')}: <span className="tabular-nums" dir="ltr">{formatSAR(monthlyRecurringCost, locale)}</span> {sarLabel}
                </span>
              </div>
            )}
          </div>

          {recurringPatterns.length === 0 ? (
            <div className="py-8 text-center">
              <RefreshCw className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-foreground">{t('recurring.noPatterns')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('recurring.noPatternsDescription')}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recurringPatterns.map((pattern, idx) => (
                <motion.div
                  key={`${pattern.vendor}-${pattern.category}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + idx * 0.05 }}
                  className="rounded-lg border border-border bg-surface-1 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{pattern.vendor}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{pattern.description}</p>
                    </div>
                    {pattern.category && (
                      <span
                        className="ms-2 inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${getCategoryColor(pattern.category)}15`,
                          color: getCategoryColor(pattern.category),
                        }}
                      >
                        {CATEGORY_LABEL_MAP[pattern.category][locale === 'ar' ? 'ar' : 'en']}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t('recurring.avgAmount')}</span>
                      <span className="font-medium tabular-nums text-foreground" dir="ltr">
                        {formatSAR(pattern.averageAmount, locale)} {sarLabel}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('recurring.frequency')}</span>
                      <span className="font-medium text-foreground">
                        {t(`recurring.${pattern.frequency}`)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('recurring.nextExpected')}</span>
                      <span className="font-medium tabular-nums text-foreground" dir="ltr">
                        {pattern.nextExpectedDate}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('recurring.occurrences')}</span>
                      <span className="font-medium text-foreground">{pattern.occurrences}x</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSetReminder(pattern)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Bell className="h-3 w-3" />
                    {t('recurring.setReminder')}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Possible Duplicates Section */}
        {fuzzyDuplicatePairs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.64 }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <PossibleDuplicates
              pairs={fuzzyDuplicatePairs}
              onResolve={handleResolveDuplicate}
            />
          </motion.div>
        )}

        {/* Bank Reconciliation Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.67 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t('reconciliation.title')}</h3>
                <p className="text-xs text-muted-foreground">{t('reconciliation.subtitle')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReconcile}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('reconciliation.reconcile')}
            </button>
          </div>

          {!reconciliationResult ? (
            <div className="py-8 text-center">
              <GitCompareArrows className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">{t('reconciliation.noData')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t('reconciliation.matchedCount', { count: reconciliationResult.matched.length })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                  {t('reconciliation.unmatchedBankCount', { count: reconciliationResult.unmatchedBank.filter((tx) => !verifiedIds.has(tx.id)).length })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
                  {t('reconciliation.unmatchedManualCount', { count: reconciliationResult.unmatchedManual.filter((tx) => !verifiedIds.has(tx.id)).length })}
                </span>
              </div>

              {/* Matched pairs */}
              {reconciliationResult.matched.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-green-400">{t('reconciliation.matched')}</h4>
                  <div className="space-y-2">
                    {reconciliationResult.matched.map((match) => (
                      <div
                        key={`${match.bankTransaction.id}-${match.manualTransaction.id}`}
                        className="flex flex-col gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-foreground">{t('reconciliation.bankEntry')}:</span>
                            <span className="text-muted-foreground" dir="ltr">{match.bankTransaction.date}</span>
                            <span className="font-medium tabular-nums text-foreground" dir="ltr">{formatSAR(match.bankTransaction.amount)}</span>
                            <span className="truncate text-muted-foreground">{match.bankTransaction.description}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-foreground">{t('reconciliation.manualEntry')}:</span>
                            <span className="text-muted-foreground" dir="ltr">{match.manualTransaction.date}</span>
                            <span className="font-medium tabular-nums text-foreground" dir="ltr">{formatSAR(match.manualTransaction.amount)}</span>
                            <span className="truncate text-muted-foreground">{match.manualTransaction.description}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{t('reconciliation.dateDiff')}: {match.dateDiffDays.toFixed(1)} {match.dateDiffDays <= 1 ? t('reconciliation.day') : t('reconciliation.days')}</span>
                          <span>{t('reconciliation.amountDiff')}: {match.amountDiffPercent.toFixed(1)}%</span>
                          <Check className="h-4 w-4 text-green-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched bank entries */}
              {reconciliationResult.unmatchedBank.filter((tx) => !verifiedIds.has(tx.id)).length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-amber-400">{t('reconciliation.unmatchedBank')}</h4>
                  <div className="space-y-2">
                    {reconciliationResult.unmatchedBank
                      .filter((tx) => !verifiedIds.has(tx.id))
                      .map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                        >
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground" dir="ltr">{tx.date}</span>
                            <span className="font-medium tabular-nums text-foreground" dir="ltr">
                              {tx.type === 'INCOME' ? '+' : '-'}{formatSAR(tx.amount)}
                            </span>
                            <span className="truncate text-muted-foreground">{tx.description}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMarkVerified(tx.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {t('reconciliation.markVerified')}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Unmatched manual entries */}
              {reconciliationResult.unmatchedManual.filter((tx) => !verifiedIds.has(tx.id)).length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-red-400">{t('reconciliation.unmatchedManual')}</h4>
                  <div className="space-y-2">
                    {reconciliationResult.unmatchedManual
                      .filter((tx) => !verifiedIds.has(tx.id))
                      .map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 p-3"
                        >
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground" dir="ltr">{tx.date}</span>
                            <span className="font-medium tabular-nums text-foreground" dir="ltr">
                              {tx.type === 'INCOME' ? '+' : '-'}{formatSAR(tx.amount)}
                            </span>
                            <span className="truncate text-muted-foreground">{tx.description}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMarkVerified(tx.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {t('reconciliation.markVerified')}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Financial Reports Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">{t('reports.title')}</h3>
          </div>

          {/* Report Tab Switcher */}
          <div className="mb-5 flex gap-1 rounded-lg bg-surface-1 p-1">
            <button
              type="button"
              onClick={() => setActiveReportTab('vat')}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all',
                activeReportTab === 'vat'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('reports.vatReport')}
            </button>
            <button
              type="button"
              onClick={() => setActiveReportTab('pl')}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all',
                activeReportTab === 'pl'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('reports.profitLoss')}
            </button>
            <button
              type="button"
              onClick={() => setActiveReportTab('bs')}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all',
                activeReportTab === 'bs'
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('reports.balanceSheet')}
            </button>
          </div>

          {/* VAT Report Tab */}
          {activeReportTab === 'vat' && (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">{t('reports.vatReportDescription')}</p>

              {/* Quarter Selector */}
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('reports.selectQuarter')}
                  </label>
                  <div className="relative">
                    <select
                      value={vatQuarter}
                      onChange={(e) => setVatQuarter(e.target.value as QuarterKey)}
                      className="h-9 appearance-none rounded-lg border border-border bg-surface-1 pe-8 ps-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => (
                        <option key={q} value={q}>{t(`reports.${q}`)}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {locale === 'ar' ? 'السنة' : 'Year'}
                  </label>
                  <select
                    value={vatYear}
                    onChange={(e) => setVatYear(Number(e.target.value))}
                    className="h-9 rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateVATReport}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {t('reports.generate')}
                </button>
              </div>

              {/* VAT Report Results */}
              {vatReport && (
                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-surface-1 p-4">
                      <p className="text-xs font-medium text-muted-foreground">{t('reports.outputVAT')}</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-foreground" dir="ltr">
                        {formatSAR(vatReport.outputVAT, locale)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-4">
                      <p className="text-xs font-medium text-muted-foreground">{t('reports.inputVAT')}</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-foreground" dir="ltr">
                        {formatSAR(vatReport.inputVAT, locale)}
                      </p>
                    </div>
                    <div className={cn(
                      'rounded-lg border p-4',
                      vatReport.netVAT >= 0
                        ? 'border-red-500/20 bg-red-500/5'
                        : 'border-green-500/20 bg-green-500/5'
                    )}>
                      <p className="text-xs font-medium text-muted-foreground">
                        {vatReport.netVAT >= 0 ? t('reports.netVATPayable') : t('reports.vatRefundable')}
                      </p>
                      <p className={cn(
                        'mt-1 text-xl font-bold tabular-nums',
                        vatReport.netVAT >= 0 ? 'text-red-400' : 'text-green-400'
                      )} dir="ltr">
                        {formatSAR(Math.abs(vatReport.netVAT), locale)}
                      </p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      {t('reports.totalSales')}: <span className="font-medium tabular-nums text-foreground" dir="ltr">{formatSAR(vatReport.totalSales, locale)}</span> {sarLabel}
                    </span>
                    <span className="text-muted-foreground">
                      {t('reports.totalPurchases')}: <span className="font-medium tabular-nums text-foreground" dir="ltr">{formatSAR(vatReport.totalPurchases, locale)}</span> {sarLabel}
                    </span>
                  </div>

                  {/* Transaction Detail Table */}
                  {vatReport.transactions.length > 0 ? (
                    <div className="max-h-64 overflow-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-surface-2">
                          <tr>
                            <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t('reports.date')}</th>
                            <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t('reports.description')}</th>
                            <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t('reports.type')}</th>
                            <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t('reports.amount')}</th>
                            <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t('reports.vat')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vatReport.transactions.map((tx, idx) => (
                            <tr key={idx} className="border-t border-border">
                              <td className="px-3 py-2 tabular-nums text-muted-foreground" dir="ltr">{tx.date}</td>
                              <td className="max-w-[200px] truncate px-3 py-2 text-foreground">{tx.description}</td>
                              <td className="px-3 py-2">
                                <span className={cn(
                                  'text-xs font-medium',
                                  tx.type === 'sale' ? 'text-green-400' : 'text-red-400'
                                )}>
                                  {tx.type === 'sale' ? t('reports.sale') : t('reports.purchase')}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-end font-medium tabular-nums text-foreground" dir="ltr">
                                {formatSAR(tx.amount)}
                              </td>
                              <td className="px-3 py-2 text-end font-medium tabular-nums text-primary" dir="ltr">
                                {formatSAR(tx.vat)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">{t('reports.noData')}</p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleExportVATExcel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t('reports.exportExcel')}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintReport}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {t('reports.print')}
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground/70">{t('reports.disclaimer')}</p>
                </div>
              )}
            </div>
          )}

          {/* P&L Report Tab */}
          {activeReportTab === 'pl' && (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">{t('reports.profitLossDescription')}</p>

              {/* Period Selector */}
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('reports.selectPeriod')}
                  </label>
                  <div className="relative">
                    <select
                      value={plPeriod}
                      onChange={(e) => setPlPeriod(e.target.value as PeriodKey)}
                      className="h-9 appearance-none rounded-lg border border-border bg-surface-1 pe-8 ps-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {PERIOD_KEYS.map((key) => (
                        <option key={key} value={key}>{getPeriodLabel(key, locale)}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePLReport}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {t('reports.generate')}
                </button>
              </div>

              {/* P&L Report Results */}
              {plReport && (
                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                      <p className="text-xs font-medium text-muted-foreground">{t('reports.grossProfit')}</p>
                      <p className={cn(
                        'mt-1 text-xl font-bold tabular-nums',
                        plReport.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'
                      )} dir="ltr">
                        {formatSAR(plReport.grossProfit, locale)}
                      </p>
                    </div>
                    <div className={cn(
                      'rounded-lg border p-4',
                      plReport.netProfit >= 0
                        ? 'border-blue-500/20 bg-blue-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                    )}>
                      <p className="text-xs font-medium text-muted-foreground">{t('reports.netProfit')}</p>
                      <p className={cn(
                        'mt-1 text-xl font-bold tabular-nums',
                        plReport.netProfit >= 0 ? 'text-blue-400' : 'text-red-400'
                      )} dir="ltr">
                        {formatSAR(plReport.netProfit, locale)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-1 p-4">
                      <p className="text-xs font-medium text-muted-foreground">{t('reports.profitMargin')}</p>
                      <p className={cn(
                        'mt-1 text-xl font-bold tabular-nums',
                        plReport.profitMargin >= 0 ? 'text-foreground' : 'text-red-400'
                      )} dir="ltr">
                        {plReport.profitMargin}%
                      </p>
                    </div>
                  </div>

                  {/* Revenue Breakdown */}
                  <div className="rounded-lg border border-border p-4">
                    <h4 className="mb-3 text-sm font-semibold text-green-400">{t('reports.revenue')}</h4>
                    {plReport.revenue.length > 0 ? (
                      <div className="space-y-2">
                        {plReport.revenue.map((rev) => (
                          <div key={rev.category} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{rev.category}</span>
                            <span className="font-medium tabular-nums text-foreground" dir="ltr">
                              {formatSAR(rev.amount, locale)} {sarLabel}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-border pt-2">
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span className="text-foreground">{t('reports.totalRevenue')}</span>
                            <span className="tabular-nums text-green-400" dir="ltr">
                              {formatSAR(plReport.totalRevenue, locale)} {sarLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('reports.noData')}</p>
                    )}
                  </div>

                  {/* Expenses Breakdown */}
                  <div className="rounded-lg border border-border p-4">
                    <h4 className="mb-3 text-sm font-semibold text-red-400">{t('reports.expenses')}</h4>
                    {plReport.expenses.length > 0 ? (
                      <div className="space-y-2">
                        {plReport.expenses.map((exp) => (
                          <div key={exp.category} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{exp.category}</span>
                            <span className="font-medium tabular-nums text-foreground" dir="ltr">
                              {formatSAR(exp.amount, locale)} {sarLabel}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-border pt-2">
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span className="text-foreground">{t('reports.totalExpenses')}</span>
                            <span className="tabular-nums text-red-400" dir="ltr">
                              {formatSAR(plReport.totalExpenses, locale)} {sarLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('reports.noData')}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleExportPLExcel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t('reports.exportExcel')}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintReport}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {t('reports.print')}
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground/70">{t('reports.disclaimer')}</p>
                </div>
              )}
            </div>
          )}

          {/* Balance Sheet Tab */}
          {activeReportTab === 'bs' && (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">{t('reports.balanceSheetDescription')}</p>

              {/* Period Selector */}
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('reports.selectPeriod')}
                  </label>
                  <div className="relative">
                    <select
                      value={plPeriod}
                      onChange={(e) => setPlPeriod(e.target.value as PeriodKey)}
                      className="h-9 appearance-none rounded-lg border border-border bg-surface-1 pe-8 ps-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {PERIOD_KEYS.map((key) => (
                        <option key={key} value={key}>{getPeriodLabel(key, locale)}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateBSReport}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {t('reports.generate')}
                </button>
              </div>

              {/* Balance Sheet Results */}
              {bsReport && (
                <div className="space-y-4">
                  {/* Assets */}
                  <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-green-400">{t('reports.assets')}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('reports.cashEquivalents')}</span>
                        <span className="font-medium tabular-nums text-foreground" dir="ltr">
                          {formatSAR(bsReport.assets.cash, locale)} {sarLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('reports.accountsReceivable')}</span>
                        <span className="font-medium tabular-nums text-foreground" dir="ltr">
                          {formatSAR(bsReport.assets.receivables, locale)} {sarLabel}
                        </span>
                      </div>
                      <div className="border-t border-border pt-2">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span className="text-foreground">{t('reports.totalAssets')}</span>
                          <span className="tabular-nums text-green-400" dir="ltr">
                            {formatSAR(bsReport.assets.total, locale)} {sarLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-red-400">{t('reports.liabilities')}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('reports.vatPayable')}</span>
                        <span className="font-medium tabular-nums text-foreground" dir="ltr">
                          {formatSAR(bsReport.liabilities.vatPayable, locale)} {sarLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('reports.accountsPayable')}</span>
                        <span className="font-medium tabular-nums text-foreground" dir="ltr">
                          {formatSAR(bsReport.liabilities.payables, locale)} {sarLabel}
                        </span>
                      </div>
                      <div className="border-t border-border pt-2">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span className="text-foreground">{t('reports.totalLiabilities')}</span>
                          <span className="tabular-nums text-red-400" dir="ltr">
                            {formatSAR(bsReport.liabilities.total, locale)} {sarLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Equity */}
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-blue-400">{t('reports.equity')}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('reports.ownerEquity')}</span>
                        <span className="font-medium tabular-nums text-foreground" dir="ltr">
                          {formatSAR(bsReport.equity.ownerEquity, locale)} {sarLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('reports.retainedEarnings')}</span>
                        <span className="font-medium tabular-nums text-foreground" dir="ltr">
                          {formatSAR(bsReport.equity.retainedEarnings, locale)} {sarLabel}
                        </span>
                      </div>
                      <div className="border-t border-border pt-2">
                        <div className="flex items-center justify-between text-sm font-semibold">
                          <span className="text-foreground">{t('reports.totalEquity')}</span>
                          <span className="tabular-nums text-blue-400" dir="ltr">
                            {formatSAR(bsReport.equity.total, locale)} {sarLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Balance Check */}
                  <div className={cn(
                    'rounded-lg border p-3 text-center text-sm font-medium',
                    bsReport.balances
                      ? 'border-green-500/20 bg-green-500/5 text-green-400'
                      : 'border-red-500/20 bg-red-500/5 text-red-400'
                  )}>
                    {bsReport.balances ? t('reports.balanced') : t('reports.unbalanced')}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleExportBSExcel}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t('reports.exportExcel')}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintReport}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {t('reports.print')}
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground/70">{t('reports.disclaimer')}</p>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Import Preview Modal */}
        {importPreview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-primary/30 bg-card p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t('importPreview')}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('importPreviewDescription')} ({importPreview.length} {locale === 'ar' ? 'عملية' : 'transactions'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-2">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium text-muted-foreground">{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="px-3 py-2 text-start font-medium text-muted-foreground">{locale === 'ar' ? 'الوصف' : 'Description'}</th>
                    <th className="px-3 py-2 text-start font-medium text-muted-foreground">{locale === 'ar' ? 'النوع' : 'Type'}</th>
                    <th className="px-3 py-2 text-end font-medium text-muted-foreground">{locale === 'ar' ? 'المبلغ' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground" dir="ltr">{row.date}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-foreground">{row.description}</td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          'text-xs font-medium',
                          row.type === 'INCOME' ? 'text-green-400' : 'text-red-400'
                        )}>
                          {row.type === 'INCOME' ? (locale === 'ar' ? 'إيراد' : 'Income') : (locale === 'ar' ? 'مصروف' : 'Expense')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-end font-medium tabular-nums text-foreground" dir="ltr">
                        {formatSAR(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {t('importConfirm')}
              </button>
            </div>
          </motion.div>
        )}

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
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-8 py-16 text-center"
            >
              <Calculator className="h-16 w-16 text-muted-foreground/50" />
              <h3 className="mt-5 text-lg font-semibold text-foreground">{tEmpty('noTransactions')}</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{tEmpty('noTransactionsDesc')}</p>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    const btn = document.querySelector<HTMLButtonElement>('[data-receipt-trigger]')
                    btn?.click()
                  }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-1 px-6 py-4 text-sm transition-colors hover:border-primary/30 hover:bg-surface-2"
                >
                  <Receipt className="h-6 w-6 text-primary" />
                  <span className="font-medium text-foreground">{tEmpty('scanReceipt')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-1 px-6 py-4 text-sm transition-colors hover:border-primary/30 hover:bg-surface-2"
                >
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="font-medium text-foreground">{tEmpty('uploadStatement')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const btn = document.querySelector<HTMLButtonElement>('[data-transaction-trigger]')
                    btn?.click()
                  }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-1 px-6 py-4 text-sm transition-colors hover:border-primary/30 hover:bg-surface-2"
                >
                  <PenLine className="h-6 w-6 text-primary" />
                  <span className="font-medium text-foreground">{tEmpty('manualEntry')}</span>
                </button>
              </div>
            </motion.div>
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
