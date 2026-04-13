'use client'

/**
 * New simplified (B2C) invoice page — Task 59.
 *
 * Mirrors the B2B standard flow (`new/page.tsx`) but with three key deltas:
 *   1. Buyer section is minimal and optional — only `buyer_name` and an
 *      optional `buyer_vat`. If left blank the UI falls back to a bilingual
 *      "walk-in customer" label. These fields are NOT yet persisted (schema
 *      has no ad-hoc buyer columns and customer_id is nullable); they are
 *      displayed in the preview/receipt only. See follow-ups in task notes.
 *   2. Primary action is "Report to ZATCA" — the POST creates the draft with
 *      `invoice_type: 'simplified'`, then the submit route branches on the
 *      type and calls `reportInvoice` instead of `clearInvoice`.
 *   3. On success we render an on-screen receipt (QR PNG + totals + print).
 *      No redirect to the invoice detail page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Eye, Loader2, Printer, Save, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useBusiness } from '@/lib/business-context'
import { calculateInvoiceTotals } from '@/lib/invoicing/calculations'
import { generateQrCodeImage } from '@/lib/zatca/qr-code'
import type { Customer } from '@/lib/supabase/types'

import {
  LineItemsTable,
  EMPTY_LINE,
  type EditableLineItem,
} from '@/components/invoicing/LineItemsTable'
import { InvoiceTotals } from '@/components/invoicing/InvoiceTotals'
import { InvoicePreview } from '@/components/invoicing/InvoicePreview'

const AUTOSAVE_INTERVAL_MS = 30_000

interface FormState {
  buyer_name: string
  buyer_vat: string
  issue_date: string
  supply_date: string
  notes: string
  lineItems: EditableLineItem[]
  savedAt: number
}

interface ReceiptState {
  invoiceId: string
  invoiceNumber: string
  qrImage: string
  buyerName: string
  issueDate: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function makeDefaults(): FormState {
  return {
    buyer_name: '',
    buyer_vat: '',
    issue_date: todayIso(),
    supply_date: '',
    notes: '',
    lineItems: [{ ...EMPTY_LINE, line_number: 1 }],
    savedAt: 0,
  }
}

export default function NewSimplifiedInvoicePage() {
  const t = useTranslations('invoicing.invoices')
  const tS = useTranslations('invoicing.invoices.simplified')
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const loc: 'ar' | 'en' = locale === 'ar' ? 'ar' : 'en'
  const { businessId, currentBusiness } = useBusiness()

  const [form, setForm] = useState<FormState>(() => makeDefaults())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'save' | 'submit'>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptState | null>(null)
  const mountedRef = useRef(false)

  const storageKey = businessId
    ? `invoice-draft-simplified-${businessId}`
    : null

  // Restore draft from localStorage.
  useEffect(() => {
    if (!storageKey || mountedRef.current) return
    mountedRef.current = true
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as FormState
      if (parsed && typeof parsed === 'object' && parsed.savedAt > 0) {
        setForm(parsed)
      }
    } catch {
      // ignore
    }
  }, [storageKey])

  // Auto-save.
  useEffect(() => {
    if (!storageKey) return
    const id = window.setInterval(() => {
      try {
        const snapshot: FormState = { ...form, savedAt: Date.now() }
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot))
      } catch {
        // ignore
      }
    }, AUTOSAVE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [form, storageKey])

  const totals = useMemo(
    () => calculateInvoiceTotals(form.lineItems),
    [form.lineItems],
  )

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function clearLocalDraft() {
    if (!storageKey) return
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }

  const effectiveBuyerName = form.buyer_name.trim() || tS('walkInCustomer')

  // Synthesize a minimal Customer-shaped object so InvoicePreview (which
  // expects Customer | null) can render the walk-in/anonymous buyer.
  const previewCustomer = useMemo<Customer | null>(() => {
    if (!form.buyer_name.trim() && !form.buyer_vat.trim()) return null
    return {
      id: 'simplified-placeholder',
      business_id: businessId ?? '',
      name: effectiveBuyerName,
      name_en: null,
      vat_number: form.buyer_vat.trim() || null,
      cr_number: null,
      address: null,
      city: null,
      country: null,
      phone: null,
      email: null,
      created_at: '',
      updated_at: '',
    }
  }, [form.buyer_name, form.buyer_vat, businessId, effectiveBuyerName])

  async function postInvoice(): Promise<{
    id: string
    invoiceNumber: string
  } | null> {
    if (!businessId) {
      setError(t('errors.noBusiness'))
      return null
    }
    if (form.lineItems.length === 0) {
      setError(t('errors.noLines'))
      return null
    }

    // Buyer name/VAT aren't persisted in the invoices table today — we stash
    // them as a short prefix in `notes` so they're visible on the detail page
    // until a proper ad-hoc buyer column is added.
    const buyerAnnotation =
      form.buyer_name.trim() || form.buyer_vat.trim()
        ? `[${effectiveBuyerName}${
            form.buyer_vat.trim() ? ` | VAT ${form.buyer_vat.trim()}` : ''
          }]`
        : null
    const composedNotes = [buyerAnnotation, form.notes.trim() || null]
      .filter(Boolean)
      .join('\n')

    const res = await fetch('/api/invoicing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        invoice: {
          customer_id: null,
          invoice_type: 'simplified',
          invoice_subtype: 'invoice',
          language: 'both',
          issue_date: form.issue_date,
          supply_date: form.supply_date || null,
          due_date: null,
          payment_terms: null,
          notes: composedNotes || null,
        },
        lineItems: form.lineItems.map((l, i) => ({
          line_number: i + 1,
          description: l.description_en
            ? `${l.description}${l.description ? ' / ' : ''}${l.description_en}`
            : l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_amount: l.discount_amount || null,
          vat_rate: l.vat_rate,
        })),
      }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      invoiceId?: string
      invoiceNumber?: string
      error?: { ar?: string; en?: string }
    }
    if (!res.ok || !body.invoiceId) {
      const err = body.error
      setError((loc === 'ar' ? err?.ar : err?.en) ?? t('errors.saveFailed'))
      return null
    }
    return {
      id: body.invoiceId,
      invoiceNumber: body.invoiceNumber ?? '',
    }
  }

  async function handleSaveDraft() {
    setError(null)
    setBusy('save')
    try {
      const created = await postInvoice()
      if (created) {
        clearLocalDraft()
        router.push(`/${locale}/invoicing/invoices`)
        router.refresh()
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleReport() {
    setError(null)
    setBusy('submit')
    try {
      const created = await postInvoice()
      if (!created) return
      const res = await fetch(
        `/api/invoicing/invoices/${created.id}/submit`,
        { method: 'POST' },
      )
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        qr_code?: string
        rejection_reason?: string
        error?: { ar?: string; en?: string }
      }
      if (!res.ok || !body.ok) {
        const reason =
          body.rejection_reason ??
          (loc === 'ar' ? body.error?.ar : body.error?.en) ??
          tS('errors.reportFailed')
        setError(reason)
        return
      }

      // Render the TLV QR as a scannable image. Fallback silently on failure.
      let qrImage = ''
      if (body.qr_code) {
        try {
          qrImage = await generateQrCodeImage(body.qr_code)
        } catch {
          qrImage = ''
        }
      }

      clearLocalDraft()
      setReceipt({
        invoiceId: created.id,
        invoiceNumber: created.invoiceNumber,
        qrImage,
        buyerName: effectiveBuyerName,
        issueDate: form.issue_date,
      })
    } finally {
      setBusy(null)
    }
  }

  function handleNewInvoice() {
    setReceipt(null)
    setForm(makeDefaults())
    setError(null)
  }

  if (!businessId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">{t('errors.noBusiness')}</p>
      </div>
    )
  }

  // ─── Receipt screen ─────────────────────────────────────────────────────
  if (receipt) {
    const sellerName =
      (loc === 'ar'
        ? currentBusiness?.name_ar
        : currentBusiness?.name_en) ??
      currentBusiness?.name_ar ??
      ''

    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-6 print:py-0">
        <div className="rounded-xl border border-border bg-surface-1 p-6 space-y-4 print:border-0 print:shadow-none">
          <div className="text-center space-y-1">
            <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold print:bg-transparent print:border print:border-emerald-700">
              {tS('receipt.reportedBanner')}
            </div>
            <h1 className="text-xl font-bold">{sellerName}</h1>
            <div className="text-xs text-muted-foreground">
              {tS('receipt.invoiceNumber')}: {receipt.invoiceNumber}
            </div>
            <div className="text-xs text-muted-foreground">
              {tS('receipt.issueDate')}: {receipt.issueDate}
            </div>
          </div>

          <div className="border-t border-border pt-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {tS('receipt.buyer')}
              </span>
              <span className="font-medium">{receipt.buyerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {tS('receipt.subtotal')}
              </span>
              <span>{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {tS('receipt.vat')}
              </span>
              <span>{totals.total_vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-border pt-2 mt-1">
              <span>{tS('receipt.total')}</span>
              <span>{totals.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {receipt.qrImage && (
            <div className="flex flex-col items-center gap-2 pt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receipt.qrImage}
                alt="ZATCA QR"
                className="w-48 h-48"
              />
              <p className="text-xs text-muted-foreground text-center">
                {tS('receipt.scanHint')}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 print:hidden">
          <Button
            type="button"
            onClick={() => window.print()}
            className="flex-1"
          >
            <Printer className="w-4 h-4" />
            {tS('receipt.print')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleNewInvoice}
            className="flex-1"
          >
            {tS('receipt.newInvoice')}
          </Button>
          <Link
            href={`/${locale}/invoicing/invoices/${receipt.invoiceId}`}
            className="flex-1"
          >
            <Button type="button" variant="outline" className="w-full">
              {tS('receipt.done')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // ─── Form ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <Link
        href={`/${locale}/invoicing`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        {t('backToInvoicing')}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{tS('newTitle')}</h1>
        <p className="text-sm text-muted-foreground">{tS('newSubtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Buyer (minimal / optional) */}
          <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
            <h2 className="font-semibold">{tS('sections.buyer')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">
                  {tS('fields.buyerName')}
                </span>
                <Input
                  value={form.buyer_name}
                  onChange={(e) => set('buyer_name', e.target.value)}
                  placeholder={tS('fields.buyerNamePlaceholder')}
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">
                  {tS('fields.buyerVat')}
                </span>
                <Input
                  value={form.buyer_vat}
                  onChange={(e) => set('buyer_vat', e.target.value)}
                  placeholder={tS('fields.buyerVatPlaceholder')}
                  inputMode="numeric"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {tS('walkInCustomer')}
            </p>
          </section>

          {/* Metadata */}
          <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
            <h2 className="font-semibold">{t('sections.metadata')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">
                  {t('fields.issueDate')}
                </span>
                <Input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => set('issue_date', e.target.value)}
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">
                  {t('fields.supplyDate')}
                </span>
                <Input
                  type="date"
                  value={form.supply_date}
                  onChange={(e) => set('supply_date', e.target.value)}
                />
              </label>
            </div>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground">
                {t('fields.notes')}
              </span>
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={3}
              />
            </label>
          </section>

          {/* Line items */}
          <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
            <h2 className="font-semibold">{t('sections.lineItems')}</h2>
            <LineItemsTable
              value={form.lineItems}
              onChange={(next) => set('lineItems', next)}
              locale={loc}
            />
          </section>
        </div>

        {/* Totals + actions */}
        <div className="space-y-4">
          <InvoiceTotals totals={totals} locale={loc} />
          <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-2">
            <Button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy !== null}
              className="w-full"
              variant="outline"
            >
              {busy === 'save' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('actions.saveDraft')}
            </Button>
            <Button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={busy !== null}
              className="w-full"
              variant="outline"
            >
              <Eye className="w-4 h-4" />
              {t('actions.preview')}
            </Button>
            <Button
              type="button"
              onClick={handleReport}
              disabled={busy !== null}
              className="w-full"
            >
              {busy === 'submit' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {tS('actions.reportZatca')}
            </Button>
          </div>
        </div>
      </div>

      <InvoicePreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={{
          invoiceNumberPlaceholder: t('preview.draftPlaceholder'),
          issueDate: form.issue_date,
          supplyDate: form.supply_date || null,
          dueDate: null,
          paymentTerms: null,
          notes: form.notes || null,
          sellerName:
            (loc === 'ar'
              ? currentBusiness?.name_ar
              : currentBusiness?.name_en) ??
            currentBusiness?.name_ar ??
            '',
          sellerVat: currentBusiness?.cr_number ?? null,
          customer: previewCustomer,
          lineItems: form.lineItems,
        }}
        locale={loc}
      />
    </div>
  )
}
