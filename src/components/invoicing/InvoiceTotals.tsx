'use client'

/**
 * Invoice totals panel (Task 58).
 * Renders subtotal / VAT / grand total with locale-aware SAR formatting.
 */

import { useTranslations } from 'next-intl'

import type { CalcInvoiceTotals } from '@/lib/invoicing/calculations'

interface InvoiceTotalsProps {
  totals: CalcInvoiceTotals
  locale?: 'ar' | 'en'
}

function formatSar(amount: number, locale: 'ar' | 'en'): string {
  try {
    return amount.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
    })
  } catch {
    return `${amount.toFixed(2)} SAR`
  }
}

export function InvoiceTotals({ totals, locale = 'en' }: InvoiceTotalsProps) {
  const t = useTranslations('invoicing.invoices.totals')

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <h3 className="text-sm font-semibold mb-3">{t('title')}</h3>
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">{t('subtotal')}</dt>
          <dd className="tabular-nums">{formatSar(totals.subtotal, locale)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">{t('vat')}</dt>
          <dd className="tabular-nums">{formatSar(totals.total_vat, locale)}</dd>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border font-semibold">
          <dt>{t('grandTotal')}</dt>
          <dd className="tabular-nums">{formatSar(totals.total_amount, locale)}</dd>
        </div>
      </dl>
    </div>
  )
}
