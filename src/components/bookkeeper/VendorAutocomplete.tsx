'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Plus, Search, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Vendor } from '@/lib/supabase/types'

export interface VendorLite {
  id: string
  name_ar: string | null
  name_en: string | null
  vat_number: string | null
}

interface Props {
  businessId: string
  value: VendorLite | null
  onChange: (vendor: VendorLite | null) => void
  /** Prefill for inline-create when user picked a fresh vendor (e.g. from OCR). */
  suggestedName?: string | null
  suggestedVatNumber?: string | null
  disabled?: boolean
}

function vendorLabel(v: VendorLite, locale: string): string {
  const ar = v.name_ar
  const en = v.name_en
  if (locale === 'ar') return ar || en || '—'
  return en || ar || '—'
}

/**
 * Searches existing vendors via GET /api/vendors?businessId=&q= and allows
 * inline creation via POST /api/vendors. Kept intentionally simple — a
 * text input with a dropdown of matches and an "add new" affordance.
 */
export default function VendorAutocomplete({
  businessId,
  value,
  onChange,
  suggestedName,
  suggestedVatNumber,
  disabled,
}: Props) {
  const t = useTranslations('bookkeeper.bills.form')
  const locale = useLocale()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VendorLite[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createName, setCreateName] = useState('')
  const [createVat, setCreateVat] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const displayValue = useMemo(
    () => (value ? vendorLabel(value, locale) : ''),
    [value, locale],
  )

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams({ businessId, limit: '20' })
        if (query.trim()) params.set('q', query.trim())
        const res = await fetch(`/api/vendors?${params.toString()}`)
        if (!res.ok) {
          setResults([])
          return
        }
        const json = (await res.json()) as { vendors?: Vendor[] }
        setResults(
          (json.vendors ?? []).map((v) => ({
            id: v.id,
            name_ar: v.name_ar,
            name_en: v.name_en,
            vat_number: v.vat_number,
          })),
        )
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, businessId])

  const openInlineCreate = () => {
    setShowCreate(true)
    setCreateError(null)
    setCreateName(query.trim() || suggestedName?.trim() || '')
    setCreateVat(suggestedVatNumber?.trim() || '')
  }

  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError(t('errors.vendorNameRequired'))
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      // Heuristic: if the name is mostly Arabic letters, treat as Arabic.
      const isArabic = /[\u0600-\u06FF]/.test(createName)
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          name_ar: isArabic ? createName.trim() : null,
          name_en: isArabic ? null : createName.trim(),
          vat_number: createVat.trim() || null,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        vendor?: Vendor
        error?: { ar?: string; en?: string }
      }
      if (!res.ok || !json.vendor) {
        const msg = locale === 'ar' ? json.error?.ar : json.error?.en
        setCreateError(msg || t('errors.vendorCreateFailed'))
        return
      }
      const created: VendorLite = {
        id: json.vendor.id,
        name_ar: json.vendor.name_ar,
        name_en: json.vendor.name_en,
        vat_number: json.vendor.vat_number,
      }
      onChange(created)
      setOpen(false)
      setShowCreate(false)
      setQuery('')
    } catch {
      setCreateError(t('errors.vendorCreateFailed'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
        <input
          type="text"
          value={open ? query : displayValue}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setOpen(true)
            setShowCreate(false)
            setQuery(e.target.value)
            if (value) onChange(null)
          }}
          placeholder={t('vendorPlaceholder')}
          disabled={disabled}
          className={cn(
            'w-full rounded-lg border border-border bg-surface-1 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3 disabled:opacity-60',
          )}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {!showCreate && (
            <>
              <div className="max-h-64 overflow-y-auto">
                {searching ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t('searching')}
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted-foreground">
                    {t('noVendors')}
                  </div>
                ) : (
                  results.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        onChange(v)
                        setOpen(false)
                        setQuery('')
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-foreground hover:bg-surface-2"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{vendorLabel(v, locale)}</span>
                      {v.vat_number && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {v.vat_number}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={openInlineCreate}
                className="flex w-full items-center gap-2 border-t border-border bg-surface-1 px-3 py-2 text-sm font-medium text-primary hover:bg-surface-2"
              >
                <Plus className="h-4 w-4" />
                {t('addVendor')}
                {query.trim() && <span className="text-muted-foreground">"{query.trim()}"</span>}
              </button>
            </>
          )}

          {showCreate && (
            <div className="space-y-2 p-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t('vendorName')}
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-1 px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t('vendorVatOptional')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={createVat}
                  onChange={(e) => setCreateVat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-1 px-3 py-1.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
                  dir="ltr"
                />
              </div>
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground hover:bg-surface-3"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {t('createVendor')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
