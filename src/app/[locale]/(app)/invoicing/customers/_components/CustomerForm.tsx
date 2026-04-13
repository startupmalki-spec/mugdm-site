'use client'

/**
 * Shared customer form used by /customers/new and /customers/[id].
 *
 * The "Lookup via Wathq" button calls /api/wathq/lookup and auto-fills the
 * trade name (AR/EN), CR number, city, and VAT number when the upstream
 * Wathq response includes them. When WATHQ_API_KEY is unset the API returns
 * 503 NOT_CONFIGURED and we surface a graceful inline error.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isValidCRNumber, isValidSaudiVat } from '@/lib/validations'

export interface CustomerFormValues {
  name: string
  name_en: string
  vat_number: string
  cr_number: string
  address: string
  city: string
  phone: string
  email: string
}

export const EMPTY_CUSTOMER: CustomerFormValues = {
  name: '',
  name_en: '',
  vat_number: '',
  cr_number: '',
  address: '',
  city: '',
  phone: '',
  email: '',
}

interface Props {
  initial: CustomerFormValues
  submitLabel: string
  onSubmit: (values: CustomerFormValues) => Promise<void>
  busy?: boolean
  error?: string | null
  onCancel?: () => void
}

export function CustomerForm({
  initial,
  submitLabel,
  onSubmit,
  busy,
  error,
  onCancel,
}: Props) {
  const t = useTranslations('invoicing.customers')
  const [values, setValues] = useState<CustomerFormValues>(initial)
  const [localError, setLocalError] = useState<string | null>(null)
  const [wathqBusy, setWathqBusy] = useState(false)

  const set = <K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (!values.name.trim()) {
      setLocalError(t('errors.nameRequired'))
      return
    }
    if (values.vat_number && !isValidSaudiVat(values.vat_number)) {
      setLocalError(t('errors.invalidVat'))
      return
    }
    if (values.cr_number && !isValidCRNumber(values.cr_number)) {
      setLocalError(t('errors.invalidCr'))
      return
    }
    await onSubmit(values)
  }

  const handleWathq = async () => {
    setLocalError(null)
    const cr = values.cr_number.replace(/\s/g, '')
    if (!isValidCRNumber(cr)) {
      setLocalError(t('errors.invalidCr'))
      return
    }
    setWathqBusy(true)
    try {
      const res = await fetch('/api/wathq/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cr_number: cr }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        code?: string
        message?: string
        customer?: {
          name?: string
          name_en?: string
          cr_number?: string
          vat_number?: string
          city?: string
        }
      }
      if (!res.ok || !json.ok || !json.customer) {
        const code = json.code ?? 'UPSTREAM_ERROR'
        const known = new Set([
          'NOT_CONFIGURED',
          'INVALID_CR',
          'NOT_FOUND',
          'UNAUTHORIZED',
          'RATE_LIMITED',
          'UPSTREAM_ERROR',
          'TIMEOUT',
          'NETWORK_ERROR',
        ])
        const key = known.has(code) ? code : 'UPSTREAM_ERROR'
        setLocalError(t(`wathqErrors.${key}` as 'wathqErrors.UPSTREAM_ERROR'))
        return
      }
      const c = json.customer
      setValues((v) => ({
        ...v,
        name: c.name?.trim() ? c.name : v.name,
        name_en: c.name_en?.trim() ? c.name_en : v.name_en,
        cr_number: c.cr_number?.trim() ? c.cr_number : v.cr_number,
        city: c.city?.trim() ? c.city : v.city,
        vat_number: c.vat_number?.trim() ? c.vat_number : v.vat_number,
      }))
    } catch {
      setLocalError(t('wathqErrors.NETWORK_ERROR'))
    } finally {
      setWathqBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t('fields.name')} required>
          <Input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </Field>
        <Field label={t('fields.nameEn')}>
          <Input
            value={values.name_en}
            onChange={(e) => set('name_en', e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label={t('fields.vat')} hint={t('fields.vatHint')}>
          <Input
            value={values.vat_number}
            onChange={(e) => set('vat_number', e.target.value)}
            inputMode="numeric"
            maxLength={15}
            dir="ltr"
            placeholder="3XXXXXXXXXXXXX3"
          />
        </Field>
        <Field label={t('fields.cr')} hint={t('fields.crHint')}>
          <div className="flex gap-2">
            <Input
              value={values.cr_number}
              onChange={(e) => set('cr_number', e.target.value)}
              inputMode="numeric"
              maxLength={10}
              dir="ltr"
              placeholder="1010XXXXXX"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleWathq}
              disabled={wathqBusy || busy}
              className="gap-1.5 shrink-0"
              title={t('wathqLookup')}
            >
              {wathqBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              {wathqBusy ? t('wathqLooking') : t('wathqLookup')}
            </Button>
          </div>
        </Field>
        <Field label={t('fields.address')}>
          <Input
            value={values.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </Field>
        <Field label={t('fields.city')}>
          <Input
            value={values.city}
            onChange={(e) => set('city', e.target.value)}
          />
        </Field>
        <Field label={t('fields.phone')}>
          <Input
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            dir="ltr"
            inputMode="tel"
            placeholder="+9665XXXXXXXX"
          />
        </Field>
        <Field label={t('fields.email')}>
          <Input
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            dir="ltr"
          />
        </Field>
      </div>

      {(localError || error) && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {localError ?? error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {t('actions.cancel')}
          </Button>
        )}
        <Button type="submit" disabled={busy} className="gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-destructive ms-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground mt-1">{hint}</span>}
    </label>
  )
}
