'use client'

/**
 * Invoice preview modal (Task 58).
 *
 * Renders a print-friendly preview of the draft invoice using simple Tailwind
 * markup. Not pixel-perfect with the final PDF — just readable enough for the
 * user to confirm before submitting to ZATCA.
 */

import { useTranslations } from 'next-intl'
import { X, Printer } from 'lucide-react'

import type { Customer } from '@/lib/supabase/types'
import {
  calculateInvoiceTotals,
  calculateLine,
} from '@/lib/invoicing/calculations'
import type { EditableLineItem } from './LineItemsTable'

export interface InvoicePreviewData {
  invoiceNumberPlaceholder: string
  issueDate: string
  supplyDate?: string | null
  dueDate?: string | null
  paymentTerms?: string | null
  notes?: string | null
  sellerName: string
  sellerVat?: string | null
  customer: Customer | null
  lineItems: EditableLineItem[]
}

interface InvoicePreviewProps {
  open: boolean
  onClose: () => void
  data: InvoicePreviewData
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

export function InvoicePreview({
  open,
  onClose,
  data,
  locale = 'en',
}: InvoicePreviewProps) {
  const t = useTranslations('invoicing.invoices.preview')
  if (!open) return null

  const totals = calculateInvoiceTotals(data.lineItems)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white text-black rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto print:max-h-none print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between border-b p-4 print:hidden">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded border hover:bg-gray-50"
            >
              <Printer className="w-4 h-4" />
              {t('print')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-100"
              aria-label={t('close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t('heading')}</h1>
              <p className="text-sm text-gray-500">
                {data.invoiceNumberPlaceholder}
              </p>
            </div>
            <div className="text-end text-sm">
              <div>
                <span className="text-gray-500">{t('issueDate')}: </span>
                {data.issueDate}
              </div>
              {data.supplyDate && (
                <div>
                  <span className="text-gray-500">{t('supplyDate')}: </span>
                  {data.supplyDate}
                </div>
              )}
              {data.dueDate && (
                <div>
                  <span className="text-gray-500">{t('dueDate')}: </span>
                  {data.dueDate}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="text-xs uppercase text-gray-500 mb-1">
                {t('seller')}
              </h3>
              <div className="font-semibold">{data.sellerName}</div>
              {data.sellerVat && (
                <div className="text-gray-600">VAT: {data.sellerVat}</div>
              )}
            </div>
            <div>
              <h3 className="text-xs uppercase text-gray-500 mb-1">
                {t('buyer')}
              </h3>
              {data.customer ? (
                <>
                  <div className="font-semibold">{data.customer.name}</div>
                  {data.customer.vat_number && (
                    <div className="text-gray-600">
                      VAT: {data.customer.vat_number}
                    </div>
                  )}
                  {data.customer.address && (
                    <div className="text-gray-600">{data.customer.address}</div>
                  )}
                </>
              ) : (
                <div className="text-gray-500">{t('noBuyer')}</div>
              )}
            </div>
          </div>

          <table className="w-full text-sm border-t border-b">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2 pe-2">#</th>
                <th className="py-2 pe-2">{t('description')}</th>
                <th className="py-2 pe-2">{t('qty')}</th>
                <th className="py-2 pe-2">{t('unitPrice')}</th>
                <th className="py-2 pe-2">{t('vat')}</th>
                <th className="py-2 text-end">{t('lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((line, i) => {
                const r = calculateLine(line)
                return (
                  <tr key={i} className="border-t">
                    <td className="py-2 pe-2">{line.line_number}</td>
                    <td className="py-2 pe-2">
                      <div>{line.description}</div>
                      {line.description_en && (
                        <div className="text-gray-500">
                          {line.description_en}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pe-2 tabular-nums">{line.quantity}</td>
                    <td className="py-2 pe-2 tabular-nums">
                      {formatSar(line.unit_price, locale)}
                    </td>
                    <td className="py-2 pe-2 tabular-nums">
                      {formatSar(r.vat_amount, locale)} ({line.vat_rate}%)
                    </td>
                    <td className="py-2 text-end tabular-nums">
                      {formatSar(r.line_total, locale)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="flex justify-end">
            <dl className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">{t('subtotal')}</dt>
                <dd className="tabular-nums">
                  {formatSar(totals.subtotal, locale)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">{t('totalVat')}</dt>
                <dd className="tabular-nums">
                  {formatSar(totals.total_vat, locale)}
                </dd>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <dt>{t('grandTotal')}</dt>
                <dd className="tabular-nums">
                  {formatSar(totals.total_amount, locale)}
                </dd>
              </div>
            </dl>
          </div>

          {(data.paymentTerms || data.notes) && (
            <div className="text-sm space-y-2">
              {data.paymentTerms && (
                <div>
                  <span className="text-gray-500">{t('paymentTerms')}: </span>
                  {data.paymentTerms}
                </div>
              )}
              {data.notes && (
                <div>
                  <span className="text-gray-500">{t('notes')}: </span>
                  {data.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
