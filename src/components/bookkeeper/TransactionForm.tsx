'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Tag,
  FileText,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { categorizeTransaction } from '@/lib/bookkeeper/smart-categorizer'
import type { TransactionType, TransactionCategory } from '@/lib/supabase/types'

const INCOME_CATEGORIES: TransactionCategory[] = ['REVENUE', 'OTHER_INCOME']

const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'GOVERNMENT',
  'SALARY',
  'RENT',
  'UTILITIES',
  'SUPPLIES',
  'TRANSPORT',
  'MARKETING',
  'PROFESSIONAL',
  'INSURANCE',
  'BANK_FEES',
  'OTHER_EXPENSE',
]

const CATEGORY_LABEL_MAP: Record<TransactionCategory, { en: string; ar: string }> = {
  REVENUE: { en: 'Sales Revenue', ar: 'إيرادات المبيعات' },
  OTHER_INCOME: { en: 'Other Income', ar: 'إيرادات أخرى' },
  GOVERNMENT: { en: 'Government Fees', ar: 'الرسوم الحكومية' },
  SALARY: { en: 'Salaries & Wages', ar: 'الرواتب والأجور' },
  RENT: { en: 'Rent', ar: 'الإيجار' },
  UTILITIES: { en: 'Utilities', ar: 'المرافق' },
  SUPPLIES: { en: 'Supplies', ar: 'المستلزمات' },
  TRANSPORT: { en: 'Transportation', ar: 'النقل' },
  MARKETING: { en: 'Marketing', ar: 'التسويق' },
  PROFESSIONAL: { en: 'Professional Services', ar: 'خدمات مهنية' },
  INSURANCE: { en: 'Insurance', ar: 'التأمين' },
  BANK_FEES: { en: 'Bank Fees', ar: 'رسوم بنكية' },
  OTHER_EXPENSE: { en: 'Other Expense', ar: 'مصروفات أخرى' },
}

interface TransactionFormProps {
  onSave: (transaction: {
    date: string
    amount: number
    type: TransactionType
    category: TransactionCategory
    description: string
    vendor_or_client: string
  }) => void
}

export function TransactionForm({ onSave }: TransactionFormProps) {
  const t = useTranslations('bookkeeper')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState<TransactionCategory | ''>('')
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [autoSuggested, setAutoSuggested] = useState(false)
  const userPickedCategory = useRef(false)

  const categories = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  // Auto-suggest category based on vendor/description using smart categorizer
  useEffect(() => {
    const suggest = () => {
      if (userPickedCategory.current || type === 'INCOME') return
      if (!description && !vendor) return

      const result = categorizeTransaction(description, vendor, amount ? parseFloat(amount) : undefined)
      if (result.confidence >= 0.5 && result.source !== 'default') {
        setCategory(result.category)
        setAutoSuggested(true)
      }
    }
    suggest()
  }, [description, vendor, amount, type])

  const handleReset = useCallback(() => {
    setType('EXPENSE')
    setAmount('')
    setDate(new Date().toISOString().split('T')[0])
    setCategory('')
    setDescription('')
    setVendor('')
    setAutoSuggested(false)
    userPickedCategory.current = false
  }, [])

  const handleSubmit = useCallback(() => {
    if (!amount || !date || !category) return

    onSave({
      date,
      amount: parseFloat(amount),
      type,
      category: category as TransactionCategory,
      description,
      vendor_or_client: vendor,
    })

    handleReset()
    setIsOpen(false)
  }, [amount, date, category, type, description, vendor, onSave, handleReset])

  const isValid = amount && parseFloat(amount) > 0 && date && category

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-transaction-trigger
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t('addTransaction')}
        </button>
      </Dialog.Trigger>

      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                className="fixed inset-x-4 top-[5vh] z-50 mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl sm:inset-x-auto"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-foreground">
                    {t('addTransaction')}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                      aria-label={tCommon('close')}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Type Toggle */}
                <div className="mb-5">
                  <label className="mb-2 block text-sm font-medium text-muted-foreground">
                    {t('transactionType')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setType('INCOME'); setCategory('') }}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                        type === 'INCOME'
                          ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30'
                          : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <TrendingUp className="h-4 w-4" />
                      {t('transactionIncome')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setType('EXPENSE'); setCategory('') }}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                        type === 'EXPENSE'
                          ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
                          : 'bg-surface-2 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <TrendingDown className="h-4 w-4" />
                      {t('transactionExpense')}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Amount */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      {t('transactionAmount')} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={t('transactionAmountPlaceholder')}
                      className="flex h-12 w-full rounded-lg border border-border bg-surface-1 px-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      dir="ltr"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {t('transactionDate')} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="flex h-12 w-full rounded-lg border border-border bg-surface-1 px-4 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      dir="ltr"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <Tag className="h-3.5 w-3.5" />
                      {t('transactionCategory')} <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => {
                        userPickedCategory.current = true
                        setAutoSuggested(false)
                        setCategory(e.target.value as TransactionCategory)
                      }}
                      className="flex h-12 w-full rounded-lg border border-border bg-surface-1 px-4 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="" disabled>
                        {locale === 'ar' ? 'اختر التصنيف' : 'Select category'}
                      </option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABEL_MAP[cat][locale === 'ar' ? 'ar' : 'en']}
                        </option>
                      ))}
                    </select>
                    {autoSuggested && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {locale === 'ar' ? 'تم اقتراح التصنيف تلقائيا' : 'Auto-suggested category'}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      {t('transactionDescription')}
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('transactionDescriptionPlaceholder')}
                      className="flex h-12 w-full rounded-lg border border-border bg-surface-1 px-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {/* Vendor / Client */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      {locale === 'ar' ? 'المورد / العميل' : 'Vendor / Client'}
                    </label>
                    <input
                      type="text"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      placeholder={locale === 'ar' ? 'اسم الجهة' : 'Name of vendor or client'}
                      className="flex h-12 w-full rounded-lg border border-border bg-surface-1 px-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-3"
                    >
                      {tCommon('cancel')}
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!isValid}
                    className={cn(
                      'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                      isValid
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'cursor-not-allowed bg-surface-3 text-muted-foreground'
                    )}
                  >
                    {tCommon('save')}
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
