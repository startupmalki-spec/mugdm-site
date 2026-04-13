'use client'

/**
 * Edit-customer page (Task 57). Loads the customer via GET /api/customers/[id],
 * updates via PATCH, and supports deletion with a confirmation dialog.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, Trash2, Loader2, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Customer } from '@/lib/supabase/types'
import {
  CustomerForm,
  EMPTY_CUSTOMER,
  type CustomerFormValues,
} from '../_components/CustomerForm'

function toFormValues(c: Customer): CustomerFormValues {
  return {
    name: c.name ?? '',
    name_en: c.name_en ?? '',
    vat_number: c.vat_number ?? '',
    cr_number: c.cr_number ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
  }
}

export default function EditCustomerPage() {
  const t = useTranslations('invoicing.customers')
  const router = useRouter()
  const { locale, id } = useParams<{ locale: string; id: string }>()

  const [initial, setInitial] = useState<CustomerFormValues | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const errMsg = useCallback(
    (err?: { ar?: string; en?: string }) =>
      (locale === 'ar' ? err?.ar : err?.en) ?? null,
    [locale],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/customers/${id}`)
        const body = (await res.json().catch(() => ({}))) as {
          customer?: Customer
          error?: { ar?: string; en?: string }
        }
        if (cancelled) return
        if (!res.ok || !body.customer) {
          setLoadError(errMsg(body.error) ?? t('errors.loadFailed'))
          return
        }
        setInitial(toFormValues(body.customer))
      } catch {
        if (!cancelled) setLoadError(t('errors.loadFailed'))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, t, errMsg])

  async function handleSubmit(values: CustomerFormValues) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const body = (await res.json().catch(() => ({}))) as {
        customer?: Customer
        error?: { ar?: string; en?: string }
      }
      if (!res.ok) {
        setError(errMsg(body.error) ?? t('errors.saveFailed'))
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

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { ar?: string; en?: string }
      }
      if (!res.ok) {
        setError(errMsg(body.error) ?? t('errors.deleteFailed'))
        setDeleting(false)
        setConfirmOpen(false)
        return
      }
      router.push(`/${locale}/invoicing/customers`)
      router.refresh()
    } catch {
      setError(t('errors.deleteFailed'))
      setDeleting(false)
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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">{t('editTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('editSubtitle')}</p>
        </div>
        {initial && (
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            {t('actions.delete')}
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface-1 p-6 min-h-[300px]">
        {loadError ? (
          <div className="text-sm text-destructive">{loadError}</div>
        ) : !initial ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CustomerForm
            initial={initial ?? EMPTY_CUSTOMER}
            submitLabel={t('actions.save')}
            onSubmit={handleSubmit}
            busy={busy}
            error={error}
            onCancel={() => router.push(`/${locale}/invoicing/customers`)}
          />
        )}
      </div>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-1 border border-border rounded-xl p-6 w-[90vw] max-w-md z-50 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold">
                  {t('deleteConfirm.title')}
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground mt-1">
                  {t('deleteConfirm.body')}
                </Dialog.Description>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
              >
                {t('actions.cancel')}
              </Button>
              <Button
                variant="default"
                onClick={handleDelete}
                disabled={deleting}
                className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('actions.confirmDelete')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
