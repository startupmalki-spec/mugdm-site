'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import VendorAutocomplete, { type VendorLite } from './VendorAutocomplete'
import type { BillExtractionResult } from '@/lib/bookkeeper/bill-extraction-types'

// Confidence threshold below which a field is flagged for user review.
const LOW_CONFIDENCE_THRESHOLD = 0.7
// Difference (SAR) above which we flag subtotal+vat != total.
const TOTAL_RECONCILE_TOLERANCE = 0.02

interface Props {
  businessId: string
}

interface LineItemDraft {
  id: string
  description: string
  quantity: string
  unit_price: string
  amount: string
}

interface AttachmentDraft {
  storage_key: string
  filename: string
  mime_type: string | null
  url?: string
}

type Entry = 'choose' | 'ocr' | 'manual'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function emptyLine(): LineItemDraft {
  return { id: uid(), description: '', quantity: '1', unit_price: '', amount: '' }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

export default function AddBillForm({ businessId }: Props) {
  const t = useTranslations('bookkeeper.bills.form')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()

  const [entry, setEntry] = useState<Entry>('choose')
  const [analyzing, setAnalyzing] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<BillExtractionResult | null>(null)

  const [vendor, setVendor] = useState<VendorLite | null>(null)
  const [billNumber, setBillNumber] = useState('')
  const [issueDate, setIssueDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState(defaultDueDate())
  const [vatRate, setVatRate] = useState('15')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLine()])
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Derived totals --------------------------------------------------------
  const { subtotal, vatAmount, total } = useMemo(() => {
    const sub = lineItems.reduce((acc, l) => {
      const amt = Number(l.amount)
      return acc + (Number.isFinite(amt) ? amt : 0)
    }, 0)
    const rate = Number(vatRate)
    const vat = sub * (Number.isFinite(rate) ? rate : 0) / 100
    return {
      subtotal: Math.round(sub * 100) / 100,
      vatAmount: Math.round(vat * 100) / 100,
      total: Math.round((sub + vat) * 100) / 100,
    }
  }, [lineItems, vatRate])

  // Reconciliation banner: compares extracted totals to computed totals when
  // OCR produced a total.
  const reconcileIssue = useMemo(() => {
    if (!extraction?.total || !Number.isFinite(extraction.total)) return null
    const diff = Math.abs(total - extraction.total)
    if (diff > TOTAL_RECONCILE_TOLERANCE) return { computed: total, extracted: extraction.total }
    return null
  }, [total, extraction])

  const lowConfidenceFields = useMemo(() => {
    if (!extraction) return new Set<string>()
    const lo = new Set<string>()
    for (const [k, v] of Object.entries(extraction.confidence || {})) {
      if (typeof v === 'number' && v < LOW_CONFIDENCE_THRESHOLD) lo.add(k)
    }
    return lo
  }, [extraction])

  const isHijriDate = extraction?.language_detected === 'ar'

  // --- OCR ingress -----------------------------------------------------------
  const runOcr = async (file: File) => {
    setAnalyzing(true)
    setOcrError(null)
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const r = reader.result as string
          const b = r.split(',')[1]
          if (!b) return reject(new Error('read'))
          resolve(b)
        }
        reader.onerror = () => reject(new Error('read'))
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/analyze-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mediaType: file.type || 'application/pdf',
          businessId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'OCR failed')
      }
      const result = json as BillExtractionResult
      setExtraction(result)
      // Prefill form fields from extraction.
      if (result.bill_number) setBillNumber(result.bill_number)
      if (result.issue_date) setIssueDate(result.issue_date)
      if (result.due_date) setDueDate(result.due_date)
      if (result.vat_rate != null) setVatRate(String(result.vat_rate))
      if (result.line_items.length > 0) {
        setLineItems(
          result.line_items.map((l) => ({
            id: uid(),
            description: l.description,
            quantity: l.quantity != null ? String(l.quantity) : '1',
            unit_price: l.unit_price != null ? String(l.unit_price) : '',
            amount:
              l.amount != null
                ? String(l.amount)
                : l.quantity != null && l.unit_price != null
                  ? String(l.quantity * l.unit_price)
                  : '',
          })),
        )
      }
      // Also upload the source file as an attachment so it persists with the
      // bill record.
      await uploadFiles([file])
      setEntry('manual')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setOcrError(locale === 'ar' ? 'تعذر تحليل المستند. الرجاء استخدام صورة واضحة.' : msg)
      setEntry('choose')
    } finally {
      setAnalyzing(false)
    }
  }

  // --- Attachment upload -----------------------------------------------------
  const uploadFiles = async (files: File[]) => {
    setUploading(true)
    try {
      const next: AttachmentDraft[] = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('bucket', 'documents')
        fd.append('path', `bills/${businessId}`)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!res.ok) continue
        const json = (await res.json()) as { url?: string; path?: string }
        if (!json.path) continue
        next.push({
          storage_key: json.path,
          filename: file.name,
          mime_type: file.type || null,
          url: json.url,
        })
      }
      setAttachments((prev) => [...prev, ...next])
    } finally {
      setUploading(false)
    }
  }

  // --- Line item helpers -----------------------------------------------------
  const updateLine = (id: string, patch: Partial<LineItemDraft>) => {
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const next = { ...l, ...patch }
        // Auto-derive amount when quantity & unit_price set and amount wasn't
        // explicitly provided in this update.
        if (patch.amount === undefined) {
          const q = Number(next.quantity)
          const u = Number(next.unit_price)
          if (Number.isFinite(q) && Number.isFinite(u) && next.quantity !== '' && next.unit_price !== '') {
            next.amount = String(Math.round(q * u * 100) / 100)
          }
        }
        return next
      }),
    )
  }

  const addLine = () => setLineItems((p) => [...p, emptyLine()])
  const removeLine = (id: string) =>
    setLineItems((p) => (p.length === 1 ? p : p.filter((l) => l.id !== id)))

  // --- Validation ------------------------------------------------------------
  const validationError = useMemo((): string | null => {
    if (!vendor) return t('errors.vendorRequired')
    if (!issueDate) return t('errors.issueDateRequired')
    if (!dueDate) return t('errors.dueDateRequired')
    if (dueDate < issueDate) return t('errors.dueBeforeIssue')
    if (lineItems.length === 0) return t('errors.lineItemRequired')
    for (const l of lineItems) {
      if (!l.description.trim()) return t('errors.lineItemDescription')
      if (!(Number(l.quantity) > 0)) return t('errors.lineItemQuantity')
      const amt = Number(l.amount)
      if (!Number.isFinite(amt) || amt < 0) return t('errors.lineItemAmount')
    }
    if (!(total > 0)) return t('errors.totalPositive')
    return null
  }, [vendor, issueDate, dueDate, lineItems, total, t])

  // --- Submit ----------------------------------------------------------------
  const submit = async (mode: 'draft' | 'submit') => {
    setSubmitError(null)
    if (validationError) {
      setSubmitError(validationError)
      return
    }
    if (!vendor) return
    setSaving(true)
    try {
      const payload = {
        businessId,
        vendor_id: vendor.id,
        bill_number: billNumber.trim() || null,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal,
        vat_amount: vatAmount,
        vat_rate: Number(vatRate) || 0,
        total,
        currency: 'SAR',
        notes: notes.trim() || null,
        line_items: lineItems.map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity) || 1,
          unit_price: Number(l.unit_price) || 0,
          amount: Number(l.amount) || 0,
        })),
        attachments: attachments.map((a) => ({
          storage_key: a.storage_key,
          filename: a.filename,
          mime_type: a.mime_type,
        })),
        submit: mode === 'submit',
      }
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = json?.error
        const msg =
          err && typeof err === 'object'
            ? (locale === 'ar' ? err.ar : err.en) || t('errors.saveFailed')
            : typeof err === 'string'
              ? err
              : t('errors.saveFailed')
        setSubmitError(msg)
        return
      }
      router.push('/bookkeeper/bills')
    } catch {
      setSubmitError(t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // --- UI helpers ------------------------------------------------------------
  const fieldNeedsVerify = (f: string) => lowConfidenceFields.has(f)

  const VerifyHint = ({ field }: { field: string }) =>
    fieldNeedsVerify(field) ? (
      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
        <AlertTriangle className="h-2.5 w-2.5" /> {t('verify')}
      </span>
    ) : null

  // --- Step 0: entry selection ----------------------------------------------
  if (entry === 'choose') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="group relative cursor-pointer rounded-xl border-2 border-dashed border-border bg-surface-1 p-6 text-center transition-colors hover:border-primary/60 hover:bg-surface-2">
            <div className="mx-auto w-fit rounded-2xl bg-primary/10 p-4">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-foreground">
              {t('uploadTitle')}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('uploadSubtitle')}</p>
            <input
              type="file"
              accept="image/*,.pdf"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) runOcr(f)
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => setEntry('manual')}
            className="rounded-xl border-2 border-dashed border-border bg-surface-1 p-6 text-center transition-colors hover:border-primary/60 hover:bg-surface-2"
          >
            <div className="mx-auto w-fit rounded-2xl bg-primary/10 p-4">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-foreground">
              {t('manualTitle')}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('manualSubtitle')}</p>
          </button>
        </div>

        {ocrError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {ocrError}
          </div>
        )}
      </div>
    )
  }

  if (analyzing) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 font-medium text-foreground">{t('analyzing')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('analyzingHint')}</p>
      </div>
    )
  }

  // --- Step 1: form ---------------------------------------------------------
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEntry('choose')
            setExtraction(null)
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {tCommon('back')}
        </button>
      </div>

      {extraction && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            {t('ocrDoneTitle')}{' '}
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(extraction.overall_confidence * 100)}%
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t('ocrDoneHint')}</p>
        </div>
      )}

      {isHijriDate && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{t('confirmHijriDate')}</p>
        </div>
      )}

      {reconcileIssue && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">{t('totalMismatchTitle')}</p>
            <p className="text-xs">
              {t('totalMismatchBody', {
                computed: reconcileIssue.computed.toFixed(2),
                extracted: reconcileIssue.extracted.toFixed(2),
              })}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vendor */}
        <div className="md:col-span-2">
          <label className="mb-1.5 flex items-center text-xs font-medium text-muted-foreground">
            {t('vendor')} <span className="ml-1 text-red-400">*</span>
            <VerifyHint field="vendor_name" />
          </label>
          <VendorAutocomplete
            businessId={businessId}
            value={vendor}
            onChange={setVendor}
            suggestedName={extraction?.vendor_name ?? null}
            suggestedVatNumber={extraction?.vendor_vat_number ?? null}
          />
        </div>

        {/* Bill number */}
        <div>
          <label className="mb-1.5 flex items-center text-xs font-medium text-muted-foreground">
            {t('billNumber')}
            <VerifyHint field="bill_number" />
          </label>
          <input
            type="text"
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground"
          />
        </div>

        {/* VAT rate */}
        <div>
          <label className="mb-1.5 flex items-center text-xs font-medium text-muted-foreground">
            {t('vatRate')}
            <VerifyHint field="vat_rate" />
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 font-mono text-sm text-foreground"
            dir="ltr"
          />
        </div>

        {/* Issue date */}
        <div>
          <label className="mb-1.5 flex items-center text-xs font-medium text-muted-foreground">
            {t('issueDate')} <span className="ml-1 text-red-400">*</span>
            <VerifyHint field="issue_date" />
          </label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground"
            dir="ltr"
          />
        </div>

        {/* Due date */}
        <div>
          <label className="mb-1.5 flex items-center text-xs font-medium text-muted-foreground">
            {t('dueDate')} <span className="ml-1 text-red-400">*</span>
            <VerifyHint field="due_date" />
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground"
            dir="ltr"
          />
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-border bg-surface-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{t('lineItems')}</h2>
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('addLine')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2 text-start font-medium">{t('colDescription')}</th>
                <th className="w-20 pb-2 text-end font-medium">{t('colQty')}</th>
                <th className="w-28 pb-2 text-end font-medium">{t('colUnitPrice')}</th>
                <th className="w-28 pb-2 text-end font-medium">{t('colAmount')}</th>
                <th className="w-10 pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lineItems.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pe-2">
                    <input
                      type="text"
                      value={l.description}
                      onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      placeholder={t('lineDescPlaceholder')}
                      className="w-full rounded-md border border-border bg-surface-0 px-2 py-1.5 text-sm text-foreground"
                    />
                  </td>
                  <td className="py-2 pe-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.id, { quantity: e.target.value })}
                      className="w-full rounded-md border border-border bg-surface-0 px-2 py-1.5 text-end font-mono text-sm text-foreground"
                      dir="ltr"
                    />
                  </td>
                  <td className="py-2 pe-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={l.unit_price}
                      onChange={(e) => updateLine(l.id, { unit_price: e.target.value })}
                      className="w-full rounded-md border border-border bg-surface-0 px-2 py-1.5 text-end font-mono text-sm text-foreground"
                      dir="ltr"
                    />
                  </td>
                  <td className="py-2 pe-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={l.amount}
                      onChange={(e) => updateLine(l.id, { amount: e.target.value })}
                      className="w-full rounded-md border border-border bg-surface-0 px-2 py-1.5 text-end font-mono text-sm text-foreground"
                      dir="ltr"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeLine(l.id)}
                      disabled={lineItems.length === 1}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-red-500 disabled:opacity-40"
                      aria-label={tCommon('delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <div className="flex w-56 justify-between">
            <span className="text-muted-foreground">{t('subtotal')}</span>
            <span className="font-mono text-foreground">{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex w-56 justify-between">
            <span className="text-muted-foreground">
              {t('vat')} ({vatRate}%)
            </span>
            <span className="font-mono text-foreground">{vatAmount.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex w-56 justify-between border-t border-border pt-1">
            <span className="font-semibold text-foreground">{t('total')}</span>
            <span className="font-mono font-semibold text-foreground">{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t('notes')}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-foreground"
        />
      </div>

      {/* Attachments */}
      <div className="rounded-xl border border-border bg-surface-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{t('attachments')}</h2>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-3 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {t('addAttachment')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length > 0) uploadFiles(files)
              e.target.value = ''
            }}
          />
        </div>
        {attachments.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('noAttachments')}</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((a, i) => (
              <li
                key={`${a.storage_key}-${i}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 truncate text-foreground">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {a.filename}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachments((p) => p.filter((_, idx) => idx !== i))}
                  className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-red-500"
                  aria-label={tCommon('delete')}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Error + actions */}
      {submitError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {submitError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/bookkeeper/bills')}
          disabled={saving}
          className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-3 disabled:opacity-60"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="button"
          onClick={() => submit('draft')}
          disabled={saving}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-3 disabled:opacity-60',
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {t('saveDraft')}
        </button>
        <button
          type="button"
          onClick={() => submit('submit')}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t('saveAndSubmit')}
        </button>
      </div>
    </div>
  )
}
