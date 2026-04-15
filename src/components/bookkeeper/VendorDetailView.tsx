'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import type { Bill, BillPayment, BillStatus, Vendor } from '@/lib/supabase/types'

interface Summary {
  totalSpend: number
  billCount: number
  paidBillCount: number
  lastPaid: string | null
  avgCycleDays: number | null
}

interface Props {
  vendor: Vendor
  bills: Bill[]
  payments: BillPayment[]
  summary: Summary
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

export default function VendorDetailView({ vendor, bills, payments, summary }: Props) {
  const t = useTranslations('bookkeeper.vendors')
  const tBill = useTranslations('bookkeeper.bills')
  const locale = useLocale()

  const displayName =
    locale === 'ar'
      ? vendor.name_ar || vendor.name_en || '—'
      : vendor.name_en || vendor.name_ar || '—'

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{t('detailTitle')}</p>
        <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-1 p-4">
          <div className="text-xs uppercase text-muted-foreground">{t('totalSpend')}</div>
          <div className="mt-1 font-mono text-xl text-foreground">
            {formatSAR(summary.totalSpend, locale)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface-1 p-4">
          <div className="text-xs uppercase text-muted-foreground">{t('billCount')}</div>
          <div className="mt-1 text-xl text-foreground">{summary.billCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface-1 p-4">
          <div className="text-xs uppercase text-muted-foreground">{t('lastPaid')}</div>
          <div className="mt-1 text-xl text-foreground">
            {summary.lastPaid ? summary.lastPaid.slice(0, 10) : t('never')}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface-1 p-4">
          <div className="text-xs uppercase text-muted-foreground">{t('avgCycle')}</div>
          <div className="mt-1 text-xl text-foreground">
            {summary.avgCycleDays !== null
              ? t('days', { n: summary.avgCycleDays })
              : t('never')}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-1 p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">{t('contactInfo')}</h3>
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-4">
          <div>{vendor.email || t('noEmail')}</div>
          <div>{vendor.phone || t('noPhone')}</div>
          <div>
            {t('vatNumber')}: {vendor.vat_number || '—'}
          </div>
          <div>
            {t('iban')}: {vendor.iban || '—'}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
        <div className="border-b border-border bg-surface-2 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
          {t('billsTitle')}
        </div>
        {bills.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{t('noBills')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">
                    {tBill('columns.billNumber')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {tBill('columns.issueDate')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {tBill('columns.dueDate')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium">
                    {tBill('columns.amount')}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {tBill('columns.status')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3 text-muted-foreground">{b.bill_number ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.issue_date}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.due_date}</td>
                    <td className="px-4 py-3 text-end font-mono text-foreground">
                      {formatSAR(Number(b.total) || 0, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                          statusBadgeClass(b.status),
                        )}
                      >
                        {tBill(`status.${b.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/bookkeeper/bills/${b.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {tBill('view')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
        <div className="border-b border-border bg-surface-2 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
          {t('paymentsTitle')}
        </div>
        {payments.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{t('noPayments')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t('paymentDate')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('paymentAmount')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('paymentMethod')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('paymentReference')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.paid_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-foreground">
                      {formatSAR(Number(p.amount) || 0, locale)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tBill(`detail.methods.${p.method}`)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.reference_number ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
