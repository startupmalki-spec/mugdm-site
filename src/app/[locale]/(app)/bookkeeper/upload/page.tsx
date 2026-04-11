'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SAUDI_BANKS } from '@/lib/bookkeeper/demo-data'
import { ReviewQueue } from '@/components/bookkeeper/ReviewQueue'
import { createClient } from '@/lib/supabase/client'
import type { Transaction, TransactionCategory, TransactionSource } from '@/lib/supabase/types'

type UploadStep = 'select' | 'processing' | 'review'
type FileFormat = 'csv' | 'pdf'

const MAX_FILE_SIZE = 25 * 1024 * 1024

interface ParsedTransaction {
  date: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  description: string
  vendor_or_client: string | null
  category: TransactionCategory
  ai_confidence: number
}

interface ParseStatementResponse {
  transactions: ParsedTransaction[]
  period_start: string | null
  period_end: string | null
  total_rows_parsed: number
}

export default function UploadStatementPage() {
  const t = useTranslations('bookkeeper.upload')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isRtl = locale === 'ar'

  const [step, setStep] = useState<UploadStep>('select')
  const [selectedFormat, setSelectedFormat] = useState<FileFormat | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [detectedBank, setDetectedBank] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [uploadRecordId, setUploadRecordId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .single()
        .then(({ data: biz }) => {
          if (biz) setBusinessId((biz as { id: string }).id)
        })
    })
  }, [])

  const startFakeProgress = useCallback(() => {
    let current = 0
    progressIntervalRef.current = setInterval(() => {
      current += Math.random() * 8 + 2
      if (current >= 90) {
        current = 90
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      }
      setProgress(Math.round(current))
    }, 400)
  }, [])

  const stopFakeProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    setProgress(100)
  }, [])

  const handleFileDrop = useCallback((format: FileFormat) => async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setSelectedFormat(format)
    setFileName(file.name)
    setStep('processing')
    setProgress(0)
    setError(null)
    setSaveError(null)
    setSavedCount(null)
    setUploadRecordId(null)
    setTransactions([])

    startFakeProgress()

    try {
      const supabase = createClient()
      let csvContent = ''
      let fileUrl = ''

      if (format === 'pdf') {
        const storagePath = `${businessId ?? 'anon'}/${Date.now()}.pdf`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(uploadData.path)
        fileUrl = publicUrlData.publicUrl

        // Read PDF bytes as latin1 text so Claude can attempt to extract text rows
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        csvContent = String.fromCharCode(...bytes.slice(0, 60_000))
      } else {
        csvContent = await file.text()
        fileUrl = ''
      }

      // Create bank_statement_uploads record
      let uploadId: string | null = null
      if (businessId) {
        const bankName = detectedBank
          ? (SAUDI_BANKS.find((b) => b.id === detectedBank)?.nameEn ?? 'Unknown')
          : 'Unknown'

        const { data: uploadRecord } = await (supabase.from('bank_statement_uploads') as any)
          .insert({
            business_id: businessId,
            bank_name: bankName,
            file_url: fileUrl,
            file_type: format === 'pdf' ? 'PDF' : 'CSV',
            status: 'PROCESSING',
            period_start: null,
            period_end: null,
            transaction_count: null,
            error_message: null,
          })
          .select('id')
          .single() as { data: { id: string } | null; error: unknown }

        if (uploadRecord) {
          uploadId = (uploadRecord as { id: string }).id
          setUploadRecordId(uploadId)
        }
      }

      // Call real Claude AI API
      const response = await fetch('/api/parse-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, bankName: undefined }),
      })

      const result = (await response.json()) as ParseStatementResponse

      stopFakeProgress()

      // Detect bank from first transaction vendor hints (keep user-selectable)
      if (!detectedBank) {
        setDetectedBank(SAUDI_BANKS[0].id)
      }

      // Shape parsed transactions into local Transaction objects (no DB ids yet)
      const source: TransactionSource = format === 'pdf' ? 'BANK_STATEMENT_PDF' : 'BANK_STATEMENT_CSV'
      const shaped: Transaction[] = result.transactions.map((tx, i) => ({
        id: `pending-${i}`,
        business_id: businessId ?? '',
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.description,
        vendor_or_client: tx.vendor_or_client,
        source,
        source_file_id: uploadId,
        receipt_url: null,
        linked_obligation_id: null,
        vat_amount: null,
        ai_confidence: tx.ai_confidence,
        is_reviewed: false,
        created_at: new Date().toISOString(),
      }))

      setTransactions(shaped)

      // Update upload record to REVIEW_PENDING
      if (uploadId && businessId) {
        await (supabase.from('bank_statement_uploads') as any)
          .update({
            status: 'REVIEW_PENDING',
            period_start: result.period_start,
            period_end: result.period_end,
            transaction_count: result.transactions.length,
          })
          .eq('id', uploadId)
      }

      setTimeout(() => setStep('review'), 400)
    } catch {
      stopFakeProgress()
      setError(
        locale === 'ar'
          ? 'حدث خطأ أثناء معالجة الملف. حاول مرة أخرى.'
          : 'Error processing file. Please try again.'
      )
      setStep('select')
    }
  }, [businessId, detectedBank, locale, startFakeProgress, stopFakeProgress])

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

  const handleSaveAll = useCallback(async () => {
    if (!businessId) return
    const accepted = transactions.filter((tx) => tx.is_reviewed)
    if (accepted.length === 0) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const supabase = createClient()
      const rows = accepted.map((tx) => ({
        business_id: businessId,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.description,
        vendor_or_client: tx.vendor_or_client,
        source: tx.source,
        source_file_id: uploadRecordId,
        receipt_url: null,
        linked_obligation_id: null,
        vat_amount: tx.vat_amount,
        ai_confidence: tx.ai_confidence,
        is_reviewed: true,
      }))

      const { error: insertError } = await (supabase.from('transactions') as any)
        .insert(rows) as { error: unknown }

      if (insertError) throw insertError

      if (uploadRecordId) {
        await (supabase.from('bank_statement_uploads') as any)
          .update({ status: 'COMPLETED' })
          .eq('id', uploadRecordId)
      }

      setSavedCount(accepted.length)
    } catch {
      setSaveError(
        locale === 'ar'
          ? 'فشل الحفظ. حاول مرة أخرى.'
          : 'Save failed. Please try again.'
      )
    } finally {
      setIsSaving(false)
    }
  }, [businessId, transactions, uploadRecordId, locale])

  const BackArrow = isRtl ? ArrowRight : ArrowLeft
  const bank = detectedBank ? SAUDI_BANKS.find((b) => b.id === detectedBank) : null
  const acceptedCount = transactions.filter((tx) => tx.is_reviewed).length

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

            {/* Save All Reviewed */}
            {acceptedCount > 0 && savedCount === null && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <p className="text-sm text-muted-foreground">
                  {locale === 'ar'
                    ? `${acceptedCount} عملية جاهزة للحفظ`
                    : `${acceptedCount} transaction${acceptedCount !== 1 ? 's' : ''} ready to save`}
                </p>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSaving || !businessId}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {locale === 'ar' ? 'حفظ المراجَعة' : 'Save All Reviewed'}
                </button>
              </motion.div>
            )}

            {/* Save Error */}
            {saveError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {saveError}
              </motion.div>
            )}

            {/* Save Success */}
            {savedCount !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-400"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {locale === 'ar'
                  ? `تم حفظ ${savedCount} عملية بنجاح`
                  : `${savedCount} transaction${savedCount !== 1 ? 's' : ''} saved successfully`}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
