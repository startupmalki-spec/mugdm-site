'use client'

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Upload,
  Loader2,
  Landmark,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDemoTransactionsForUpload, SAUDI_BANKS } from '@/lib/bookkeeper/demo-data'
import { ReviewQueue } from '@/components/bookkeeper/ReviewQueue'
import type { Transaction, TransactionCategory } from '@/lib/supabase/types'

type UploadStep = 'select' | 'processing' | 'review'
type FileFormat = 'csv' | 'pdf'

const MAX_FILE_SIZE = 25 * 1024 * 1024

export default function UploadStatementPage() {
  const t = useTranslations('bookkeeper.upload')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isRtl = locale === 'ar'

  const [step, setStep] = useState<UploadStep>('select')
  const [selectedFormat, setSelectedFormat] = useState<FileFormat | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [detectedBank, setDetectedBank] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileDrop = useCallback((format: FileFormat) => (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setSelectedFormat(format)
    setFileName(file.name)
    setStep('processing')
    setProgress(0)
    setError(null)

    const isPdf = format === 'pdf'
    const pages = isPdf ? Math.floor(Math.random() * 8) + 3 : 0
    setTotalPages(pages)

    // Simulate processing progress
    let currentProgress = 0
    let page = 0
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5

      if (isPdf && currentProgress > ((page + 1) / pages) * 100) {
        page++
        setCurrentPage(Math.min(page, pages))
      }

      if (currentProgress >= 100) {
        clearInterval(interval)
        setProgress(100)

        // Pick a random Saudi bank as "detected"
        const bankIndex = Math.floor(Math.random() * SAUDI_BANKS.length)
        setDetectedBank(SAUDI_BANKS[bankIndex].id)

        // Generate mock parsed transactions
        const demoTx = getDemoTransactionsForUpload()
        setTransactions(demoTx)

        setTimeout(() => setStep('review'), 500)
      } else {
        setProgress(Math.min(currentProgress, 99))
      }
    }, 300)
  }, [])

  const csvDropzone = useDropzone({
    onDrop: handleFileDrop('csv'),
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls', '.xlsx'] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    noClick: false,
    onDropRejected: () => setError(locale === 'ar' ? 'صيغة الملف غير مدعومة' : 'Unsupported file format'),
  })

  const pdfDropzone = useDropzone({
    onDrop: handleFileDrop('pdf'),
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    noClick: false,
    onDropRejected: () => setError(locale === 'ar' ? 'صيغة الملف غير مدعومة' : 'Unsupported file format'),
  })

  const handleAcceptTransactions = useCallback((ids: string[]) => {
    setTransactions((prev) =>
      prev.map((tx) => (ids.includes(tx.id) ? { ...tx, is_reviewed: true } : tx))
    )
  }, [])

  const handleChangeCategory = useCallback((id: string, category: TransactionCategory) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, category } : tx))
    )
  }, [])

  const BackArrow = isRtl ? ArrowRight : ArrowLeft

  const bank = detectedBank ? SAUDI_BANKS.find((b) => b.id === detectedBank) : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back Link + Title */}
      <div>
        <Link
          href="/bookkeeper"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <BackArrow className="h-4 w-4" />
          {tCommon('back')}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: File Selection */}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {/* CSV Card */}
              <div
                {...csvDropzone.getRootProps()}
                className={cn(
                  'group cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all',
                  csvDropzone.isDragActive
                    ? 'border-green-500 bg-green-500/5 scale-[1.02]'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-surface-2'
                )}
              >
                <input {...csvDropzone.getInputProps()} />
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 transition-transform group-hover:scale-110">
                  <FileSpreadsheet className="h-7 w-7 text-green-400" />
                </div>
                <p className="text-base font-semibold text-foreground">
                  {locale === 'ar' ? 'رفع CSV' : 'Upload CSV'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {locale === 'ar' ? 'CSV, XLS, XLSX' : 'CSV, XLS, XLSX'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {locale === 'ar' ? 'الحد الأقصى 25 ميجابايت' : 'Max 25MB'}
                </p>
              </div>

              {/* PDF Card */}
              <div
                {...pdfDropzone.getRootProps()}
                className={cn(
                  'group cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all',
                  pdfDropzone.isDragActive
                    ? 'border-blue-500 bg-blue-500/5 scale-[1.02]'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-surface-2'
                )}
              >
                <input {...pdfDropzone.getInputProps()} />
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 transition-transform group-hover:scale-110">
                  <FileText className="h-7 w-7 text-blue-400" />
                </div>
                <p className="text-base font-semibold text-foreground">
                  {locale === 'ar' ? 'رفع PDF' : 'Upload PDF'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {locale === 'ar' ? 'كشف حساب بصيغة PDF' : 'Bank statement PDF'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {locale === 'ar' ? 'الحد الأقصى 25 ميجابايت' : 'Max 25MB'}
                </p>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-xl border border-border bg-card p-12"
          >
            <div className="flex flex-col items-center gap-6">
              {/* Animated Bank Icon */}
              <motion.div
                className="relative"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="rounded-2xl bg-primary/10 p-5">
                  <Landmark className="h-10 w-10 text-primary" />
                </div>
                <motion.div
                  className="absolute -bottom-1 -right-1 rounded-full bg-card p-1"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </motion.div>
              </motion.div>

              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  {locale === 'ar' ? 'جارٍ تحليل كشف الحساب...' : 'Analyzing your bank statement...'}
                </p>
                {selectedFormat === 'pdf' && totalPages > 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {locale === 'ar'
                      ? `معالجة الصفحة ${currentPage} من ${totalPages}...`
                      : `Processing page ${currentPage} of ${totalPages}...`}
                  </p>
                )}
                {fileName && (
                  <p className="mt-1 text-xs text-muted-foreground/60" dir="ltr">
                    {fileName}
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-sm">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="mt-2 text-center text-sm tabular-nums text-muted-foreground">
                  {Math.round(progress)}%
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Detection Summary */}
            <div className="flex flex-col gap-4 rounded-xl border border-green-500/20 bg-green-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-500/10 p-2.5">
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {locale === 'ar' ? 'تم التحليل بنجاح' : 'Analysis Complete'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {bank && (
                      <span>
                        {isRtl ? bank.nameAr : bank.nameEn}
                        {' · '}
                      </span>
                    )}
                    {locale === 'ar'
                      ? `تم العثور على ${transactions.length} عملية`
                      : `Found ${transactions.length} transactions`}
                  </p>
                </div>
              </div>

              {/* Bank selector override */}
              <select
                value={detectedBank ?? ''}
                onChange={(e) => setDetectedBank(e.target.value)}
                className="h-9 rounded-lg border border-border bg-surface-1 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {SAUDI_BANKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isRtl ? b.nameAr : b.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Review Queue */}
            <ReviewQueue
              transactions={transactions}
              onAccept={handleAcceptTransactions}
              onChangeCategory={handleChangeCategory}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
