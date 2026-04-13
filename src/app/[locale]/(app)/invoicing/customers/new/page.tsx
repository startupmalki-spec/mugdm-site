'use client'

/**
 * Create-customer page (Task 57). Posts to /api/customers and returns to the
 * list on success.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'

import { useBusiness } from '@/lib/business-context'
import {
  CustomerForm,
  EMPTY_CUSTOMER,
  type CustomerFormValues,
} from '../_components/CustomerForm'

export default function NewCustomerPage() {
  const t = useTranslations('invoicing.customers')
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const { businessId } = useBusiness()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(values: CustomerFormValues) {
    if (!businessId) {
      setError(t('noBusiness'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, ...values }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        customer?: { id: string }
        error?: { ar?: string; en?: string }
      }
      if (!res.ok) {
        const err = body.error
        setError((locale === 'ar' ? err?.ar : err?.en) ?? t('errors.saveFailed'))
        return
      }
      router.push(`/${locale}/invoicing/customers`)
      router.refresh()
    } catch {
      setError(t('errors.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/${locale}/invoicing/customers`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        {t('backToList')}
      </Link>

      <h1 className="text-2xl font-bold mb-1">{t('newTitle')}</h1>
      <p className="text-sm text-muted-foreground mb-6">{t('newSubtitle')}</p>

      <div className="rounded-xl border border-border bg-surface-1 p-6">
        <CustomerForm
          initial={EMPTY_CUSTOMER}
          submitLabel={t('actions.save')}
          onSubmit={handleSubmit}
          busy={busy}
          error={error}
          onCancel={() => router.push(`/${locale}/invoicing/customers`)}
        />
      </div>
    </div>
  )
}
