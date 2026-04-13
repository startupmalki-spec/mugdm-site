'use client'

/**
 * Invoice edit page (Task 62).
 *
 * Reuses the layout from the New Invoice page, but loads the existing invoice
 * + line items via GET /api/invoicing/invoices/[id]?include=customer,linked_invoice
 * and persists changes via PATCH on the same endpoint.
 *
 * Editing is only permitted while the invoice is `zatca_status='draft'`. After
 * submission the route returns 409 and the UI shows a read-only message.
 *
 * For credit/debit notes, a top-of-page "Original Invoice" panel surfaces the
 * referenced invoice number, totals and a link back so the user always has
 * the source of the adjustment in view.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, Save, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { calculateInvoiceTotals } from '@/lib/invoicing/calculations'
import type { Invoice, InvoiceLineItem, Customer } from '@/lib/supabase/types'

import {
  LineItemsTable,
  EMPTY_LINE,
  type EditableLineItem,
} from '@/components/invoicing/LineItemsTable'
import { InvoiceTotals } from '@/components/invoicing/InvoiceTotals'

interface LinkedInvoiceLite {
  id: string
  invoice_number: string
  total_amount: number
  issue_date: string
  zatca_status: string
  invoice_subtype: 'invoice' | 'credit_note' | 'debit_note'
}

interface DetailResponse {
  invoice: Invoice & {
    customer?: Customer | null
    linked_invoice?: LinkedInvoiceLite | null
  }
  lineItems: InvoiceLineItem[]
}

interface FormState {
  customer_id: string | null
  issue_date: string
  supply_date: string
  due_date: string
  payment_terms: string
  notes: string
  lineItems: EditableLineItem[]
}

function toForm(d: DetailResponse): FormState {
  const { invoice, lineItems } = d
  return {
    customer_id: invoice.customer_id,
    issue_date: invoice.issue_date?.slice(0, 10) ?? '',
    supply_date: invoice.supply_date?.slice(0, 10) ?? '',
    due_date: invoice.due_date?.slice(0, 10) ?? '',
    payment_terms: invoice.payment_terms ?? '',
    notes: invoice.notes ?? '',
    lineItems:
      lineItems.length > 0
        ? lineItems.map((li, i) => ({
            line_number: i + 1,
            description: li.description ?? '',
            description_en: '',
            quantity: Number(li.quantity ?? 0),
            unit_price: Number(li.unit_price ?? 0),
            discount_amount: Number(li.discount_amount ?? 0),
            vat_rate: Number(li.vat_rate ?? 0),
          }))
        : [{ ...EMPTY_LINE, line_number: 1 }],
  }
}

function formatSar(amount: number, locale: string): string {
  try {
    return amount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
    })
  } catch {
    return `${amount.toFixed(2)} SAR`
  }
}

export default function EditInvoicePage() {
  const t = useTranslations('invoicing.invoices')
  const tCredit = useTranslations('invoicing.invoices.creditNote')
  const tDebit = useTranslations('invoicing.invoices.debitNote')
  const router = useRouter()
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const loc: 'ar' | 'en' = locale === 'ar' ? 'ar' : 'en'

  const [data, setData] = useState<DetailResponse | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'save' | 'submit'>(null)
  const initRef = useRef(false)

  const fetchInvoice = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/invoicing/invoices/${id}?include=customer,linked_invoice`,
      )
      const body = (await res.json().catch(() => ({}))) as
        | DetailResponse
        | { error?: { ar?: string; en?: string } }
      if (!res.ok) {
        const err = (body as { error?: { ar?: string; en?: string } }).error
        setError((loc === 'ar' ? err?.ar : err?.en) ?? 'Failed to load')
        return
      }
      const d = body as DetailResponse
      setData(d)
      if (!initRef.current) {
        setForm(toForm(d))
        initRef.current = true
      }
    } finally {
      setLoading(false)
    }
  }, [id, loc])

  useEffect(() => {
    void fetchInvoice()
  }, [fetchInvoice])

  const totals = useMemo(
    () => (form ? calculateInvoiceTotals(form.lineItems) : null),
    [form],
  )

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  async function patchInvoice(): Promise<boolean> {
    if (!form) return false
    const res = await fetch(`/api/invoicing/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice: {
          customer_id: form.customer_id,
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
      ok?: boolean
      error?: { ar?: string; en?: string }
    }
    if (!res.ok || !body.ok) {
      setError((loc === 'ar' ? body.error?.ar : body.error?.en) ?? t('errors.saveFailed'))
      return false
    }
    return true
  }

  async function handleSave() {
    setError(null)
    setBusy('save')
    try {
      const ok = await patchInvoice()
      if (ok) {
        router.push(`/${locale}/invoicing/invoices/${id}`)
        router.refresh()
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleSubmit() {
    setError(null)
    setBusy('submit')
    try {
      const ok = await patchInvoice()
      if (!ok) return
      const res = await fetch(`/api/invoicing/invoices/${id}/submit`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        rejection_reason?: string
        error?: { ar?: string; en?: string }
      }
      if (!res.ok || !body.ok) {
        setError(
          body.rejection_reason ??
            (loc === 'ar' ? body.error?.ar : body.error?.en) ??
            t('errors.submitFailed'),
        )
        return
      }
      router.push(`/${locale}/invoicing/invoices/${id}`)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  if (loading || !data || !form) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex justify-center">
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        )}
      </div>
    )
  }

  const subtype = data.invoice.invoice_subtype
  const isCredit = subtype === 'credit_note'
  const isDebit = subtype === 'debit_note'
  const isNote = isCredit || isDebit
  const isDraft = data.invoice.zatca_status === 'draft'
  const linked = data.invoice.linked_invoice ?? null

  if (!isDraft) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
        <Link
          href={`/${locale}/invoicing/invoices/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t('detail.backToList')}
        </Link>
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          {loc === 'ar'
            ? 'لا يمكن تعديل فاتورة مُرسلة إلى الهيئة.'
            : 'Only draft invoices can be edited.'}
        </div>
      </div>
    )
  }

  const titleKey = isCredit ? tCredit('editTitle') : isDebit ? tDebit('editTitle') : t('newTitle')
  const subtitleKey = isCredit
    ? tCredit('editSubtitle')
    : isDebit
      ? tDebit('editSubtitle')
      : t('newSubtitle')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <Link
        href={`/${locale}/invoicing/invoices/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        {t('detail.backToList')}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{titleKey}</h1>
        <p className="text-sm text-muted-foreground">{subtitleKey}</p>
      </div>

      {/* Original Invoice reference panel — only for credit/debit notes */}
      {isNote && linked && (
        <section
          className={`rounded-xl border p-4 ${
            isCredit
              ? 'border-rose-500/40 bg-rose-500/5'
              : 'border-amber-500/40 bg-amber-500/5'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wide mb-2">
            {isCredit ? tCredit('originalInvoice') : tDebit('originalInvoice')}
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <Link
              href={`/${locale}/invoicing/invoices/${linked.id}`}
              className="font-mono font-medium text-primary hover:underline"
            >
              {linked.invoice_number}
            </Link>
            <span className="text-xs text-muted-foreground">
              {linked.issue_date}
            </span>
            <span className="text-sm tabular-nums ms-auto">
              {formatSar(Number(linked.total_amount), locale)}
            </span>
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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

          <section className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
            <h2 className="font-semibold">{t('sections.lineItems')}</h2>
            <LineItemsTable
              value={form.lineItems}
              onChange={(next) => set('lineItems', next)}
              locale={loc}
            />
          </section>
        </div>

        <div className="space-y-4">
          {totals && <InvoiceTotals totals={totals} locale={loc} />}
          <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-2">
            <Button
              type="button"
              onClick={handleSave}
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
              onClick={handleSubmit}
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
    </div>
  )
}
