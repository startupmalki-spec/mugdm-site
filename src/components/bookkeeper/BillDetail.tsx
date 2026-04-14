'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  History,
  Pencil,
  Send,
  XCircle,
  Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type {
  Bill,
  BillAttachment,
  BillAuditLog,
  BillLineItem,
  BillPayment,
  BillStatus,
  Vendor,
} from '@/lib/supabase/types'
import PaymentModal from './PaymentModal'

interface Props {
  bill: Bill
  vendor: Vendor | null
  lineItems: BillLineItem[]
  attachments: BillAttachment[]
  payments: BillPayment[]
  auditLog: BillAuditLog[]
}

function statusBadgeClass(status: BillStatus): string {
  switch (status) {
    case 'overdue':
      return 'bg-red-500/15 text-red-500 border-red-500/30'
    case 'paid':
      return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
    case 'approved':
      return 'bg-blue-500/15 text-blue-500 border-blue-500/30'
    case 'pending':
      return 'bg-amber-500/15 text-amber-500 border-amber-500/30'
    case 'void':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30 line-through'
    case 'draft':
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function formatSAR(amount: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} SAR`
  }
}

function vendorName(v: Vendor | null, locale: string): string {
  if (!v) return '—'
  if (locale === 'ar') return v.name_ar || v.name_en || '—'
  return v.name_en || v.name_ar || '—'
}

export default function BillDetail({
  bill,
  vendor,
  lineItems,
  attachments,
  payments,
  auditLog,
}: Props) {
  const t = useTranslations('bookkeeper.bills.detail')
  const tList = useTranslations('bookkeeper.bills')
  const locale = useLocale()
  const router = useRouter()

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [pending, setPending] = useState<null | 'submit' | 'approve' | 'void'>(
    null,
  )

  async function runAction(action: 'submit' | 'approve' | 'void') {
    if (action === 'void' && !confirm(t('confirmVoid'))) return
    setPending(action)
    try {
      const res = await fetch(`/api/bills/${bill.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'void' ? JSON.stringify({}) : undefined,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error?.en || err?.error || `Failed to ${action} bill`)
        return
      }
      router.refresh()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setPending(null)
    }
  }

  const canEdit =
    bill.status === 'draft' ||
    bill.status === 'pending' ||
    bill.status === 'approved'
  const canSubmit = bill.status === 'draft'
  const canApprove = bill.status === 'pending'
  const canPay = bill.status === 'approved' || bill.status === 'overdue'
  const canVoid = bill.status !== 'paid' && bill.status !== 'void'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/bookkeeper/bills"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">
            {bill.bill_number
              ? t('titleWithNumber', { number: bill.bill_number })
              : t('title')}
          </h1>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
              statusBadgeClass(bill.status),
            )}
          >
            {tList(`status.${bill.status}`)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              type="button"
              disabled
              title={t('editComingSoon')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-sm font-medium text-muted-foreground disabled:cursor-not-allowed"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t('actions.edit')}
            </button>
          )}
          {canSubmit && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => runAction('submit')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {t('actions.submit')}
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => runAction('approve')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('actions.approve')}
            </button>
          )}
          {canPay && (
            <button
              type="button"
              onClick={() => setPaymentOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {t('actions.markPaid')}
            </button>
          )}
          {canVoid && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => runAction('void')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              {t('actions.void')}
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label={t('vendor')} value={vendorName(vendor, locale)} />
        <SummaryCard
          label={t('issueDate')}
          value={bill.issue_date}
        />
        <SummaryCard label={t('dueDate')} value={bill.due_date} />
        <SummaryCard
          label={t('subtotal')}
          value={formatSAR(Number(bill.subtotal), locale)}
        />
        <SummaryCard
          label={t('vat', { rate: Number(bill.vat_rate).toFixed(2) })}
          value={formatSAR(Number(bill.vat_amount), locale)}
        />
        <SummaryCard
          label={t('total')}
          value={formatSAR(Number(bill.total), locale)}
          highlight
        />
      </div>

      {bill.notes && (
        <div className="rounded-xl border border-border bg-surface-1 p-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('notes')}
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {bill.notes}
          </p>
        </div>
      )}

      {/* Line items */}
      <Section title={t('lineItems')} icon={<FileText className="h-4 w-4" />}>
        {lineItems.length === 0 ? (
          <EmptyRow text={t('noLineItems')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">
                    {t('columns.description')}
                  </th>
                  <th className="px-4 py-2 text-end font-medium">
                    {t('columns.qty')}
                  </th>
                  <th className="px-4 py-2 text-end font-medium">
                    {t('columns.unitPrice')}
                  </th>
                  <th className="px-4 py-2 text-start font-medium">
                    {t('columns.category')}
                  </th>
                  <th className="px-4 py-2 text-end font-medium">
                    {t('columns.amount')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="px-4 py-2 text-foreground">{li.description}</td>
                    <td className="px-4 py-2 text-end font-mono text-muted-foreground">
                      {Number(li.quantity)}
                    </td>
                    <td className="px-4 py-2 text-end font-mono text-muted-foreground">
                      {formatSAR(Number(li.unit_price), locale)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {li.category ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-end font-mono text-foreground">
                      {formatSAR(Number(li.amount), locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Attachments */}
      <Section title={t('attachments')} icon={<ImageIcon className="h-4 w-4" />}>
        {attachments.length === 0 ? (
          <EmptyRow text={t('noAttachments')} />
        ) : (
          <ul className="divide-y divide-border">
            {attachments.map((a) => (
              <AttachmentRow key={a.id} attachment={a} />
            ))}
          </ul>
        )}
      </Section>

      {/* Payments */}
      <Section title={t('payments')} icon={<CreditCard className="h-4 w-4" />}>
        {payments.length === 0 ? (
          <EmptyRow text={t('noPayments')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">
                    {t('columns.paidAt')}
                  </th>
                  <th className="px-4 py-2 text-end font-medium">
                    {t('columns.amount')}
                  </th>
                  <th className="px-4 py-2 text-start font-medium">
                    {t('columns.method')}
                  </th>
                  <th className="px-4 py-2 text-start font-medium">
                    {t('columns.reference')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 text-muted-foreground">
                      {p.paid_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-end font-mono text-foreground">
                      {formatSAR(Number(p.amount), locale)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {t(`methods.${p.method}`)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {p.reference_number ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Audit log */}
      <Section title={t('auditLog')} icon={<History className="h-4 w-4" />}>
        {auditLog.length === 0 ? (
          <EmptyRow text={t('noAuditLog')} />
        ) : (
          <ol className="space-y-3 p-4">
            {auditLog.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {t(`audit.${entry.action}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString(
                      locale === 'ar' ? 'ar-SA' : 'en-SA',
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <PaymentModal
        billId={bill.id}
        defaultAmount={Number(bill.total)}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-1 p-4',
        highlight && 'border-primary/40 bg-primary/5',
      )}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-base font-semibold text-foreground',
          highlight && 'text-primary',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2 text-sm font-medium text-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-sm text-muted-foreground">{text}</div>
}

function AttachmentRow({ attachment }: { attachment: BillAttachment }) {
  const t = useTranslations('bookkeeper.bills.detail')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isImage = (attachment.mime_type ?? '').startsWith('image/')
  const isPdf = attachment.mime_type === 'application/pdf'

  const handleOpen = async () => {
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: e } = await supabase.storage
        .from('documents')
        .createSignedUrl(attachment.storage_key, 3600)
      if (e || !data?.signedUrl) throw e ?? new Error('Failed')
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-foreground">
        {isImage ? (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="truncate">{attachment.filename}</span>
        {isPdf && (
          <span className="text-xs uppercase text-muted-foreground">PDF</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-500">{error}</span>}
        <button
          type="button"
          onClick={handleOpen}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {t('openAttachment')}
        </button>
      </div>
    </li>
  )
}
