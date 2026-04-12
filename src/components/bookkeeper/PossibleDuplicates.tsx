'use client'

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { GitCompareArrows, Check, Merge, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatSAR } from '@/lib/bookkeeper/calculations'
import type { FuzzyDuplicatePair, DuplicateResolution } from '@/lib/bookkeeper/duplicate-detection'

interface PossibleDuplicatesProps {
  pairs: FuzzyDuplicatePair[]
  onResolve: (pairIndex: number, resolution: DuplicateResolution) => void
}

export function PossibleDuplicates({ pairs, onResolve }: PossibleDuplicatesProps) {
  const t = useTranslations('bookkeeper.duplicates')
  const locale = useLocale()
  const isRtl = locale === 'ar'

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [resolvedIndices, setResolvedIndices] = useState<Set<number>>(new Set())

  const handleResolve = useCallback(
    (index: number, resolution: DuplicateResolution) => {
      onResolve(index, resolution)
      setResolvedIndices((prev) => new Set([...prev, index]))
    },
    [onResolve]
  )

  const unresolvedPairs = pairs.filter((_, i) => !resolvedIndices.has(i))

  if (unresolvedPairs.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-orange-500/10 p-2">
          <GitCompareArrows className="h-4 w-4 text-orange-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('subtitle', { count: unresolvedPairs.length })}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-orange-500/20 bg-orange-500/5">
        <AnimatePresence>
          {pairs.map((pair, index) => {
            if (resolvedIndices.has(index)) return null

            const isExpanded = expandedIndex === index
            const { transactionA: a, transactionB: b } = pair

            return (
              <motion.div
                key={`${a.id}-${b.id}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-orange-500/10 last:border-b-0"
              >
                {/* Summary Row */}
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-orange-500/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.description || b.description || t('noDescription')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isRtl ? pair.reasonAr : pair.reason}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground" dir="ltr">
                    {formatSAR(a.amount)}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3 px-4 pb-4"
                  >
                    {/* Side-by-side comparison */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-card p-3">
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {t('transactionA')}
                        </p>
                        <p className="text-sm text-foreground">{a.description}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span dir="ltr">{a.date}</span>
                          <span dir="ltr">{formatSAR(a.amount)}</span>
                        </div>
                        {a.vendor_or_client && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{a.vendor_or_client}</p>
                        )}
                      </div>
                      <div className="rounded-lg border border-border bg-card p-3">
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {t('transactionB')}
                        </p>
                        <p className="text-sm text-foreground">{b.description}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span dir="ltr">{b.date}</span>
                          <span dir="ltr">{formatSAR(b.amount)}</span>
                        </div>
                        {b.vendor_or_client && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{b.vendor_or_client}</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleResolve(index, 'keep_both')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {t('keepBoth')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolve(index, 'merge')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
                      >
                        <Merge className="h-3.5 w-3.5" />
                        {t('merge')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolve(index, 'delete_a')}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20'
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('deleteFirst')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolve(index, 'delete_b')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('deleteSecond')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
