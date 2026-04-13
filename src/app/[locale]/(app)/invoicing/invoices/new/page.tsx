'use client'

/**
 * New invoice page (Task 58) — Standard B2B invoice creation.
 *
 * Flow:
 *   1. User picks a customer (loaded from /api/customers).
 *   2. Fills metadata + line items (LineItemsTable).
 *   3. Sees live totals (InvoiceTotals) and can open a print-friendly preview.
 *   4. Actions: Save draft (POST /api/invoicing/invoices),
 *               Preview, Submit to ZATCA (save-draft-then-submit).
 *
 * Auto-save: every 30s we persist the in-progress form to `localStorage` under
 * `invoice-draft-<businessId>`. If on mount we find a newer snapshot than the
 * empty defaults, it's restored.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Eye, Loader2, Save, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useBusiness } from '@/lib/business-context'
import { calculateInvoiceTotals } from '@/lib/invoicing/calculations'
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
  customer_id: string | null
  issue_date: string
  supply_date: string
  due_date: string
  payment_terms: string
  notes: string
  lineItems: EditableLineItem[]
  savedAt: number
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function makeDefaults(): FormState {
  return {
    customer_id: null,
    issue_date: todayIso(),
    supply_date: '',
    due_date: '',
    payment_terms: '',
    notes: '',
    lineItems: [{ ...EMPTY_LINE, line_number: 1 }],
    savedAt: 0,
  }
}

export default function NewInvoicePage() {
  const t = useTranslations('invoicing.invoices')
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const loc: 'ar' | 'en' = locale === 'ar' ? 'ar' : 'en'
  const { businessId, currentBusiness } = useBusiness()

  const [form, setForm] = useState<FormState>(() => makeDefaults())
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'save' | 'submit'>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const mountedRef = useRef(false)

  const storageKey = businessId ? `invoice-draft-${businessId}` : null

  // Restore from localStorage on mount.
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
      // ignore — corrupt draft
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
        // storage full / disabled — silent
      }
    }, AUTOSAVE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [form, storageKey])

  // Load customers when the business or query changes.
  const loadCustomers = useCallback(async () => {
    if (!businessId) return
    setLoadingCustomers(true)
    try {
      const url = new URL('/api/customers', window.location.origin)
      url.searchParams.set('businessId', businessId)
      if (customerQuery.trim()) url.searchParams.set('q', customerQuery.trim())
      url.searchParams.set('pageSize', '50')
      const res = await fetch(url.toString())
      const body = (await res.json().catch(() => ({}))) as {
        customers?: Customer[]
      }
      setCustomers(body.customers ?? [])
    } catch {
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }, [businessId, customerQuery])

  useEffect(() => {
    const id = window.setTimeout(loadCustomers, 250)
    return () => window.clearTimeout(id)
  }, [loadCustomers])

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

  async function postInvoice(): Promise<string | null> {
    if (!businessId) {
      setError(t('errors.noBusiness'))
      return null
    }
    if (form.lineItems.length === 0) {
      setError(t('errors.noLines'))
      return null
    }

    const res = await fetch('/api/invoicing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        invoice: {
          customer_id: form.customer_id,
          invoice_subtype: 'invoice',
          language: 'both',
          issue_date: form.issue_date,
          supply_date: form.supply_date || null,
          due_date: form.due_date || null,
          payment_terms: form.payment_terms || null,
          notes: form.notes || null,
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
      error?: { ar?: string; en?: string }
    }
    if (!res.ok || !body.invoiceId) {
      const err = body.error
      setError((loc === 'ar' ? err?.ar : err?.en) ?? t('errors.saveFailed'))
      return null
    }
    return body.invoiceId
  }

  async function handleSaveDraft() {
    setError(null)
    setBusy('save')
    try {
      const id = await postInvoice()
      if (id) {
        clearLocalDraft()
        router.push(`/${locale}/invoicing/invoices`)
        router.refresh()
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleSubmitZatca() {
    setError(null)
    setBusy('submit')
    try {
      const id = await postInvoice()
      if (!id) return
      const res = await fetch(`/api/invoicing/invoices/${id}/submit`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        rejection_reason?: string
        error?: { ar?: string; en?: string }
      }
      if (!res.ok || !body.ok) {
        const reason =
          body.rejection_reason ??
          (loc === 'ar' ? body.error?.ar : body.error?.en) ??
          t('errors.submitFailed')
        setError(reason)
        return
      }
      clearLocalDraft()
      router.push(`/${locale}/invoicing/invoices/${id}`)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === form.customer_id) ?? null,
    [customers, form.customer_id],
  )

  if (!businessId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">{t('errors.noBusiness')}</p>
      </div>
    )
  }

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
        <h1 className="text-2xl font-bold">{t('newTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('newSubtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer */}
          <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
            <h2 className="font-semibold">{t('sections.customer')}</h2>
            <Input
              placeholder={t('customer.searchPlaceholder')}
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto border border-border rounded">
              {loadingCustomers && (
                <div className="p-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 inline animate-spin me-2" />
                  {t('customer.loading')}
                </div>
              )}
              {!loadingCustomers && customers.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">
                  {t('customer.empty')}
                </div>
              )}
              {customers.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => set('customer_id', c.id)}
                  className={`w-full text-start p-2 text-sm border-b border-border last:border-0 hover:bg-accent ${
                    form.customer_id === c.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.vat_number ?? c.cr_number ?? c.email ?? ''}
                  </div>
                </button>
              ))}
            </div>
            {selectedCustomer && (
              <p className="text-xs text-muted-foreground">
                {t('customer.selected')}: {selectedCustomer.name}
              </p>
            )}
          </section>

          {/* Metadata */}
          <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
            <h2 className="font-semibold">{t('sections.metadata')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <label className="text-sm space-y-1">
                <span className="text-muted-foreground">
                  {t('fields.dueDate')}
                </span>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => set('due_date', e.target.value)}
                />
              </label>
            </div>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground">
                {t('fields.paymentTerms')}
              </span>
              <Input
                value={form.payment_terms}
                onChange={(e) => set('payment_terms', e.target.value)}
                placeholder={t('fields.paymentTermsPlaceholder')}
              />
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-muted-foreground">{t('fields.notes')}</span>
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
              onClick={handleSubmitZatca}
              disabled={busy !== null}
              className="w-full"
            >
              {busy === 'submit' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t('actions.submitZatca')}
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
          dueDate: form.due_date || null,
          paymentTerms: form.payment_terms || null,
          notes: form.notes || null,
          sellerName:
            (loc === 'ar'
              ? currentBusiness?.name_ar
              : currentBusiness?.name_en) ??
            currentBusiness?.name_ar ??
            '',
          sellerVat: currentBusiness?.cr_number ?? null,
          customer: selectedCustomer,
          lineItems: form.lineItems,
        }}
        locale={loc}
      />
    </div>
  )
}
