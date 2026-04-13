'use client'

import { useMemo, useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion } from 'framer-motion'
import {
  Sparkles,
  AlertTriangle,
  GitCompareArrows,
  TrendingDown,
  TrendingUp,
  Receipt,
  Repeat,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatSAR } from '@/lib/bookkeeper/calculations'
import type { RecurringPattern } from '@/lib/bookkeeper/recurring-detection'
import type { CashFlowForecast } from '@/lib/bookkeeper/forecast'

interface AgentInsightsProps {
  duplicateCount: number
  lowConfidenceCount: number
  recurringPatterns: RecurringPattern[]
  monthlyRecurringCost: number
  cashFlowForecast: CashFlowForecast | null
  nextVatDueDate: string | null
  vatEstimate: number | null
  onScrollTo: (section: 'duplicates' | 'review' | 'vat' | 'forecast') => void
}

interface Insight {
  id: string
  icon: React.ReactNode
  text: string
  severity: 'info' | 'warning' | 'success'
  action?: { label: string; onClick: () => void }
}

export function AgentInsights({
  duplicateCount,
  lowConfidenceCount,
  recurringPatterns,
  monthlyRecurringCost,
  cashFlowForecast,
  nextVatDueDate,
  vatEstimate,
  onScrollTo,
}: AgentInsightsProps) {
  const t = useTranslations('bookkeeper.agent')
  const locale = useLocale()

  const [now, setNow] = useState(0)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init on mount
  useEffect(() => { setNow(Date.now()) }, [])

  const insights = useMemo(() => {
    const items: Insight[] = []

    if (duplicateCount > 0) {
      items.push({
        id: 'duplicates',
        icon: <GitCompareArrows className="h-4 w-4" />,
        text: t('duplicatesFound', { count: duplicateCount }),
        severity: 'warning',
        action: { label: t('reviewDuplicates'), onClick: () => onScrollTo('duplicates') },
      })
    }

    if (nextVatDueDate && vatEstimate !== null) {
      const daysUntil = Math.ceil(
        (new Date(nextVatDueDate).getTime() - now) / 86400000
      )
      if (daysUntil > 0 && daysUntil <= 30) {
        items.push({
          id: 'vat',
          icon: <Receipt className="h-4 w-4" />,
          text: t('vatDueSoon', {
            days: daysUntil,
            amount: formatSAR(vatEstimate, locale),
          }),
          severity: daysUntil <= 7 ? 'warning' : 'info',
          action: { label: t('viewVatReport'), onClick: () => onScrollTo('vat') },
        })
      }
    }

    if (lowConfidenceCount > 0) {
      items.push({
        id: 'review',
        icon: <AlertTriangle className="h-4 w-4" />,
        text: t('needsReview', { count: lowConfidenceCount }),
        severity: 'warning',
        action: { label: t('reviewQueue'), onClick: () => onScrollTo('review') },
      })
    }

    if (recurringPatterns.length > 0) {
      const topPattern = recurringPatterns[0]
      items.push({
        id: 'recurring',
        icon: <Repeat className="h-4 w-4" />,
        text: t('recurringDetected', {
          vendor: topPattern.vendor ?? topPattern.description,
          amount: formatSAR(monthlyRecurringCost, locale),
        }),
        severity: 'info',
      })
    }

    if (cashFlowForecast) {
      const isNegative = cashFlowForecast.projectedBalance < 0
      items.push({
        id: 'forecast',
        icon: isNegative ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />,
        text: isNegative
          ? t('cashFlowNegative', {
              amount: formatSAR(Math.abs(cashFlowForecast.projectedBalance), locale),
            })
          : t('cashFlowPositive', {
              amount: formatSAR(cashFlowForecast.projectedBalance, locale),
            }),
        severity: isNegative ? 'warning' : 'success',
        action: { label: t('viewForecast'), onClick: () => onScrollTo('forecast') },
      })
    }

    return items
  }, [
    duplicateCount, lowConfidenceCount, recurringPatterns, monthlyRecurringCost,
    cashFlowForecast, nextVatDueDate, vatEstimate, onScrollTo, t, locale, now,
  ])

  const severityColors = {
    info: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    warning: 'border-orange-500/20 bg-orange-500/5 text-orange-400',
    success: 'border-green-500/20 bg-green-500/5 text-green-400',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">{t('allClear')}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-2.5',
                severityColors[insight.severity]
              )}
            >
              <span className="shrink-0">{insight.icon}</span>
              <span className="min-w-0 flex-1 text-sm text-foreground">{insight.text}</span>
              {insight.action && (
                <button
                  type="button"
                  onClick={insight.action.onClick}
                  className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/20"
                >
                  {insight.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
