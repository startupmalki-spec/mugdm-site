'use client'

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  X,
  Loader2,
  Receipt,
  Calendar,
  DollarSign,
  Tag,
  FileText,
  User,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TransactionCategory } from '@/lib/supabase/types'

const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'SUPPLIES', 'UTILITIES', 'TRANSPORT', 'MARKETING', 'PROFESSIONAL',
  'RENT', 'INSURANCE', 'GOVERNMENT', 'BANK_FEES', 'OTHER_EXPENSE',
]

const CATEGORY_LABEL_MAP: Record<string, { en: string; ar: string }> = {
  SUPPLIES: { en: 'Supplies', ar: 'مستلزمات' },
  UTILITIES: { en: 'Utilities', ar: 'مرافق' },
  TRANSPORT: { en: 'Transport', ar: 'نقل' },
  MARKETING: { en: 'Marketing', ar: 'تسويق' },
  PROFESSIONAL: { en: 'Professional', ar: 'مهني' },
  RENT: { en: 'Rent', ar: 'إيجار' },
  INSURANCE: { en: 'Insurance', ar: 'تأمين' },
  GOVERNMENT: { en: 'Government', ar: 'حكومي' },
  BANK_FEES: { en: 'Bank Fees', ar: 'بنكية' },
  OTHER_EXPENSE: { en: 'Other', ar: 'أخرى' },
}

type CaptureStep = 'capture' | 'analyzing' | 'confirm'

interface MockExtractedData {
  amount: number
  vendor: string
  date: string
  category: TransactionCategory
  vatAmount: number
  description: string
}

const MOCK_EXTRACTIONS: MockExtractedData[] = [
  { amount: 385, vendor: 'Jarir Bookstore', date: '2026-04-10', category: 'SUPPLIES', vatAmount: 50.22, description: 'مستلزمات مكتبية - حبر وورق' },
  { amount: 1250, vendor: 'STC Business', date: '2026-04-08', category: 'UTILITIES', vatAmount: 163.04, description: 'فاتورة الاتصالات - أبريل' },
  { amount: 2800, vendor: 'Print House', date: '2026-04-05', category: 'MARKETING', vatAmount: 365.22, description: 'طباعة بطاقات عمل وبروشورات' },
]

interface ReceiptCaptureProps {
  onSave: (data: {
    amount: number
    vendor: string
    date: string
    category: TransactionCategory
    vatAmount: number
    description: string
  }) => void
}

export function ReceiptCapture({ onSave }: ReceiptCaptureProps) {
  const t = useTranslations('bookkeeper')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<CaptureStep>('capture')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState<TransactionCategory>('SUPPLIES')
  const [vatAmount, setVatAmount] = useState('')
  const [description, setDescription] = useState('')

  const handleReset = useCallback(() => {
    setStep('capture')
    setPreviewUrl(null)
    setAmount('')
    setVendor('')
    setDate('')
    setCategory('SUPPLIES')
    setVatAmount('')
    setDescription('')
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setStep('analyzing')

    // Simulate AI analysis with mock data
    const mockIndex = Math.floor(Math.random() * MOCK_EXTRACTIONS.length)
    const mock = MOCK_EXTRACTIONS[mockIndex]

    setTimeout(() => {
      setAmount(String(mock.amount))
      setVendor(mock.vendor)
      setDate(mock.date)
      setCategory(mock.category)
      setVatAmount(String(mock.vatAmount))
      setDescription(mock.description)
      setStep('confirm')
    }, 2000)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!amount || !date) return

    onSave({
      amount: parseFloat(amount),
      vendor,
      date,
      category,
      vatAmount: vatAmount ? parseFloat(vatAmount) : 0,
      description,
    })

    handleReset()
    setIsOpen(false)
  }, [amount, vendor, date, category, vatAmount, description, onSave, handleReset])

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) handleReset()
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
        >
          <Camera className="h-4 w-4 text-primary" />
          {t('addReceipt')}
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
                className="fixed inset-x-4 top-[3vh] z-50 mx-auto max-h-[94vh] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl sm:inset-x-auto"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                  <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Receipt className="h-5 w-5 text-primary" />
                    {t('addReceipt')}
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

                <AnimatePresence mode="wait">
                  {/* Step 1: Capture */}
                  {step === 'capture' && (
                    <motion.div
                      key="capture"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border bg-surface-1 p-8">
                        <div className="rounded-2xl bg-primary/10 p-4">
                          <Camera className="h-8 w-8 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-foreground">
                            {locale === 'ar' ? 'التقط صورة للإيصال' : 'Capture receipt photo'}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {locale === 'ar'
                              ? 'سنستخرج البيانات تلقائياً'
                              : "We'll extract the data automatically"}
                          </p>
                        </div>

                        <div className="flex gap-3">
                          {/* Camera input (mobile) */}
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                            <Camera className="h-4 w-4" />
                            {locale === 'ar' ? 'التقاط' : 'Capture'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleFileSelect(file)
                              }}
                            />
                          </label>

                          {/* File picker (desktop) */}
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-3">
                            {locale === 'ar' ? 'اختر ملف' : 'Choose File'}
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleFileSelect(file)
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Analyzing */}
                  {step === 'analyzing' && (
                    <motion.div
                      key="analyzing"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      {previewUrl && (
                        <div className="mb-4 overflow-hidden rounded-xl border border-border">
                          <img
                            src={previewUrl}
                            alt="Receipt preview"
                            className="h-48 w-full object-cover opacity-60"
                          />
                        </div>
                      )}

                      <div className="flex flex-col items-center gap-3 py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="font-medium text-foreground">
                          {locale === 'ar' ? 'جارٍ تحليل الإيصال...' : 'Analyzing receipt...'}
                        </p>
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-primary"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Confirm */}
                  {step === 'confirm' && (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      {previewUrl && (
                        <div className="mb-4 overflow-hidden rounded-xl border border-border">
                          <img
                            src={previewUrl}
                            alt="Receipt preview"
                            className="h-32 w-full object-cover"
                          />
                        </div>
                      )}

                      <div className="space-y-3">
                        {/* Amount */}
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            {t('transactionAmount')} <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="flex h-10 w-full rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            dir="ltr"
                          />
                        </div>

                        {/* VAT */}
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Tag className="h-3 w-3" />
                            {locale === 'ar' ? 'مبلغ الضريبة' : 'VAT Amount'}
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={vatAmount}
                            onChange={(e) => setVatAmount(e.target.value)}
                            className="flex h-10 w-full rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            dir="ltr"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Vendor */}
                          <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <User className="h-3 w-3" />
                              {locale === 'ar' ? 'المورد' : 'Vendor'}
                            </label>
                            <input
                              type="text"
                              value={vendor}
                              onChange={(e) => setVendor(e.target.value)}
                              className="flex h-10 w-full rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>

                          {/* Date */}
                          <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {t('transactionDate')}
                            </label>
                            <input
                              type="date"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              className="flex h-10 w-full rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              dir="ltr"
                            />
                          </div>
                        </div>

                        {/* Category */}
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Tag className="h-3 w-3" />
                            {t('transactionCategory')}
                          </label>
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                            className="flex h-10 w-full rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {CATEGORY_LABEL_MAP[cat][locale === 'ar' ? 'ar' : 'en']}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            {t('transactionDescription')}
                          </label>
                          <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="flex h-10 w-full rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-5 flex gap-3">
                        <button
                          type="button"
                          onClick={handleReset}
                          className="flex-1 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-3"
                        >
                          {locale === 'ar' ? 'إعادة التقاط' : 'Retake'}
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!amount || !date}
                          className={cn(
                            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                            amount && date
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : 'cursor-not-allowed bg-surface-3 text-muted-foreground'
                          )}
                        >
                          <Check className="h-4 w-4" />
                          {tCommon('save')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
