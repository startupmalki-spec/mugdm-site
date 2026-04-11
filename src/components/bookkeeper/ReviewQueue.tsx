'use client'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  CheckCheck,
  ChevronDown,
  AlertTriangle,
  PartyPopper,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatSAR, getCategoryColor } from '@/lib/bookkeeper/calculations'
import type { Transaction, TransactionCategory } from '@/lib/supabase/types'

const CONFIDENCE_THRESHOLD = 0.7

const CATEGORY_LABEL_MAP: Record<TransactionCategory, { en: string; ar: string }> = {
  REVENUE: { en: 'Revenue', ar: 'إيرادات' },
  OTHER_INCOME: { en: 'Other Income', ar: 'إيرادات أخرى' },
  GOVERNMENT: { en: 'Government', ar: 'حكومي' },
  SALARY: { en: 'Salary', ar: 'رواتب' },
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

const ALL_CATEGORIES: TransactionCategory[] = [
  'REVENUE', 'OTHER_INCOME', 'GOVERNMENT', 'SALARY', 'RENT',
  'UTILITIES', 'SUPPLIES', 'TRANSPORT', 'MARKETING', 'PROFESSIONAL',
  'INSURANCE', 'BANK_FEES', 'OTHER_EXPENSE',
]

interface ReviewQueueProps {
  transactions: Transaction[]
  onAccept: (ids: string[]) => void
  onChangeCategory: (id: string, category: TransactionCategory) => void
}

export function ReviewQueue({ transactions, onAccept, onChangeCategory }: ReviewQueueProps) {
  const t = useTranslations('bookkeeper')
  const locale = useLocale()

  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)

  const pending = useMemo(
    () => transactions.filter((tx) => !tx.is_reviewed && !acceptedIds.has(tx.id)),
    [transactions, acceptedIds]
  )

  const confidentIds = useMemo(
    () => pending.filter((tx) => (tx.ai_confidence ?? 0) >= CONFIDENCE_THRESHOLD).map((tx) => tx.id),
    [pending]
  )

  const handleAcceptSingle = useCallback((id: string) => {
    setAcceptedIds((prev) => new Set([...prev, id]))
    onAccept([id])
  }, [onAccept])

  const handleAcceptAllConfident = useCallback(() => {
    setAcceptedIds((prev) => new Set([...prev, ...confidentIds]))
    onAccept(confidentIds)
  }, [confidentIds, onAccept])

  const handleCategoryChange = useCallback((id: string, category: TransactionCategory) => {
    onChangeCategory(id, category)
    setEditingId(null)
  }, [onChangeCategory])

  const isAllReviewed = pending.length === 0

  if (isAllReviewed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 rounded-2xl border border-green-500/20 bg-green-500/5 p-12 text-center"
      >
        <div className="rounded-full bg-green-500/10 p-4">
          <PartyPopper className="h-8 w-8 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          {locale === 'ar' ? 'تمت مراجعة جميع العمليات!' : 'All transactions reviewed!'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {locale === 'ar'
            ? 'لا توجد عمليات تحتاج مراجعة حالياً'
            : 'No transactions need review right now'}
        </p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">
            {locale === 'ar' ? 'مراجعة العمليات' : 'Review Transactions'}
          </h3>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {pending.length}
          </span>
        </div>

        {confidentIds.length > 0 && (
          <button
            type="button"
            onClick={handleAcceptAllConfident}
            className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20"
          >
            <CheckCheck className="h-4 w-4" />
            {locale === 'ar'
              ? `قبول الواثقة (${confidentIds.length})`
              : `Accept Confident (${confidentIds.length})`}
          </button>
        )}
      </div>

      {/* Transaction List */}
      <div className="overflow-hidden rounded-xl border border-border">
        {/* Table Header */}
        <div className="hidden border-b border-border bg-surface-2 px-4 py-3 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-12 sm:gap-3">
          <div className="col-span-2">{locale === 'ar' ? 'التاريخ' : 'Date'}</div>
          <div className="col-span-3">{locale === 'ar' ? 'الوصف' : 'Description'}</div>
          <div className="col-span-2 text-end">{locale === 'ar' ? 'المبلغ' : 'Amount'}</div>
          <div className="col-span-3">{locale === 'ar' ? 'التصنيف المقترح' : 'AI Category'}</div>
          <div className="col-span-2 text-end">{locale === 'ar' ? 'إجراء' : 'Action'}</div>
        </div>

        <AnimatePresence>
          {pending.map((tx, index) => {
            const isLowConfidence = (tx.ai_confidence ?? 0) < CONFIDENCE_THRESHOLD
            const confidencePct = Math.round((tx.ai_confidence ?? 0) * 100)

            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: locale === 'ar' ? -80 : 80, height: 0 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  'border-b border-border px-4 py-3 transition-colors last:border-b-0',
                  isLowConfidence ? 'bg-amber-500/5' : 'bg-card'
                )}
              >
                {/* Mobile Layout */}
                <div className="sm:hidden">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {tx.description}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                        {tx.date}
                      </p>
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

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {tx.category && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${getCategoryColor(tx.category)}15`,
                            color: getCategoryColor(tx.category),
                          }}
                        >
                          {CATEGORY_LABEL_MAP[tx.category][locale === 'ar' ? 'ar' : 'en']}
                        </span>
                      )}
                      {isLowConfidence && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAcceptSingle(tx.id)}
                      className="rounded-lg bg-green-500/10 p-2 text-green-400 transition-colors hover:bg-green-500/20"
                      aria-label={locale === 'ar' ? 'قبول' : 'Accept'}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:grid sm:grid-cols-12 sm:items-center sm:gap-3">
                  <div className="col-span-2 text-sm text-muted-foreground" dir="ltr">
                    {tx.date}
                  </div>

                  <div className="col-span-3 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {tx.description}
                    </p>
                    {tx.vendor_or_client && (
                      <p className="truncate text-xs text-muted-foreground">
                        {tx.vendor_or_client}
                      </p>
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

                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      {editingId === tx.id ? (
                        <select
                          value={tx.category ?? ''}
                          onChange={(e) =>
                            handleCategoryChange(tx.id, e.target.value as TransactionCategory)
                          }
                          onBlur={() => setEditingId(null)}
                          autoFocus
                          className="h-8 w-full rounded-md border border-border bg-surface-1 px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {ALL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {CATEGORY_LABEL_MAP[cat][locale === 'ar' ? 'ar' : 'en']}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingId(tx.id)}
                          className="group flex items-center gap-1"
                        >
                          {tx.category && (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: `${getCategoryColor(tx.category)}15`,
                                color: getCategoryColor(tx.category),
                              }}
                            >
                              {CATEGORY_LABEL_MAP[tx.category][locale === 'ar' ? 'ar' : 'en']}
                            </span>
                          )}
                          <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      )}

                      {/* Confidence Bar */}
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              confidencePct >= 90 ? 'bg-green-400' :
                              confidencePct >= 70 ? 'bg-blue-400' :
                              'bg-amber-400'
                            )}
                            style={{ width: `${confidencePct}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {confidencePct}%
                        </span>
                        {isLowConfidence && (
                          <AlertTriangle className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleAcceptSingle(tx.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/20"
                      aria-label={locale === 'ar' ? 'قبول' : 'Accept'}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {locale === 'ar' ? 'قبول' : 'Accept'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
