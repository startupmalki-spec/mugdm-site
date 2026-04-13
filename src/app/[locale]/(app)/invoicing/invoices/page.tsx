'use client'

/**
 * Invoices list page (Task 60).
 *
 * Client component. Consumes GET /api/invoicing/invoices with the extended
 * filter params (q, status CSV, invoice_type, from, to, include=customer) and
 * the existing (businessId, page, pageSize). Provides:
 *
 *   - Filter toolbar (search / status / type / date range)
 *   - Bulk actions (Submit, Delete, Export CSV)
 *   - Row actions dropdown (View / Edit / Submit / Delete / Download XML)
 *   - Locale-aware date + currency formatting (ar-SA / en-US, SAR)
 *   - Pagination with page size selector (20 / 50 / 100)
 *
 * UX notes:
 *   - The `source='imported_xml'` state is surfaced as a small "Imported"
 *     chip rendered inline next to the B2B/B2C type pill, so the type column
 *     answers both "what kind of invoice" and "where did it originate".
 *   - Row-level bulk actions only enable when every selected row is a draft.
 *   - Submit-selected uses a concurrency-limited promise pool (limit = 3) so
 *     we don't thrash the ZATCA submit endpoint from a single click.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Plus,
  Search,
  Loader2,
  MoreHorizontal,
  Download,
  Trash2,
  Send,
  Eye,
  Pencil,
  X,
  FileText,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBusiness } from '@/lib/business-context'
import type {
  Invoice,
  InvoiceType,
  InvoiceSource,
  InvoiceSubtype,
  ZatcaStatus,
} from '@/lib/supabase/types'

// ---------- Types ----------------------------------------------------------

interface CustomerLite {
  id: string
  name: string
  name_en: string | null
  vat_number: string | null
}

interface InvoiceRow extends Invoice {
  customer?: CustomerLite | null
}

interface ListResponse {
  invoices: InvoiceRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type StatusFilter = 'all' | ZatcaStatus
type TypeFilter = 'all' | InvoiceType

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

// ---------- Helpers --------------------------------------------------------

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

function formatDate(iso: string, locale: string): string {
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

function csvEscape(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Simple concurrency-limited promise pool. */
async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++
      if (idx >= items.length) return
      out[idx] = await worker(items[idx], idx)
    }
  })
  await Promise.all(runners)
  return out
}

// ---------- Small presentational bits --------------------------------------

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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {t(`status.${status}`)}
    </span>
  )
}

function TypePill({
  type,
  source,
  subtype,
  t,
}: {
  type: InvoiceType
  source: InvoiceSource
  subtype: InvoiceSubtype
  t: (k: string) => string
}) {
  const typeLabel =
    type === 'standard' ? t('typePill.standard') : t('typePill.simplified')
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
          type === 'standard'
            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
            : 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400'
        }`}
      >
        {typeLabel}
      </span>
      {subtype === 'credit_note' && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-rose-500/15 text-rose-600 dark:text-rose-400">
          {t('typePill.creditNote')}
        </span>
      )}
      {subtype === 'debit_note' && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
          {t('typePill.debitNote')}
        </span>
      )}
      {source === 'imported_xml' && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-border">
          {t('typePill.imported')}
        </span>
      )}
    </div>
  )
}

// ---------- Page -----------------------------------------------------------

export default function InvoicesListPage() {
  const t = useTranslations('invoicing.invoices.list')
  const { locale } = useParams<{ locale: string }>()
  const { businessId, isLoading: bizLoading } = useBusiness()

  // Filters
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Paging
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(20)

  // Data
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selection
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => {
      setDebouncedQ(q.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(h)
  }, [q])

  // Reset page on filter changes
  useEffect(() => {
    setPage(1)
  }, [statusFilter, typeFilter, dateFrom, dateTo, pageSize])

  const fetchPage = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        pageSize: String(pageSize),
        include: 'customer',
      })
      if (debouncedQ) params.set('q', debouncedQ)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('invoice_type', typeFilter)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)

      const res = await fetch(`/api/invoicing/invoices?${params.toString()}`)
      const body = (await res.json().catch(() => ({}))) as
        | ListResponse
        | { error?: { ar?: string; en?: string } }
      if (!res.ok) {
        const err = (body as { error?: { ar?: string; en?: string } }).error
        setError((locale === 'ar' ? err?.ar : err?.en) ?? t('errors.loadFailed'))
        setData(null)
        return
      }
      setData(body as ListResponse)
      // Prune selections that fell off the visible page.
      setSelected((prev) => {
        const ids = new Set((body as ListResponse).invoices.map((i) => i.id))
        const next: Record<string, boolean> = {}
        for (const k of Object.keys(prev)) if (ids.has(k) && prev[k]) next[k] = true
        return next
      })
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [
    businessId,
    page,
    pageSize,
    debouncedQ,
    statusFilter,
    typeFilter,
    dateFrom,
    dateTo,
    locale,
    t,
  ])

  useEffect(() => {
    void fetchPage()
  }, [fetchPage])

  // Close any open row menu on outside click.
  const menuWrapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!openMenuId) return
    const handler = (e: MouseEvent) => {
      if (!menuWrapRef.current) {
        setOpenMenuId(null)
        return
      }
      if (!menuWrapRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenuId])

  // Derived
  const rows = data?.invoices ?? []
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  )
  const selectedRows = useMemo(
    () => rows.filter((r) => selected[r.id]),
    [rows, selected],
  )
  const allSelected =
    rows.length > 0 && rows.every((r) => selected[r.id])
  const someSelected = selectedIds.length > 0
  const allSelectedAreDrafts =
    someSelected && selectedRows.every((r) => r.zatca_status === 'draft')
  const totalPages = data?.totalPages ?? 0

  // ---------- Bulk actions -------------------------------------------------

  async function handleBulkSubmit() {
    if (!allSelectedAreDrafts || bulkBusy) return
    setBulkBusy(true)
    try {
      await runPool(selectedIds, 3, async (id) => {
        try {
          await fetch(`/api/invoicing/invoices/${id}/submit`, {
            method: 'POST',
          })
        } catch {
          /* swallow; refetch will reveal the real status */
        }
      })
      setSelected({})
      await fetchPage()
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleBulkDelete() {
    if (!allSelectedAreDrafts || bulkBusy) return
    setBulkBusy(true)
    setConfirmDelete(false)
    try {
      await runPool(selectedIds, 3, async (id) => {
        try {
          await fetch(`/api/invoicing/invoices/${id}`, { method: 'DELETE' })
        } catch {
          /* ignore; refetch reconciles */
        }
      })
      setSelected({})
      await fetchPage()
    } finally {
      setBulkBusy(false)
    }
  }

  function handleExportCsv() {
    const targets = someSelected ? selectedRows : rows
    if (targets.length === 0) return
    const header = [
      t('cols.invoiceNumber'),
      t('cols.issueDate'),
      t('cols.customer'),
      t('cols.customerVat'),
      t('cols.type'),
      t('cols.source'),
      t('cols.zatcaStatus'),
      t('cols.total'),
    ]
    const lines = [header.map(csvEscape).join(',')]
    for (const r of targets) {
      const customerName =
        r.customer?.name_en || r.customer?.name || ''
      lines.push(
        [
          r.invoice_number,
          r.issue_date,
          customerName,
          r.customer?.vat_number ?? '',
          r.invoice_type,
          r.source,
          r.zatca_status,
          r.total_amount,
        ]
          .map(csvEscape)
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function downloadXml(row: InvoiceRow) {
    if (!row.zatca_xml) return
    const blob = new Blob([row.zatca_xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${row.invoice_number}.xml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleRowSubmit(id: string) {
    try {
      await fetch(`/api/invoicing/invoices/${id}/submit`, { method: 'POST' })
    } finally {
      await fetchPage()
    }
  }
  async function handleRowDelete(id: string) {
    if (!window.confirm(t('confirm.deleteOne'))) return
    try {
      await fetch(`/api/invoicing/invoices/${id}`, { method: 'DELETE' })
    } finally {
      await fetchPage()
    }
  }

  // ---------- Render -------------------------------------------------------

  const showingEmpty =
    !loading && !error && businessId && data && rows.length === 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}/invoicing/invoices/new-simplified`}>
            <Button variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              {t('cta.newSimplified')}
            </Button>
          </Link>
          <Link href={`/${locale}/invoicing/invoices/new`}>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t('cta.newStandard')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <div className="relative md:col-span-2">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('filters.searchPlaceholder')}
            className="ps-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="all">{t('filters.statusAll')}</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="pending_clearance">{t('status.pending_clearance')}</option>
          <option value="cleared">{t('status.cleared')}</option>
          <option value="reported">{t('status.reported')}</option>
          <option value="rejected">{t('status.rejected')}</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="all">{t('filters.typeAll')}</option>
          <option value="standard">{t('typePill.standard')}</option>
          <option value="simplified">{t('typePill.simplified')}</option>
        </select>
        <div className="flex gap-2">
          <Input
            type="date"
            aria-label={t('filters.dateFrom')}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            type="date"
            aria-label={t('filters.dateTo')}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-1 p-2">
          <span className="text-sm text-muted-foreground px-2">
            {t('bulk.selected', { count: selectedIds.length })}
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleExportCsv}
          >
            <Download className="w-3.5 h-3.5" />
            {t('bulk.exportCsv')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={!allSelectedAreDrafts || bulkBusy}
            onClick={handleBulkSubmit}
          >
            <Send className="w-3.5 h-3.5" />
            {bulkBusy ? t('bulk.working') : t('bulk.submit')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-destructive"
            disabled={!allSelectedAreDrafts || bulkBusy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('bulk.delete')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected({})}
            aria-label={t('bulk.clear')}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* States */}
      {bizLoading || (!businessId && !error) ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !businessId ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          {t('noBusiness')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : loading && !data ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : showingEmpty ? (
        <div className="rounded-lg border border-border p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-1">{t('empty.title')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {debouncedQ ||
            statusFilter !== 'all' ||
            typeFilter !== 'all' ||
            dateFrom ||
            dateTo
              ? t('empty.noMatches')
              : t('empty.body')}
          </p>
          <div className="flex justify-center gap-2">
            <Link href={`/${locale}/invoicing/invoices/new`}>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t('cta.newStandard')}
              </Button>
            </Link>
            <Link href={`/${locale}/invoicing/invoices/new-simplified`}>
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                {t('cta.newSimplified')}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border" ref={menuWrapRef}>
          <table className="w-full text-sm">
            <thead className="bg-surface-1 text-muted-foreground">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label={t('bulk.selectAll')}
                    checked={allSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const next: Record<string, boolean> = {}
                        for (const r of rows) next[r.id] = true
                        setSelected(next)
                      } else {
                        setSelected({})
                      }
                    }}
                  />
                </th>
                <th className="text-start px-4 py-3 font-medium">{t('cols.invoiceNumber')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('cols.issueDate')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('cols.customer')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('cols.type')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('cols.zatcaStatus')}</th>
                <th className="text-end px-4 py-3 font-medium">{t('cols.total')}</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isDraft = r.zatca_status === 'draft'
                const hasXml = !!r.zatca_xml
                const customerName =
                  (locale === 'ar' ? r.customer?.name : r.customer?.name_en || r.customer?.name) ||
                  (r.invoice_type === 'simplified' ? t('walkIn') : '—')
                return (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-surface-1/50"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={t('bulk.selectRow')}
                        checked={!!selected[r.id]}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [r.id]: e.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/${locale}/invoicing/invoices/${r.id}`}
                        className="text-primary hover:underline"
                      >
                        {r.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatDate(r.issue_date, locale)}</td>
                    <td className="px-4 py-3">{customerName}</td>
                    <td className="px-4 py-3">
                      <TypePill
                        type={r.invoice_type}
                        source={r.source}
                        subtype={r.invoice_subtype}
                        t={t}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.zatca_status} t={t} />
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">
                      {formatSar(Number(r.total_amount), locale)}
                    </td>
                    <td className="px-2 py-3 text-end relative">
                      <button
                        type="button"
                        aria-label={t('actions.menu')}
                        className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-surface-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === r.id ? null : r.id)
                        }}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenuId === r.id && (
                        <div
                          role="menu"
                          className="absolute end-2 mt-1 z-20 min-w-[180px] rounded-md border border-border bg-background shadow-lg py-1"
                        >
                          <Link
                            href={`/${locale}/invoicing/invoices/${r.id}`}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-1"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t('actions.view')}
                          </Link>
                          <button
                            type="button"
                            disabled={!isDraft}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-1 disabled:opacity-50 disabled:cursor-not-allowed text-start"
                            onClick={() => {
                              setOpenMenuId(null)
                              if (isDraft) {
                                window.location.href = `/${locale}/invoicing/invoices/${r.id}/edit`
                              }
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {t('actions.edit')}
                          </button>
                          <button
                            type="button"
                            disabled={!isDraft}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-1 disabled:opacity-50 disabled:cursor-not-allowed text-start"
                            onClick={() => {
                              setOpenMenuId(null)
                              if (isDraft) void handleRowSubmit(r.id)
                            }}
                          >
                            <Send className="w-3.5 h-3.5" />
                            {t('actions.submit')}
                          </button>
                          <button
                            type="button"
                            disabled={!hasXml}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-1 disabled:opacity-50 disabled:cursor-not-allowed text-start"
                            onClick={() => {
                              setOpenMenuId(null)
                              if (hasXml) downloadXml(r)
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                            {t('actions.downloadXml')}
                          </button>
                          <button
                            type="button"
                            disabled={!isDraft}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-1 disabled:opacity-50 disabled:cursor-not-allowed text-destructive text-start"
                            onClick={() => {
                              setOpenMenuId(null)
                              if (isDraft) void handleRowDelete(r.id)
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('actions.delete')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination + page size */}
      {data && rows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {t('pagination.summary', {
                page: data.page,
                totalPages: Math.max(totalPages, 1),
                total: data.total,
              })}
            </span>
            <label className="flex items-center gap-2 text-muted-foreground">
              {t('pagination.pageSize')}
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('pagination.prev')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('pagination.next')}
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-2">
              {t('confirm.bulkDeleteTitle')}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t('confirm.bulkDeleteBody', { count: selectedIds.length })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={bulkBusy}
              >
                {t('confirm.cancel')}
              </Button>
              <Button
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={handleBulkDelete}
                disabled={bulkBusy}
              >
                {bulkBusy ? t('bulk.working') : t('confirm.deleteConfirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
