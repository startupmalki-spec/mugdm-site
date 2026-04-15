'use client'

/**
 * Bulk bill upload — P1 of Bookkeeper Depth PRD.
 *
 * User drops up to 20 files (PDF or image, each ≤10MB). For each file we:
 *   1. Upload it as an attachment via /api/upload
 *   2. Run OCR via /api/analyze-bill
 *   3. Let the user pick/create a vendor inline, adjust dates + VAT
 *   4. On "Save All" — POST each row to /api/bills as a draft
 *
 * Concurrency: OCR runs STRICTLY SERIAL (one file at a time). Claude Vision
 * and Anthropic rate limits make parallelism unsafe for small accounts, and
 * our rate-limit middleware counts each call. A 429 response pauses the
 * queue for the resetAt delay before continuing.
 *
 * The "Edit" button opens a modal that embeds AddBillForm pre-filled for
 * that single file — note that saving from AddBillForm navigates away, so
 * we warn the user they will leave this page.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter, Link } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import VendorAutocomplete, { type VendorLite } from './VendorAutocomplete'
import AddBillForm from './AddBillForm'
import type { BillExtractionResult } from '@/lib/bookkeeper/bill-extraction-types'

const MAX_FILES = 20
const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']

type RowStatus =
  | 'queued'
  | 'uploading'
  | 'ocr'
  | 'ready'
  | 'saving'
  | 'saved'
  | 'error'

interface Attachment {
  storage_key: string
  filename: string
  mime_type: string | null
}

interface Row {
  id: string
  file: File
  status: RowStatus
  error: string | null
  extraction: BillExtractionResult | null
  attachment: Attachment | null
  // Editable fields (seeded from extraction).
  vendor: VendorLite | null
  billNumber: string
  issueDate: string
  dueDate: string
  vatRate: string
  savedBillId: string | null
}

interface Props {
  businessId: string
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function plus30(from?: string | null) {
  const base = from ? new Date(from) : new Date()
  if (Number.isNaN(base.getTime())) return todayIso()
  base.setDate(base.getDate() + 30)
  return base.toISOString().slice(0, 10)
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
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
}

export default function BulkBillUpload({ businessId }: Props) {
  const t = useTranslations('bookkeeper.bills.bulk')
  const tBills = useTranslations('bookkeeper.bills')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()

  const [rows, setRows] = useState<Row[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [editRowId, setEditRowId] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateRow = useCallback((id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  /**
   * Processes the queue sequentially. On 429 the caller returns a
   * `retryAfterMs` and we sleep that long before continuing.
   */
  const processQueue = useCallback(
    async (queuedRows: Row[]) => {
      setIsProcessing(true)
      for (const r of queuedRows) {
        // Upload attachment first.
        updateRow(r.id, { status: 'uploading', error: null })
        let attachment: Attachment | null = null
        try {
          const fd = new FormData()
          fd.append('file', r.file)
          fd.append('bucket', 'documents')
          fd.append('path', `bills/${businessId}`)
          const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
          if (upRes.ok) {
            const j = (await upRes.json()) as { path?: string }
            if (j.path) {
              attachment = {
                storage_key: j.path,
                filename: r.file.name,
                mime_type: r.file.type || null,
              }
            }
          }
        } catch {
          // non-fatal; continue to OCR without attachment
        }

        // Run OCR with a retry-on-429 loop (up to 2 retries).
        updateRow(r.id, { status: 'ocr', attachment })
        let extraction: BillExtractionResult | null = null
        let errorMessage: string | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const base64Data = await fileToBase64(r.file)
            const res = await fetch('/api/analyze-bill', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                base64Data,
                mediaType: r.file.type || 'application/pdf',
                businessId,
              }),
            })
            if (res.status === 429) {
              const j = (await res.json().catch(() => ({}))) as { resetAt?: number }
              const waitMs = Math.max(
                1000,
                Math.min(30_000, (j.resetAt ?? Date.now() + 5000) - Date.now()),
              )
              await new Promise((resolve) => setTimeout(resolve, waitMs))
              continue
            }
            const json = await res.json()
            if (!res.ok) {
              errorMessage =
                typeof json.error === 'string' ? json.error : t('errors.ocrFailed')
              break
            }
            extraction = json as BillExtractionResult
            errorMessage = null
            break
          } catch (err) {
            errorMessage = err instanceof Error ? err.message : t('errors.ocrFailed')
          }
        }

        if (!extraction) {
          updateRow(r.id, {
            status: 'error',
            error: errorMessage ?? t('errors.ocrFailed'),
          })
          continue
        }

        updateRow(r.id, {
          status: 'ready',
          extraction,
          error: null,
          billNumber: extraction.bill_number ?? '',
          issueDate: extraction.issue_date ?? todayIso(),
          dueDate: extraction.due_date ?? plus30(extraction.issue_date),
          vatRate:
            extraction.vat_rate != null && Number.isFinite(extraction.vat_rate)
              ? String(extraction.vat_rate)
              : '15',
        })
      }
      setIsProcessing(false)
    },
    [businessId, t, updateRow],
  )

  const addFiles = useCallback(
    (incoming: File[]) => {
      setGlobalError(null)
      const slotsLeft = MAX_FILES - rows.length
      if (slotsLeft <= 0) {
        setGlobalError(t('errors.maxFiles', { max: MAX_FILES }))
        return
      }
      const filtered: File[] = []
      for (const f of incoming) {
        if (filtered.length >= slotsLeft) break
        if (!ACCEPTED.includes(f.type) && !f.name.toLowerCase().endsWith('.pdf')) {
          continue
        }
        if (f.size > MAX_BYTES) {
          setGlobalError(t('errors.tooLarge', { name: f.name }))
          continue
        }
        filtered.push(f)
      }
      if (filtered.length === 0) return

      const newRows: Row[] = filtered.map((f) => ({
        id: uid(),
        file: f,
        status: 'queued',
        error: null,
        extraction: null,
        attachment: null,
        vendor: null,
        billNumber: '',
        issueDate: todayIso(),
        dueDate: plus30(),
        vatRate: '15',
        savedBillId: null,
      }))
      setRows((prev) => [...prev, ...newRows])

      // Kick the queue (serial).
      if (!isProcessing) {
        void processQueue(newRows)
      }
    },
    [rows.length, isProcessing, processQueue, t],
  )

  const removeRow = (id: string) => setRows((p) => p.filter((r) => r.id !== id))

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addFiles(files)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) addFiles(files)
  }

  const savableRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.status === 'ready' &&
          r.vendor !== null &&
          r.extraction &&
          typeof r.extraction.total === 'number' &&
          r.extraction.total > 0 &&
          typeof r.extraction.subtotal === 'number',
      ),
    [rows],
  )

  const saveAll = async () => {
    if (savableRows.length === 0) return
    setSavingAll(true)
    setGlobalError(null)
    try {
      for (const r of savableRows) {
        updateRow(r.id, { status: 'saving', error: null })
        const ex = r.extraction!
        const subtotal = Number(ex.subtotal) || 0
        const total = Number(ex.total) || 0
        // vat_amount = total - subtotal so subtotal + vat == total exactly.
        const vat_amount = Math.round((total - subtotal) * 100) / 100
        const vat_rate = Number(r.vatRate) || 0

        const line_items =
          ex.line_items.length > 0
            ? ex.line_items.map((l) => ({
                description: l.description,
                quantity: l.quantity ?? 1,
                unit_price: l.unit_price ?? 0,
                amount:
                  l.amount ??
                  (l.quantity != null && l.unit_price != null ? l.quantity * l.unit_price : 0),
              }))
            : [
                {
                  description: ex.vendor_name ?? r.file.name,
                  quantity: 1,
                  unit_price: subtotal,
                  amount: subtotal,
                },
              ]

        const payload = {
          businessId,
          vendor_id: r.vendor!.id,
          bill_number: r.billNumber.trim() || null,
          issue_date: r.issueDate,
          due_date: r.dueDate,
          subtotal,
          vat_amount,
          vat_rate,
          total,
          currency: ex.currency || 'SAR',
          notes: null,
          line_items,
          attachments: r.attachment ? [r.attachment] : [],
          submit: false,
        }

        try {
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
            updateRow(r.id, { status: 'error', error: msg })
            continue
          }
          const billId = (json?.bill?.id as string | undefined) ?? null
          updateRow(r.id, { status: 'saved', savedBillId: billId, error: null })
        } catch {
          updateRow(r.id, { status: 'error', error: t('errors.saveFailed') })
        }
      }
    } finally {
      setSavingAll(false)
    }
  }

  const totalSaved = rows.filter((r) => r.status === 'saved').length
  const allDone =
    rows.length > 0 && rows.every((r) => r.status === 'saved' || r.status === 'error')

  const editRow = rows.find((r) => r.id === editRowId) ?? null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/bookkeeper/bills"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {tBills('backToBookkeeper')}
        </Link>
      </div>

      {/* Dropzone */}
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary/10'
            : 'border-border bg-surface-1 hover:border-primary/60 hover:bg-surface-2',
        )}
      >
        <div className="rounded-2xl bg-primary/10 p-4">
          <Upload className="h-7 w-7 text-primary" />
        </div>
        <h2 className="mt-3 text-base font-semibold text-foreground">{t('dropTitle')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('dropHint', { max: MAX_FILES })}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,application/pdf"
          className="sr-only"
          onChange={onFileInput}
        />
      </label>

      {globalError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Rows */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-1">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-semibold text-foreground">
              {t('queueTitle', { count: rows.length })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('queueProgress', { saved: totalSaved, total: rows.length })}
            </div>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <BulkRow
                key={r.id}
                row={r}
                businessId={businessId}
                locale={locale}
                onRemove={() => removeRow(r.id)}
                onEdit={() => setEditRowId(r.id)}
                onVendorChange={(v) => updateRow(r.id, { vendor: v })}
                onFieldChange={(patch) => updateRow(r.id, patch)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setRows([])}
            disabled={isProcessing || savingAll}
            className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-3 disabled:opacity-60"
          >
            {t('clearAll')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (allDone) router.push('/bookkeeper/bills')
              else void saveAll()
            }}
            disabled={
              (!allDone && savableRows.length === 0) || isProcessing || savingAll
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {savingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {allDone
              ? t('done')
              : t('saveAll', { count: savableRows.length })}
          </button>
        </div>
      )}

      {/* Edit modal — embeds single-file AddBillForm */}
      {editRow && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setEditRowId(null)}
        >
          <div
            className="relative my-8 w-full max-w-4xl rounded-xl border border-border bg-surface-0 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEditRowId(null)}
              className="absolute top-3 rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground ltr:right-3 rtl:left-3"
              aria-label={tCommon('close')}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-600">
              {t('editWarn')}
            </div>
            <AddBillForm businessId={businessId} />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface BulkRowProps {
  row: Row
  businessId: string
  locale: string
  onRemove: () => void
  onEdit: () => void
  onVendorChange: (v: VendorLite | null) => void
  onFieldChange: (patch: Partial<Row>) => void
}

function BulkRow({
  row,
  businessId,
  locale,
  onRemove,
  onEdit,
  onVendorChange,
  onFieldChange,
}: BulkRowProps) {
  const t = useTranslations('bookkeeper.bills.bulk')
  const tCommon = useTranslations('common')

  const statusLabel = (() => {
    switch (row.status) {
      case 'queued':
        return t('status.queued')
      case 'uploading':
        return t('status.uploading')
      case 'ocr':
        return t('status.ocr')
      case 'ready':
        return t('status.ready')
      case 'saving':
        return t('status.saving')
      case 'saved':
        return t('status.saved')
      case 'error':
        return t('status.error')
    }
  })()

  const busy =
    row.status === 'queued' ||
    row.status === 'uploading' ||
    row.status === 'ocr' ||
    row.status === 'saving'

  const ex = row.extraction

  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground" title={row.file.name}>
            {row.file.name}
          </span>
          <span className="text-xs text-muted-foreground" dir="ltr">
            {(row.file.size / 1024).toFixed(0)} KB
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              row.status === 'saved' && 'bg-emerald-500/15 text-emerald-500',
              row.status === 'error' && 'bg-red-500/15 text-red-500',
              row.status === 'ready' && 'bg-primary/15 text-primary',
              busy && 'bg-muted text-muted-foreground',
            )}
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}
            {row.status === 'saved' && <Check className="h-3 w-3" />}
            {row.status === 'error' && <AlertTriangle className="h-3 w-3" />}
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-red-500 disabled:opacity-40"
            aria-label={tCommon('delete')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {row.error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
          {row.error}
        </div>
      )}

      {ex && (row.status === 'ready' || row.status === 'saving' || row.status === 'error') && (
        <div className="grid gap-3 rounded-lg border border-border bg-surface-0 p-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t('fields.vendor')}
            </label>
            <VendorAutocomplete
              businessId={businessId}
              value={row.vendor}
              onChange={onVendorChange}
              suggestedName={ex.vendor_name ?? null}
              suggestedVatNumber={ex.vendor_vat_number ?? null}
              disabled={row.status === 'saving'}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t('fields.billNumber')}
            </label>
            <input
              type="text"
              value={row.billNumber}
              onChange={(e) => onFieldChange({ billNumber: e.target.value })}
              className="w-full rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t('fields.total')}
            </label>
            <div className="rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm font-mono text-foreground" dir="ltr">
              {typeof ex.total === 'number' ? ex.total.toFixed(2) : '—'} {ex.currency || 'SAR'}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t('fields.issueDate')}
            </label>
            <input
              type="date"
              value={row.issueDate}
              onChange={(e) => onFieldChange({ issueDate: e.target.value })}
              className="w-full rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t('fields.dueDate')}
            </label>
            <input
              type="date"
              value={row.dueDate}
              onChange={(e) => onFieldChange({ dueDate: e.target.value })}
              className="w-full rounded-md border border-border bg-surface-1 px-2 py-1.5 text-sm text-foreground"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              {t('fields.vatRate')}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={row.vatRate}
              onChange={(e) => onFieldChange({ vatRate: e.target.value })}
              className="w-full rounded-md border border-border bg-surface-1 px-2 py-1.5 font-mono text-sm text-foreground"
              dir="ltr"
            />
          </div>
          <div className="flex items-end justify-end md:col-span-4">
            <button
              type="button"
              onClick={onEdit}
              disabled={row.status === 'saving'}
              className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-3 disabled:opacity-60"
            >
              {t('openFullEditor')}
            </button>
          </div>

          {ex.line_items.length > 0 && (
            <div className="md:col-span-4">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {t('fields.lineItems', { count: ex.line_items.length })}
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                {ex.line_items.slice(0, 3).map((l, i) => (
                  <li key={i} className="truncate">
                    — {l.description}
                    {l.amount != null && (
                      <span className="font-mono" dir="ltr">
                        {' '}
                        ({l.amount.toFixed(2)})
                      </span>
                    )}
                  </li>
                ))}
                {ex.line_items.length > 3 && (
                  <li>{t('fields.moreLineItems', { count: ex.line_items.length - 3 })}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
