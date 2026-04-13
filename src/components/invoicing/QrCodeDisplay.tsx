'use client'

/**
 * Client-side QR code renderer (Task 61).
 *
 * `generateQrCodeImage` is async and runs Node's QR encoder; we don't want it
 * in the client bundle. Instead this component fetches a small JSON endpoint
 * (`GET /api/invoicing/invoices/[id]/qr`) that returns the `data:` URL, then
 * renders it in an <img>. The TLV payload itself is never exposed in HTML —
 * only the rendered PNG.
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

interface QrCodeDisplayProps {
  invoiceId: string
  size?: number
}

type QrState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; dataUrl: string }

export function QrCodeDisplay({ invoiceId, size = 256 }: QrCodeDisplayProps) {
  const t = useTranslations('invoicing.invoices.detail.qr')
  const [state, setState] = useState<QrState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on invoiceId change before fetch
    setState({ status: 'loading' })
    fetch(`/api/invoicing/invoices/${invoiceId}/qr`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          dataUrl?: string
          error?: { ar?: string; en?: string }
        }
        if (cancelled) return
        if (!res.ok || !body.dataUrl) {
          setState({ status: 'error', message: body.error?.en ?? t('error') })
          return
        }
        setState({ status: 'ok', dataUrl: body.dataUrl })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: t('error') })
      })
    return () => {
      cancelled = true
    }
  }, [invoiceId, t])

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 flex flex-col items-center gap-2">
      <h3 className="text-sm font-semibold self-start">{t('title')}</h3>
      <div
        className="flex items-center justify-center bg-white rounded-md"
        style={{ width: size, height: size }}
      >
        {state.status === 'ok' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.dataUrl}
            alt={t('alt')}
            width={size}
            height={size}
            className="w-full h-full"
          />
        ) : state.status === 'error' ? (
          <span className="text-xs text-destructive p-2 text-center">{state.message}</span>
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">{t('hint')}</p>
    </div>
  )
}
