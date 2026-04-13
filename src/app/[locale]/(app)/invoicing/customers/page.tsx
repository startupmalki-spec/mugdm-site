'use client'

/**
 * Customers list page (Task 57).
 *
 * Server-paginated, server-searched listing for the currently selected
 * business. Pulls `businessId` from the global business context so users with
 * multiple businesses see the correct list automatically.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Search, Loader2, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBusiness } from '@/lib/business-context'
import type { Customer } from '@/lib/supabase/types'

interface ListResponse {
  customers: Customer[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const PAGE_SIZE = 20

export default function CustomersListPage() {
  const t = useTranslations('invoicing.customers')
  const { locale } = useParams<{ locale: string }>()
  const { businessId, isLoading: bizLoading } = useBusiness()

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounce the search input so we don't spam the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const fetchPage = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (debouncedQ) params.set('q', debouncedQ)
      const res = await fetch(`/api/customers?${params.toString()}`)
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
    } catch {
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [businessId, page, debouncedQ, locale, t])

  useEffect(() => {
    void fetchPage()
  }, [fetchPage])

  const totalPages = data?.totalPages ?? 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link href={`/${locale}/invoicing/customers/new`}>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t('addCustomer')}
          </Button>
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="ps-9"
        />
      </div>

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
      ) : loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.customers.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          {debouncedQ ? t('noResults') : t('empty')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 text-muted-foreground">
              <tr>
                <th className="text-start px-4 py-3 font-medium">{t('cols.name')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('cols.vat')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('cols.cr')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('cols.city')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('cols.phone')}</th>
                <th className="text-end px-4 py-3 font-medium">{t('cols.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-surface-1/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    {c.name_en && (
                      <div className="text-xs text-muted-foreground">{c.name_en}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.vat_number ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.cr_number ?? '—'}</td>
                  <td className="px-4 py-3">{c.city ?? '—'}</td>
                  <td className="px-4 py-3">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={`/${locale}/invoicing/customers/${c.id}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t('actions.edit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">
            {t('pagination.summary', {
              page: data!.page,
              totalPages,
              total: data!.total,
            })}
          </span>
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
    </div>
  )
}
