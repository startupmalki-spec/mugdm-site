'use client'

/**
 * BillsExportButton
 *
 * Client button that downloads the currently-filtered bills list as .xlsx.
 * Reads the same filter params the BillsList uses (status, vendor, from, to)
 * from the URL so the export matches what the user is looking at.
 *
 * Feature-flagged behind NEXT_PUBLIC_FEATURE_BILLS === 'true'.
 *
 * Drop into BillsList.tsx toolbar as:
 *   <BillsExportButton businessId={businessId} />
 */

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface BillsExportButtonProps {
  businessId: string
  className?: string
}

export function BillsExportButton({
  businessId,
  className,
}: BillsExportButtonProps) {
  const t = useTranslations('bookkeeper.bills.export')
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (process.env.NEXT_PUBLIC_FEATURE_BILLS !== 'true') {
    return null
  }

  const handleExport = async () => {
    setError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('businessId', businessId)

      // Forward known filter params from the current URL.
      const status = searchParams.get('status')
      const vendor = searchParams.get('vendor')
      const from = searchParams.get('from')
      const to = searchParams.get('to')
      if (status) params.set('status', status)
      if (vendor) params.set('vendor', vendor)
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const res = await fetch(`/api/bills/export?${params.toString()}`, {
        method: 'GET',
      })
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const a = document.createElement('a')
      a.href = url
      a.download = `bills-${today}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
      }
      aria-label={t('label')}
      title={error ?? t('tooltip')}
    >
      {loading ? t('loading') : t('label')}
    </button>
  )
}

export default BillsExportButton
