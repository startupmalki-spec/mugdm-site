'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ObligationFrequency, ObligationType } from '@/lib/supabase/types'

/* ─── Public types ─── */

export interface PreviewedObligation {
  type: ObligationType
  name: string
  applicability: 'REQUIRED' | 'NOT_APPLICABLE' | 'SUGGESTED'
  reason: { ar: string; en: string } | null
  frequency: ObligationFrequency
  next_due_date: string
}

export interface ObligationReviewProps {
  obligations: PreviewedObligation[]
  loading: boolean
  confirmedTypes: Set<ObligationType>
  onToggle: (type: ObligationType) => void
  hasPhysicalLocation: boolean | null
  onSetPhysicalLocation: (value: boolean) => void
  onContinue: () => void
}

/* ─── Presentation helpers ─── */

const OBLIGATION_ICONS: Record<string, typeof CalendarDays> = {
  CR_CONFIRMATION: Building2,
  GOSI: CalendarDays,
  ZATCA_VAT: CalendarDays,
  ZAKAT: CalendarDays,
  CHAMBER: Building2,
  BALADY: Building2,
  FOOD_SAFETY: CalendarDays,
  SAFETY_CERT: CalendarDays,
  HEALTH_LICENSE: CalendarDays,
}

const OBLIGATION_COLORS: Record<string, string> = {
  CR_CONFIRMATION: 'text-blue-400 bg-blue-500/10',
  GOSI: 'text-emerald-400 bg-emerald-500/10',
  ZATCA_VAT: 'text-amber-400 bg-amber-500/10',
  ZAKAT: 'text-violet-400 bg-violet-500/10',
  CHAMBER: 'text-cyan-400 bg-cyan-500/10',
  BALADY: 'text-orange-400 bg-orange-500/10',
  FOOD_SAFETY: 'text-pink-400 bg-pink-500/10',
  SAFETY_CERT: 'text-red-400 bg-red-500/10',
  HEALTH_LICENSE: 'text-teal-400 bg-teal-500/10',
}

/* ─── Component ─── */

export function ObligationReview({
  obligations,
  loading,
  confirmedTypes,
  onToggle,
  hasPhysicalLocation,
  onSetPhysicalLocation,
  onContinue,
}: ObligationReviewProps) {
  const t = useTranslations('onboarding')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isArabic = locale === 'ar'
  const [showNotApplicable, setShowNotApplicable] = useState(false)

  const visible = obligations.filter((o) => o.applicability !== 'NOT_APPLICABLE')
  const notApplicable = obligations.filter((o) => o.applicability === 'NOT_APPLICABLE')

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <CalendarCheck className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {t('obligationReview.title')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('obligationReview.subtitle')}
        </p>
      </motion.div>

      {/* Physical-premises question */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">
          {t('obligationReview.baladyPhysicalNote')}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={hasPhysicalLocation === true ? 'default' : 'outline'}
            onClick={() => onSetPhysicalLocation(true)}
          >
            {tCommon('yes')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={hasPhysicalLocation === false ? 'default' : 'outline'}
            onClick={() => onSetPhysicalLocation(false)}
          >
            {tCommon('no')}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="space-y-2">
        {visible.map((ob, index) => {
          const Icon = OBLIGATION_ICONS[ob.type] || CalendarDays
          const colorClasses =
            OBLIGATION_COLORS[ob.type] || 'text-blue-400 bg-blue-500/10'
          const [textColor, bgColor] = colorClasses.split(' ')
          const isRequired = ob.applicability === 'REQUIRED'
          const isSuggested = ob.applicability === 'SUGGESTED'
          const isBaladyNoPremises =
            ob.type === 'BALADY' && hasPhysicalLocation === false
          const checked = confirmedTypes.has(ob.type)
          const reasonText = ob.reason
            ? isArabic
              ? ob.reason.ar
              : ob.reason.en
            : null

          const handleChange = () => {
            // REQUIRED obligations are locked — cannot untoggle.
            if (isRequired) return
            onToggle(ob.type)
          }

          return (
            <motion.label
              key={ob.type}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                isRequired ? 'cursor-default' : 'cursor-pointer',
                checked
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card hover:border-border/80',
                isSuggested && 'ring-1 ring-amber-500/20'
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={handleChange}
                disabled={isRequired}
                aria-disabled={isRequired}
                className="mt-1 h-4 w-4 shrink-0 accent-primary disabled:opacity-60"
              />
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  bgColor
                )}
              >
                <Icon className={cn('h-4 w-4', textColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{ob.name}</p>
                  {isRequired ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <Lock className="h-2.5 w-2.5" />
                      {t('obligationReview.requiredLabel')}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                      {t('obligationReview.suggestedLabel')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    `frequencyLabels.${ob.frequency}` as Parameters<typeof t>[0]
                  )}
                  {' · '}
                  {ob.next_due_date}
                </p>
                {isRequired && (
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    {t('obligationReview.requiredLockedNote')}
                  </p>
                )}
                {isSuggested && (
                  <p className="mt-1 text-xs italic text-amber-400/80">
                    {isBaladyNoPremises
                      ? t('obligationReview.baladyNoPremisesNote')
                      : reasonText ?? t('obligationReview.suggestedNote')}
                  </p>
                )}
              </div>
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            </motion.label>
          )
        })}
      </div>

      {notApplicable.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20">
          <button
            type="button"
            onClick={() => setShowNotApplicable((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <span>
              {showNotApplicable
                ? t('obligationReview.hideNotApplicable')
                : t('obligationReview.showNotApplicable', {
                    count: notApplicable.length,
                  })}
            </span>
            {showNotApplicable ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            )}
          </button>
          {showNotApplicable && (
            <div className="space-y-2 border-t border-border/60 p-3">
              {notApplicable.map((ob) => {
                const reasonText = ob.reason
                  ? isArabic
                    ? ob.reason.ar
                    : ob.reason.en
                  : null
                return (
                  <div
                    key={ob.type}
                    className="flex items-start gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2 opacity-70"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground line-through decoration-muted-foreground/50">
                          {ob.name}
                        </p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {t('obligationReview.notApplicableLabel')}
                        </span>
                      </div>
                      {reasonText && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {reasonText}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t('calendarPreviewSubtitle')}
          </p>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Button onClick={onContinue} size="lg" className="gap-2">
          {t('obligationReview.continue')}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  )
}
