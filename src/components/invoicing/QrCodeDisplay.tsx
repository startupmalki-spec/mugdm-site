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

export function QrCodeDisplay({ invoiceId, size = 256 }: QrCodeDisplayProps) {
  const t = useTranslations('invoicing.invoices.detail.qr')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    setError(null)
    fetch(`/api/invoicing/invoices/${invoiceId}/qr`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          dataUrl?: string
          error?: { ar?: string; en?: string }
        }
        if (cancelled) return
        if (!res.ok || !body.dataUrl) {
          setError(body.error?.en ?? t('error'))
          return
        }
        setDataUrl(body.dataUrl)
      })
      .catch(() => {
        if (!cancelled) setError(t('error'))
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
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={t('alt')}
            width={size}
            height={size}
            className="w-full h-full"
          />
        ) : error ? (
          <span className="text-xs text-destructive p-2 text-center">{error}</span>
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">{t('hint')}</p>
    </div>
  )
}
