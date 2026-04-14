'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Plus, Search, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BillStatus, Vendor } from '@/lib/supabase/types'

export interface BillRow {
  id: string
  bill_number: string | null
  issue_date: string
  due_date: string
  subtotal: number
  vat_amount: number
  total: number
  currency: string
  status: BillStatus
  vendor_id: string
  vendor_name_ar: string | null
  vendor_name_en: string | null
}

type VendorOption = Pick<Vendor, 'id' | 'name_ar' | 'name_en'>

interface Props {
  bills: BillRow[]
  vendors: VendorOption[]
}

const ALL_STATUSES: BillStatus[] = [
  'draft',
  'pending',
  'approved',
  'paid',
  'overdue',
  'void',
]

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

function vendorName(v: VendorOption | BillRow, locale: string): string {
  const ar =
    'name_ar' in v
      ? v.name_ar
      : (v as BillRow).vendor_name_ar
  const en =
    'name_en' in v
      ? v.name_en
      : (v as BillRow).vendor_name_en
  if (locale === 'ar') return ar || en || '—'
  return en || ar || '—'
}

export default function BillsList({ bills, vendors }: Props) {
  const t = useTranslations('bookkeeper.bills')
  const locale = useLocale()

  const [search, setSearch] = useState('')
  const [vendorFilter, setVendorFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<Set<BillStatus>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const min = amountMin ? Number(amountMin) : null
    const max = amountMax ? Number(amountMax) : null

    const rows = bills.filter((b) => {
      if (vendorFilter && b.vendor_id !== vendorFilter) return false
      if (statusFilter.size > 0 && !statusFilter.has(b.status)) return false
      if (dateFrom && b.due_date < dateFrom) return false
      if (dateTo && b.due_date > dateTo) return false
      if (min !== null && b.total < min) return false
      if (max !== null && b.total > max) return false
      if (q) {
        const vn = vendorName(b, locale).toLowerCase()
        const bn = (b.bill_number ?? '').toLowerCase()
        if (!vn.includes(q) && !bn.includes(q)) return false
      }
      return true
    })

    // Default sort: overdue first, then due_date asc.
    rows.sort((a, b) => {
      const aOver = a.status === 'overdue' || (a.due_date < today && a.status !== 'paid' && a.status !== 'void')
      const bOver = b.status === 'overdue' || (b.due_date < today && b.status !== 'paid' && b.status !== 'void')
      if (aOver !== bOver) return aOver ? -1 : 1
      return a.due_date.localeCompare(b.due_date)
    })

    return rows
  }, [bills, search, vendorFilter, statusFilter, dateFrom, dateTo, amountMin, amountMax, locale, today])

  const toggleStatus = (s: BillStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/bookkeeper/bills/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t('addBill')}
        </Link>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-lg border border-border bg-surface-0 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
            />
          </div>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-foreground"
          >
            <option value="">{t('allVendors')}</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {vendorName(v, locale)}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  statusFilter.has(s)
                    ? statusBadgeClass(s)
                    : 'border-border bg-surface-0 text-muted-foreground hover:text-foreground'
                )}
              >
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">{t('dueFrom')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t('dueTo')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t('amountMin')}</label>
            <input
              type="number"
              inputMode="decimal"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t('amountMax')}</label>
            <input
              type="number"
              inputMode="decimal"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-1.5 text-sm text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Table / Empty state */}
      {bills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-1 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">{t('emptyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptySubtitle')}</p>
          <Link
            href="/bookkeeper/bills/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            {t('addFirstBill')}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.vendor')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.billNumber')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.issueDate')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.dueDate')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.amount')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.vat')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columns.status')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('columns.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      {t('noMatches')}
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-2/60">
                      <td className="px-4 py-3 font-medium text-foreground">{vendorName(b, locale)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.bill_number ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.issue_date}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.due_date}</td>
                      <td className="px-4 py-3 text-end font-mono text-foreground">
                        {formatSAR(b.total, locale)}
                      </td>
                      <td className="px-4 py-3 text-end font-mono text-muted-foreground">
                        {formatSAR(b.vat_amount, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                            statusBadgeClass(b.status)
                          )}
                        >
                          {t(`status.${b.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          href={`/bookkeeper/bills/${b.id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {t('view')}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
