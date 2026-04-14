'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/lib/supabase/types'

const METHODS: PaymentMethod[] = [
  'bank_transfer',
  'cash',
  'card',
  'check',
  'other',
]

interface Props {
  billId: string
  defaultAmount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PaymentModal({
  billId,
  defaultAmount,
  open,
  onOpenChange,
}: Props) {
  const t = useTranslations('bookkeeper.bills.payment')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const [paidAt, setPaidAt] = useState<string>(
    new Date().toISOString().slice(0, 10),
  )
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer')
  const [amount, setAmount] = useState<string>(String(defaultAmount))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      let confirmation_attachment_key: string | null = null

      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('bucket', 'documents')
        fd.append('path', `bills/${billId}/payments`)
        const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!upRes.ok) {
          const j = (await upRes.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error ?? 'Upload failed')
        }
        const upJson = (await upRes.json()) as { path: string }
        confirmation_attachment_key = upJson.path
      }

      const res = await fetch(`/api/bills/${billId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paid_at: paidAt,
          amount: Number(amount),
          method,
          reference_number: reference || null,
          confirmation_attachment_key,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? 'Failed to record payment')
      }

      onOpenChange(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-1 p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">
                {t('title')}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {t('subtitle')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                aria-label={tCommon('close')}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t('paidAt')}
                </label>
                <input
                  type="date"
                  required
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t('amount')}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  required
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t('method')}
                </label>
                <select
                  value={method}
                  onChange={(e) =>
                    setMethod(e.target.value as PaymentMethod)
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-foreground"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(`methods.${m}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {t('reference')}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={t('referencePlaceholder')}
                  className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('confirmation')}
              </label>
              <label
                className={cn(
                  'mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-surface-0 px-3 py-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground',
                )}
              >
                <Upload className="h-4 w-4" />
                <span className="truncate">
                  {file ? file.name : t('confirmationPlaceholder')}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-foreground"
              />
            </div>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg border border-border bg-surface-0 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
                >
                  {tCommon('cancel')}
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('submit')}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
