'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import * as Select from '@radix-ui/react-select'
import * as Popover from '@radix-ui/react-popover'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarDays,
  X,
  Undo2,
  List,
  Calendar,
  Loader2,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  differenceInDays,
} from 'date-fns'
import { ar, enUS } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ToastContainer, useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { toHijri, formatHijri, toArabicNumerals, HIJRI_MONTHS_AR, HIJRI_MONTHS_EN } from '@/lib/hijri'
import {
  getObligationStatus,
  getObligationStatusColor,
  getObligationDotColor,
  getNextRecurrence,
} from '@/lib/compliance/rules-engine'
import { estimatePenalty } from '@/lib/compliance/penalties'
import { createClient } from '@/lib/supabase/client'

import type { Obligation, ObligationType, ObligationFrequency } from '@/lib/supabase/types'
import type { ObligationStatus } from '@/lib/compliance/rules-engine'

// --- Constants ---

const ALL_OBLIGATION_TYPES: ObligationType[] = [
  'CR_CONFIRMATION', 'GOSI', 'ZATCA_VAT', 'CHAMBER', 'ZAKAT',
  'BALADY', 'MISA', 'INSURANCE', 'QIWA', 'FOOD_SAFETY',
  'SAFETY_CERT', 'HEALTH_LICENSE', 'CUSTOM',
]

const OBLIGATION_TYPE_LABELS: Record<ObligationType, { en: string; ar: string }> = {
  CR_CONFIRMATION: { en: 'CR Confirmation', ar: 'تأكيد السجل التجاري' },
  GOSI: { en: 'GOSI', ar: 'التأمينات' },
  ZATCA_VAT: { en: 'VAT Return', ar: 'إقرار ضريبي' },
  CHAMBER: { en: 'Chamber', ar: 'الغرفة التجارية' },
  ZAKAT: { en: 'Zakat', ar: 'الزكاة' },
  BALADY: { en: 'Balady', ar: 'بلدي' },
  MISA: { en: 'MISA', ar: 'الاستثمار' },
  INSURANCE: { en: 'Insurance', ar: 'التأمين' },
  QIWA: { en: 'Qiwa', ar: 'قوى' },
  FOOD_SAFETY: { en: 'Food Safety', ar: 'سلامة الغذاء' },
  SAFETY_CERT: { en: 'Safety Certificate', ar: 'شهادة السلامة' },
  HEALTH_LICENSE: { en: 'Health License', ar: 'رخصة صحية' },
  CUSTOM: { en: 'Custom', ar: 'مخصص' },
}

const FREQUENCY_OPTIONS: { value: ObligationFrequency; labelKey: string }[] = [
  { value: 'ONE_TIME', labelKey: 'none' },
  { value: 'MONTHLY', labelKey: 'monthly' },
  { value: 'QUARTERLY', labelKey: 'quarterly' },
  { value: 'ANNUAL', labelKey: 'annually' },
]

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

// --- Helper ---

function getObligationTypeLabel(type: ObligationType, locale: string): string {
  const labels = OBLIGATION_TYPE_LABELS[type]
  return locale === 'ar' ? labels.ar : labels.en
}

// --- Components ---

function StatusBadge({ status, label }: { status: ObligationStatus; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        getObligationStatusColor(status)
      )}
    >
      {status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'overdue' && <AlertTriangle className="h-3 w-3" />}
      {status === 'due_soon' && <Clock className="h-3 w-3" />}
      {label}
    </span>
  )
}

function ObligationListItem({
  obligation,
  locale,
  onMarkDone,
  onUndo,
}: {
  obligation: Obligation
  locale: string
  onMarkDone: (id: string) => void
  onUndo: (id: string) => void
}) {
  const t = useTranslations('calendar')
  const [isExpanded, setIsExpanded] = useState(false)
  const dateLocale = locale === 'ar' ? ar : enUS

  const status = getObligationStatus(obligation.next_due_date, obligation.last_completed_at)
  const dueDate = new Date(obligation.next_due_date)
  const daysUntil = differenceInDays(dueDate, new Date())
  const isCompleted = status === 'completed'

  const statusLabel =
    status === 'upcoming' ? t('upcoming')
      : status === 'due_soon' ? t('dueSoon')
        : status === 'overdue' ? t('overdue')
          : t('completed')

  const daysLabel =
    daysUntil === 0
      ? t('dueToday')
      : daysUntil > 0
        ? t('daysRemaining', { count: daysUntil })
        : t('daysOverdue', { count: Math.abs(daysUntil) })

  return (
    <motion.div variants={ITEM_VARIANTS}>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          'w-full rounded-xl border border-border bg-card p-4 text-start transition-all hover:border-primary/30 hover:bg-surface-2',
          isCompleted && 'opacity-60'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-2.5 w-2.5 shrink-0 rounded-full',
            getObligationDotColor(status)
          )} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-sm font-medium text-foreground',
                isCompleted && 'line-through'
              )}>
                {obligation.name}
              </span>
              <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {getObligationTypeLabel(obligation.type, locale)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{format(dueDate, 'dd MMM yyyy', { locale: dateLocale })}</span>
              <span>·</span>
              <span>{daysLabel}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground/60">
              {formatHijri(toHijri(dueDate), locale)}
            </div>
          </div>

          <StatusBadge status={status} label={statusLabel} />
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 border-t border-border pt-3">
                {obligation.description && (
                  <p className="text-sm text-muted-foreground">{obligation.description}</p>
                )}
                {obligation.notes && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {obligation.notes}
                  </p>
                )}
                {status === 'overdue' && (() => {
                  const penalty = estimatePenalty(obligation.type, Math.abs(daysUntil))
                  if (penalty.amount <= 0) return null
                  return (
                    <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                        <span className="text-xs font-semibold text-red-400">
                          {locale === 'ar' ? 'غرامة تقديرية' : 'Est. penalty'}: SAR {penalty.amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-red-400/70">{penalty.description}</p>
                    </div>
                  )
                })()}
                <div className="mt-3 flex gap-2">
                  {!isCompleted ? (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onMarkDone(obligation.id)
                      }}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('markAsDone')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUndo(obligation.id)
                      }}
                      className="gap-1.5"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      {t('markAsUndone')}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  )
}

function CalendarMonthView({
  obligations,
  locale,
  currentMonth,
  onMonthChange,
}: {
  obligations: Obligation[]
  locale: string
  currentMonth: Date
  onMonthChange: (month: Date) => void
}) {
  const dateLocale = locale === 'ar' ? ar : enUS
  const weekdays = locale === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN
  const [popoverDate, setPopoverDate] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd })

  const obligationsByDate = useMemo(() => {
    const map = new Map<string, Obligation[]>()
    for (const ob of obligations) {
      const dateKey = ob.next_due_date.split('T')[0]
      const existing = map.get(dateKey) ?? []
      existing.push(ob)
      map.set(dateKey, existing)
    }
    return map
  }, [obligations])

  return (
    <div>
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-foreground">
            {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
          </h3>
          <p className="text-[11px] text-muted-foreground/70">
            {(() => {
              const hijriMonth = toHijri(currentMonth)
              const monthName = locale === 'ar'
                ? HIJRI_MONTHS_AR[hijriMonth.month - 1]
                : HIJRI_MONTHS_EN[hijriMonth.month - 1]
              const year = locale === 'ar'
                ? toArabicNumerals(String(hijriMonth.year))
                : hijriMonth.year
              return `${monthName} ${year}`
            })()}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-px">
        {weekdays.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const dayObligations = obligationsByDate.get(dateKey) ?? []
          const hijri = toHijri(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isDayToday = isToday(day)
          const hasObligations = dayObligations.length > 0

          return (
            <Popover.Root
              key={dateKey}
              open={popoverDate !== null && isSameDay(popoverDate, day)}
              onOpenChange={(open) => setPopoverDate(open ? day : null)}
            >
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    'relative flex h-20 flex-col items-center rounded-lg p-1 text-xs transition-colors sm:h-24',
                    isCurrentMonth
                      ? 'text-foreground hover:bg-surface-2'
                      : 'text-muted-foreground/40',
                    isDayToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                    hasObligations && 'cursor-pointer'
                  )}
                  disabled={!hasObligations}
                >
                  <span className={cn('font-medium', isDayToday && 'text-primary')}>
                    {format(day, 'd')}
                  </span>
                  <span className="mt-0.5 text-[9px] text-muted-foreground/60">
                    {hijri.day}
                  </span>

                  {hasObligations && (
                    <div className="mt-auto flex gap-0.5 pb-0.5">
                      {dayObligations.slice(0, 3).map((ob) => {
                        const obStatus = getObligationStatus(ob.next_due_date, ob.last_completed_at)
                        return (
                          <span
                            key={ob.id}
                            className={cn('h-1.5 w-1.5 rounded-full', getObligationDotColor(obStatus))}
                          />
                        )
                      })}
                      {dayObligations.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">
                          +{dayObligations.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-50 w-72 rounded-xl border border-border bg-card p-3 shadow-xl"
                  sideOffset={4}
                  align="center"
                >
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    {format(day, 'EEEE, dd MMM yyyy', { locale: dateLocale })}
                  </p>
                  <p className="mb-3 text-[10px] text-muted-foreground">
                    {formatHijri(hijri, locale)}
                  </p>
                  <div className="space-y-2">
                    {dayObligations.map((ob) => {
                      const obStatus = getObligationStatus(ob.next_due_date, ob.last_completed_at)
                      return (
                        <div
                          key={ob.id}
                          className="flex items-center gap-2 rounded-lg bg-surface-2 p-2"
                        >
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', getObligationDotColor(obStatus))} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-foreground">{ob.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {getObligationTypeLabel(ob.type, locale)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <Popover.Arrow className="fill-border" />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )
        })}
      </div>
    </div>
  )
}

function AddObligationDialog({
  isOpen,
  onOpenChange,
  locale,
  businessId,
  onAdd,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  businessId: string
  onAdd: (obligation: Obligation) => void
}) {
  const t = useTranslations('calendar')
  const tCommon = useTranslations('common')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [frequency, setFrequency] = useState<ObligationFrequency>('ONE_TIME')
  const [type, setType] = useState<ObligationType>('CUSTOM')
  const [isSaving, setIsSaving] = useState(false)

  const handleReset = useCallback(() => {
    setName('')
    setDescription('')
    setDueDate('')
    setFrequency('ONE_TIME')
    setType('CUSTOM')
  }, [])

  const handleSave = useCallback(async () => {
    if (!name || !dueDate) return

    setIsSaving(true)
    const supabase = createClient()

    const payload = {
      business_id: businessId,
      type,
      name,
      description: description || null,
      frequency,
      next_due_date: dueDate,
      last_completed_at: null,
      reminder_30d_sent: false,
      reminder_15d_sent: false,
      reminder_7d_sent: false,
      reminder_1d_sent: false,
      linked_document_id: null,
      notes: null,
    }

    const { data, error } = (await supabase.from('obligations')
      .insert(payload as never)
      .select()
      .single()) as unknown as { data: Obligation | null; error: unknown }

    setIsSaving(false)

    if (error || !data) return

    onAdd(data)
    handleReset()
    onOpenChange(false)
  }, [name, description, dueDate, frequency, type, businessId, onAdd, onOpenChange, handleReset])

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleReset()
        onOpenChange(open)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl data-[state=open]:animate-scale-in">
          <Dialog.Title className="text-lg font-semibold text-foreground">
            {t('addObligation')}
          </Dialog.Title>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('obligationTitle')}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('obligationTitlePlaceholder')}
                className="h-10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('obligationDescription')}
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('obligationDescriptionPlaceholder')}
                className="h-10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('category')}
              </label>
              <Select.Root value={type} onValueChange={(v) => setType(v as ObligationType)}>
                <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring">
                  <Select.Value>{getObligationTypeLabel(type, locale)}</Select.Value>
                  <Select.Icon><ChevronDown className="h-4 w-4 text-muted-foreground" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="z-[60] max-h-64 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl" position="popper" sideOffset={4}>
                    <Select.Viewport>
                      {ALL_OBLIGATION_TYPES.map((otype) => (
                        <Select.Item key={otype} value={otype} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                          <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                          <Select.ItemText>{getObligationTypeLabel(otype, locale)}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('dueDate')}
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {t('recurrence')}
              </label>
              <Select.Root value={frequency} onValueChange={(v) => setFrequency(v as ObligationFrequency)}>
                <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring">
                  <Select.Value>
                    {t(`recurrenceOptions.${FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.labelKey ?? 'none'}`)}
                  </Select.Value>
                  <Select.Icon><ChevronDown className="h-4 w-4 text-muted-foreground" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="z-[60] overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl" position="popper" sideOffset={4}>
                    <Select.Viewport>
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <Select.Item key={opt.value} value={opt.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none hover:bg-surface-2 data-[highlighted]:bg-surface-2">
                          <Select.ItemIndicator><Check className="h-4 w-4 text-primary" /></Select.ItemIndicator>
                          <Select.ItemText>{t(`recurrenceOptions.${opt.labelKey}`)}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  handleReset()
                  onOpenChange(false)
                }}
                className="flex-1"
              >
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name || !dueDate || isSaving}
                className="flex-1 gap-2"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {tCommon('save')}
              </Button>
            </div>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute end-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label={tCommon('close')}
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Toast({
  message,
  isVisible,
  onUndo,
}: {
  message: string
  isVisible: boolean
  onUndo: () => void
}) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 start-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xl rtl:translate-x-1/2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-foreground">{message}</span>
          <Button variant="ghost" size="sm" onClick={onUndo} className="gap-1 text-xs">
            <Undo2 className="h-3 w-3" />
            Undo
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Page ---

export default function CalendarPage() {
  const t = useTranslations('calendar')
  const tEmpty = useTranslations('emptyStates')
  const locale = useLocale()

  const [obligations, setObligations] = useState<Obligation[]>([])
  const [businessId, setBusinessId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; undoId: string | null } | null>(null)
  const [undoBackup, setUndoBackup] = useState<Obligation | null>(null)

  const { toasts, showToast, dismissToast } = useToast()

  useEffect(() => {
    async function loadObligations() {
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

        const { data: obligationsData } = await supabase
          .from('obligations')
          .select('*')
          .eq('business_id', biz.id)
          .order('next_due_date', { ascending: true }) as { data: Obligation[] | null; error: unknown }

        if (obligationsData) setObligations(obligationsData)
      } catch {
        showToast(locale === 'ar' ? 'فشل في تحميل البيانات' : 'Failed to load data', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    loadObligations()
  }, [locale, showToast])

  const handleAddObligation = useCallback((obligation: Obligation) => {
    setObligations((prev) => [...prev, obligation].sort(
      (a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime()
    ))
  }, [])

  const handleMarkDone = useCallback(async (id: string) => {
    const supabase = createClient()
    const now = new Date().toISOString()

    setObligations((prev) =>
      prev.map((ob) => {
        if (ob.id !== id) return ob
        setUndoBackup({ ...ob })

        if (ob.frequency !== 'ONE_TIME' && ob.frequency !== 'CUSTOM') {
          const nextDate = getNextRecurrence(ob.frequency, new Date(ob.next_due_date))
          return {
            ...ob,
            last_completed_at: now,
            next_due_date: nextDate.toISOString().split('T')[0],
            reminder_30d_sent: false,
            reminder_15d_sent: false,
            reminder_7d_sent: false,
            reminder_1d_sent: false,
          }
        }

        return { ...ob, last_completed_at: now }
      })
    )

    const ob = obligations.find((o) => o.id === id)
    if (!ob) return

    const updates: Partial<Obligation> = { last_completed_at: now }
    if (ob.frequency !== 'ONE_TIME' && ob.frequency !== 'CUSTOM') {
      const nextDate = getNextRecurrence(ob.frequency, new Date(ob.next_due_date))
      updates.next_due_date = nextDate.toISOString().split('T')[0]
      updates.reminder_30d_sent = false
      updates.reminder_15d_sent = false
      updates.reminder_7d_sent = false
      updates.reminder_1d_sent = false
    }

    await supabase.from('obligations').update(updates as never).eq('id', id)

    setToast({ message: t('obligationSaved'), undoId: id })
    setTimeout(() => setToast(null), 5000)
  }, [obligations, t])

  const handleUndo = useCallback(async (id: string) => {
    if (!undoBackup || undoBackup.id !== id) return

    const backup = undoBackup
    setObligations((prev) => prev.map((ob) => (ob.id === id ? backup : ob)))
    setUndoBackup(null)
    setToast(null)

    const supabase = createClient()
    await supabase.from('obligations')
      .update({
        last_completed_at: backup.last_completed_at,
        next_due_date: backup.next_due_date,
      } as never)
      .eq('id', id)
  }, [undoBackup])

  const handleUndoFromObligation = useCallback(async (id: string) => {
    setObligations((prev) =>
      prev.map((ob) => ob.id === id ? { ...ob, last_completed_at: null } : ob)
    )

    const supabase = createClient()
    await supabase.from('obligations')
      .update({ last_completed_at: null } as never)
      .eq('id', id)
  }, [])

  const statusCounts = useMemo(() => {
    const counts = { upcoming: 0, due_soon: 0, overdue: 0, completed: 0 }
    for (const ob of obligations) {
      const status = getObligationStatus(ob.next_due_date, ob.last_completed_at)
      counts[status]++
    }
    return counts
  }, [obligations])

  const listObligations = useMemo(() => {
    return [...obligations].sort(
      (a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime()
    )
  }, [obligations])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2" disabled={!businessId}>
          <Plus className="h-4 w-4" />
          {t('addObligation')}
        </Button>
      </div>

      {/* Status Summary */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          {statusCounts.upcoming} {t('upcoming')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {statusCounts.due_soon} {t('dueSoon')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          {statusCounts.overdue} {t('overdue')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {statusCounts.completed} {t('completed')}
        </span>
      </div>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex gap-1 rounded-lg border border-border bg-surface-1 p-1">
          <Tabs.Trigger
            value="list"
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-4 w-4" />
            {t('listView')}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="month"
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'month'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Calendar className="h-4 w-4" />
            {t('monthView')}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="list" className="mt-4">
          {listObligations.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title={tEmpty('noObligations')}
              description={tEmpty('noObligationsDesc')}
              actionLabel={tEmpty('addObligation')}
              onAction={() => setIsAddOpen(true)}
            />
          ) : (
            <motion.div
              variants={CONTAINER_VARIANTS}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {listObligations.map((ob) => (
                <ObligationListItem
                  key={ob.id}
                  obligation={ob}
                  locale={locale}
                  onMarkDone={handleMarkDone}
                  onUndo={handleUndoFromObligation}
                />
              ))}
            </motion.div>
          )}
        </Tabs.Content>

        <Tabs.Content value="month" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <CalendarMonthView
              obligations={obligations}
              locale={locale}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
            />
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {/* Add Obligation Dialog */}
      {businessId && (
        <AddObligationDialog
          isOpen={isAddOpen}
          onOpenChange={setIsAddOpen}
          locale={locale}
          businessId={businessId}
          onAdd={handleAddObligation}
        />
      )}

      {/* Completion Toast */}
      <Toast
        message={toast?.message ?? ''}
        isVisible={toast !== null}
        onUndo={() => toast?.undoId && handleUndo(toast.undoId)}
      />
    </div>
  )
}
