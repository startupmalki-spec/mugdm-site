'use client'

/**
 * Invoice detail page (Task 61).
 *
 * Client component. Fetches `/api/invoicing/invoices/[id]` and renders:
 *
 *   - Header (number, status badge, type pill, action bar)
 *   - Customer card (or "Walk-in customer" for simplified)
 *   - Line items table
 *   - Totals panel
 *   - QR code (rendered server-side via /api/.../qr)
 *   - Lifecycle timeline
 *   - Linked transaction link (if any)
 *
 * The action bar disables actions that don't apply to the current state:
 *
 *   - Edit / Submit only on `draft`
 *   - Download XML only when `zatca_xml` is present
 *   - Create credit note only on `cleared` / `reported`
 *   - For `rejected` we lift the rejection reason into a callout above the
 *     content and surface an "Edit & resubmit" CTA.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Pencil,
  Send,
  Download,
  FileText,
  Share2,
  Plus,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InvoiceTimeline } from '@/components/invoicing/InvoiceTimeline'
import { QrCodeDisplay } from '@/components/invoicing/QrCodeDisplay'
import { InvoiceTotals } from '@/components/invoicing/InvoiceTotals'
import type {
  Invoice,
  InvoiceLineItem,
  Customer,
  ZatcaStatus,
  InvoiceType,
} from '@/lib/supabase/types'

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

interface RelatedNotesResponse {
  creditNotes: LinkedInvoiceLite[]
  debitNotes: LinkedInvoiceLite[]
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

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function StatusBadge({
  status,
  t,
}: {
  status: ZatcaStatus
  t: (k: string) => string
}) {
  const styles: Record<ZatcaStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending_clearance: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    cleared: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    reported: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    rejected: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  )
}

function TypePill({
  type,
  t,
}: {
  type: InvoiceType
  t: (k: string) => string
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
        type === 'standard'
          ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
          : 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400'
      }`}
    >
      {t(`typePill.${type}`)}
    </span>
  )
}

export default function InvoiceDetailPage() {
  const t = useTranslations('invoicing.invoices.detail')
  const tList = useTranslations('invoicing.invoices.list')
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const router = useRouter()

  const [data, setData] = useState<DetailResponse | null>(null)
  const [related, setRelated] = useState<RelatedNotesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [noteBusy, setNoteBusy] = useState<null | 'credit' | 'debit'>(null)

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
        setError((locale === 'ar' ? err?.ar : err?.en) ?? t('errors.loadFailed'))
        return
      }
      setData(body as DetailResponse)
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, locale, t])

  useEffect(() => {
    void fetchInvoice()
  }, [fetchInvoice])

  // After the invoice loads, if it's a regular invoice, fetch any related
  // credit / debit notes so we can render them at the bottom of the page.
  useEffect(() => {
    if (!data) return
    if (data.invoice.invoice_subtype !== 'invoice') {
      setRelated(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/invoicing/invoices/${id}/related-notes`,
        )
        if (!res.ok) return
        const body = (await res.json().catch(() => null)) as
          | RelatedNotesResponse
          | null
        if (!cancelled && body) setRelated(body)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, id])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error ?? t('errors.notFound')}
        </div>
        <Link
          href={`/${locale}/invoicing/invoices`}
          className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToList')}
        </Link>
      </div>
    )
  }

  const { invoice, lineItems } = data
  const isDraft = invoice.zatca_status === 'draft'
  const isRejected = invoice.zatca_status === 'rejected'
  const isCreditEligible =
    invoice.zatca_status === 'cleared' || invoice.zatca_status === 'reported'
  const customer = invoice.customer ?? null
  const customerName =
    (locale === 'ar'
      ? customer?.name
      : customer?.name_en || customer?.name) ||
    (invoice.invoice_type === 'simplified' ? t('walkInCustomer') : '—')

  async function handleSubmit() {
    if (!isDraft || submitting) return
    setSubmitting(true)
    try {
      await fetch(`/api/invoicing/invoices/${id}/submit`, { method: 'POST' })
      await fetchInvoice()
    } finally {
      setSubmitting(false)
    }
  }

  function handleDownloadPdf() {
    window.open(`/api/invoicing/invoices/${id}/pdf`, '_blank')
  }

  function handleDownloadXml() {
    if (!invoice.zatca_xml) return
    const blob = new Blob([invoice.zatca_xml], {
      type: 'application/xml;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.invoice_number}.xml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleShare() {
    if (shareBusy) return
    setShareBusy(true)
    try {
      const res = await fetch(`/api/invoicing/invoices/${id}/share`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as {
        url?: string
        error?: { ar?: string; en?: string }
      }
      if (res.ok && body.url) {
        setShareUrl(body.url)
      } else {
        setError(
          (locale === 'ar' ? body.error?.ar : body.error?.en) ??
            t('errors.shareFailed'),
        )
      }
    } finally {
      setShareBusy(false)
    }
  }

  async function handleCreateNote(kind: 'credit' | 'debit') {
    if (noteBusy) return
    setNoteBusy(kind)
    try {
      const endpoint = kind === 'credit' ? 'credit-note' : 'debit-note'
      const res = await fetch(`/api/invoicing/invoices/${id}/${endpoint}`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as {
        invoiceId?: string
        editUrl?: string
        error?: { ar?: string; en?: string }
      }
      if (!res.ok || !body.invoiceId) {
        const err = body.error
        setError(
          (locale === 'ar' ? err?.ar : err?.en) ?? t('errors.loadFailed'),
        )
        return
      }
      // Server returns a relative path; prefix with locale.
      const editPath = body.editUrl
        ? `/${locale}${body.editUrl}`
        : `/${locale}/invoicing/invoices/${body.invoiceId}/edit`
      router.push(editPath)
    } finally {
      setNoteBusy(null)
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Back link */}
      <Link
        href={`/${locale}/invoicing/invoices`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('backToList')}
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold font-mono">
              {invoice.invoice_number}
            </h1>
            <StatusBadge status={invoice.zatca_status} t={tList} />
            <TypePill type={invoice.invoice_type} t={tList} />
            {invoice.source === 'imported_xml' && (
              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-border">
                {tList('typePill.imported')}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {t('issuedOn', { date: formatDate(invoice.issue_date, locale) })}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                router.push(`/${locale}/invoicing/invoices/${id}/edit`)
              }
            >
              <Pencil className="w-4 h-4" />
              {t('actions.edit')}
            </Button>
          )}
          {isDraft && (
            <Button
              className="gap-2"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t('actions.submit')}
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleDownloadPdf}
          >
            <FileText className="w-4 h-4" />
            {t('actions.downloadPdf')}
          </Button>
          {invoice.zatca_xml && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleDownloadXml}
            >
              <Download className="w-4 h-4" />
              {t('actions.downloadXml')}
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-2"
            disabled={shareBusy}
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
            {t('actions.share')}
          </Button>
          {isCreditEligible && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={noteBusy !== null}
              onClick={() => void handleCreateNote('credit')}
            >
              {noteBusy === 'credit' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {t('actions.creditNote')}
            </Button>
          )}
          {isCreditEligible && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={noteBusy !== null}
              onClick={() => void handleCreateNote('debit')}
            >
              {noteBusy === 'debit' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {t('actions.debitNote')}
            </Button>
          )}
        </div>
      </header>

      {/* Share URL callout */}
      {shareUrl && (
        <div className="rounded-lg border border-border bg-surface-1 p-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="text-xs text-muted-foreground">{t('share.urlLabel')}</div>
          <code className="flex-1 truncate text-xs bg-muted px-2 py-1 rounded">
            {shareUrl}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={copyShareUrl}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? t('share.copied') : t('share.copy')}
          </Button>
        </div>
      )}

      {/* Rejected callout */}
      {isRejected && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                {t('rejected.title')}
              </h3>
              <p className="text-sm text-rose-700/90 dark:text-rose-300/90 mt-1">
                {invoice.zatca_rejection_reason ||
                  t('rejected.fallbackReason')}
              </p>
              <Button
                size="sm"
                className="mt-3 gap-2"
                onClick={() =>
                  router.push(`/${locale}/invoicing/invoices/${id}/edit`)
                }
              >
                <Pencil className="w-3.5 h-3.5" />
                {t('rejected.editAndResubmit')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Original invoice reference — shown for credit/debit notes */}
      {(invoice.invoice_subtype === 'credit_note' ||
        invoice.invoice_subtype === 'debit_note') &&
        invoice.linked_invoice && (
          <section
            className={`rounded-xl border p-4 ${
              invoice.invoice_subtype === 'credit_note'
                ? 'border-rose-500/40 bg-rose-500/5'
                : 'border-amber-500/40 bg-amber-500/5'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide mb-2">
              {invoice.invoice_subtype === 'credit_note'
                ? t('creditNote.originalInvoice')
                : t('debitNote.originalInvoice')}
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <Link
                href={`/${locale}/invoicing/invoices/${invoice.linked_invoice.id}`}
                className="font-mono font-medium text-primary hover:underline"
              >
                {invoice.linked_invoice.invoice_number}
              </Link>
              <span className="text-xs text-muted-foreground">
                {formatDate(invoice.linked_invoice.issue_date, locale)}
              </span>
              <span className="text-sm tabular-nums ms-auto">
                {formatSar(Number(invoice.linked_invoice.total_amount), locale)}
              </span>
            </div>
          </section>
        )}

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer card */}
          <div className="rounded-xl border border-border bg-surface-1 p-4">
            <h3 className="text-sm font-semibold mb-3">{t('customer.title')}</h3>
            <div className="text-sm">
              <div className="font-medium">{customerName}</div>
              {customer?.vat_number && (
                <div className="text-xs text-muted-foreground mt-1">
                  {t('customer.vat')}: {customer.vat_number}
                </div>
              )}
              {customer?.cr_number && (
                <div className="text-xs text-muted-foreground">
                  {t('customer.cr')}: {customer.cr_number}
                </div>
              )}
              {customer?.address && (
                <div className="text-xs text-muted-foreground mt-1">
                  {customer.address}
                </div>
              )}
              {customer?.email && (
                <div className="text-xs text-muted-foreground">
                  {customer.email}
                </div>
              )}
              {customer?.phone && (
                <div className="text-xs text-muted-foreground">
                  {customer.phone}
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-border bg-surface-1 p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">
                {t('meta.issueDate')}
              </div>
              <div>{formatDate(invoice.issue_date, locale)}</div>
            </div>
            {invoice.supply_date && (
              <div>
                <div className="text-xs text-muted-foreground">
                  {t('meta.supplyDate')}
                </div>
                <div>{formatDate(invoice.supply_date, locale)}</div>
              </div>
            )}
            {invoice.due_date && (
              <div>
                <div className="text-xs text-muted-foreground">
                  {t('meta.dueDate')}
                </div>
                <div>{formatDate(invoice.due_date, locale)}</div>
              </div>
            )}
            {invoice.payment_terms && (
              <div>
                <div className="text-xs text-muted-foreground">
                  {t('meta.paymentTerms')}
                </div>
                <div>{invoice.payment_terms}</div>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-border bg-surface-1 p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('lineItems.title')}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pe-2 w-8">#</th>
                    <th className="py-2 pe-2">{t('lineItems.description')}</th>
                    <th className="py-2 pe-2 w-16 text-end">
                      {t('lineItems.qty')}
                    </th>
                    <th className="py-2 pe-2 w-24 text-end">
                      {t('lineItems.unitPrice')}
                    </th>
                    <th className="py-2 pe-2 w-20 text-end">
                      {t('lineItems.vatRate')}
                    </th>
                    <th className="py-2 pe-2 w-24 text-end">
                      {t('lineItems.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li) => (
                    <tr key={li.id} className="border-b border-border/40">
                      <td className="py-2 pe-2 text-muted-foreground">
                        {li.line_number}
                      </td>
                      <td className="py-2 pe-2">{li.description}</td>
                      <td className="py-2 pe-2 text-end tabular-nums">
                        {Number(li.quantity).toFixed(2)}
                      </td>
                      <td className="py-2 pe-2 text-end tabular-nums">
                        {formatSar(Number(li.unit_price), locale)}
                      </td>
                      <td className="py-2 pe-2 text-end tabular-nums">
                        {Number(li.vat_rate).toFixed(0)}%
                      </td>
                      <td className="py-2 pe-2 text-end tabular-nums">
                        {formatSar(Number(li.line_total), locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {invoice.notes && (
            <div className="rounded-xl border border-border bg-surface-1 p-4">
              <h3 className="text-sm font-semibold mb-2">{t('notes.title')}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}

          {/* Related credit/debit notes (only for regular invoices) */}
          {invoice.invoice_subtype === 'invoice' &&
            related &&
            (related.creditNotes.length > 0 ||
              related.debitNotes.length > 0) && (
              <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-4">
                <h3 className="text-sm font-semibold">
                  {t('relatedNotes.title')}
                </h3>
                {related.creditNotes.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      {t('relatedNotes.credit')}
                    </div>
                    <ul className="divide-y divide-border/40">
                      {related.creditNotes.map((n) => (
                        <li
                          key={n.id}
                          className="py-2 flex items-baseline gap-3"
                        >
                          <Link
                            href={`/${locale}/invoicing/invoices/${n.id}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {n.invoice_number}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(n.issue_date, locale)}
                          </span>
                          <span className="ms-auto text-sm tabular-nums">
                            {formatSar(Number(n.total_amount), locale)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {related.debitNotes.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      {t('relatedNotes.debit')}
                    </div>
                    <ul className="divide-y divide-border/40">
                      {related.debitNotes.map((n) => (
                        <li
                          key={n.id}
                          className="py-2 flex items-baseline gap-3"
                        >
                          <Link
                            href={`/${locale}/invoicing/invoices/${n.id}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {n.invoice_number}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(n.issue_date, locale)}
                          </span>
                          <span className="ms-auto text-sm tabular-nums">
                            {formatSar(Number(n.total_amount), locale)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          {invoice.linked_transaction_id && (
            <div className="rounded-xl border border-border bg-surface-1 p-4">
              <Link
                href={`/${locale}/bookkeeper/transactions/${invoice.linked_transaction_id}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                {t('linkedTransaction')}
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <InvoiceTotals
            totals={{
              subtotal: Number(invoice.subtotal),
              total_vat: Number(invoice.total_vat),
              total_amount: Number(invoice.total_amount),
            }}
            locale={locale === 'ar' ? 'ar' : 'en'}
          />
          {invoice.zatca_qr_code && (
            <QrCodeDisplay invoiceId={id} size={224} />
          )}
          <InvoiceTimeline
            status={invoice.zatca_status}
            createdAt={invoice.created_at}
            submittedAt={invoice.zatca_submitted_at}
            clearedAt={invoice.zatca_cleared_at}
            rejectionReason={invoice.zatca_rejection_reason}
            locale={locale === 'ar' ? 'ar' : 'en'}
          />
        </aside>
      </div>
    </div>
  )
}
