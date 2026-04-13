'use client'

/**
 * Invoicing → Import XML page (task 63).
 *
 * Minimal UI: file input → preview table → "Save to drafts".
 * Talks to:
 *   POST /api/invoicing/import       (parse + validate, no DB writes)
 *   POST /api/invoicing/import/save  (persist as draft)
 */

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2, FileCode2, Loader2, Save, Upload } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface BilingualMessage {
  ar: string
  en: string
}

interface ValidationError {
  field: string
  message: BilingualMessage
}

interface ParsedInvoiceHeader {
  invoice_number: string
  invoice_type: 'standard' | 'simplified'
  invoice_subtype: 'invoice' | 'credit_note' | 'debit_note'
  issue_date: string
  supply_date: string | null
  due_date: string | null
  subtotal: number
  total_vat: number
  total_amount: number
  zatca_uuid: string | null
  notes: string | null
}

interface ParsedLineItem {
  line_number: number
  description: string
  quantity: number
  unit_price: number
  discount_amount: number | null
  vat_rate: number
  vat_amount: number
  line_total: number
}

interface ParsedImported {
  invoice: ParsedInvoiceHeader
  lineItems: ParsedLineItem[]
  seller: { name: string | null; vatNumber: string | null; crNumber: string | null }
  buyer: {
    name: string | null
    vatNumber: string | null
    crNumber: string | null
    address: string | null
    city: string | null
    country: string | null
  }
}

interface ParseResponse {
  parsed?: ParsedImported
  valid?: boolean
  errors?: ValidationError[]
  error?: BilingualMessage
}

interface SaveResponse {
  invoiceId?: string
  error?: BilingualMessage
  errors?: ValidationError[]
}

export default function ImportInvoicePage() {
  const t = useTranslations('invoicing.import')
  const locale = useLocale()
  const lang: 'ar' | 'en' = locale === 'ar' ? 'ar' : 'en'

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [parsed, setParsed] = useState<ParsedImported | null>(null)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [fatalError, setFatalError] = useState<BilingualMessage | null>(null)
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setBusinessId((data as { id: string }).id)
        })
    })
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      if (!businessId) {
        setFatalError({
          ar: 'لم يتم العثور على نشاط تجاري.',
          en: 'No business found for current user.',
        })
        return
      }
      setFileName(file.name)
      setIsParsing(true)
      setParsed(null)
      setErrors([])
      setFatalError(null)
      setSavedInvoiceId(null)

      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(
          `/api/invoicing/import?businessId=${encodeURIComponent(businessId)}`,
          { method: 'POST', body: fd },
        )
        const json = (await res.json()) as ParseResponse

        if (!res.ok) {
          setFatalError(
            json.error ?? {
              ar: 'فشل الاستيراد.',
              en: 'Import failed.',
            },
          )
          return
        }

        if (json.parsed) setParsed(json.parsed)
        if (json.errors) setErrors(json.errors)
      } catch {
        setFatalError({
          ar: 'تعذّر الاتصال بالخادم.',
          en: 'Could not reach the server.',
        })
      } finally {
        setIsParsing(false)
      }
    },
    [businessId],
  )

  const handleSave = useCallback(async () => {
    if (!parsed || !businessId) return
    setIsSaving(true)
    setFatalError(null)
    try {
      const res = await fetch('/api/invoicing/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, parsed }),
      })
      const json = (await res.json()) as SaveResponse
      if (!res.ok || !json.invoiceId) {
        setFatalError(
          json.error ?? {
            ar: 'فشل الحفظ.',
            en: 'Save failed.',
          },
        )
        if (json.errors) setErrors(json.errors)
        return
      }
      setSavedInvoiceId(json.invoiceId)
    } catch {
      setFatalError({
        ar: 'تعذّر الاتصال بالخادم.',
        en: 'Could not reach the server.',
      })
    } finally {
      setIsSaving(false)
    }
  }, [parsed, businessId])

  const canSave = parsed && errors.length === 0 && !savedInvoiceId

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: t('breadcrumbInvoicing'), href: '/invoicing' },
            { label: t('title') },
          ]}
        />
        <h1 className="mt-3 text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* File picker */}
      <div className="rounded-xl border border-border bg-card p-6">
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface-1 px-6 py-10 text-center transition-colors hover:border-primary/50">
          <div className="rounded-2xl bg-primary/10 p-3">
            <FileCode2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              {t('dropzoneTitle')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('dropzoneHint')}</p>
          </div>
          <input
            type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
          {fileName && (
            <p className="text-xs text-muted-foreground" dir="ltr">
              {fileName}
            </p>
          )}
        </label>
      </div>

      {isParsing && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('parsing')}
        </div>
      )}

      {fatalError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{fatalError[lang]}</span>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold text-amber-400">
            <AlertCircle className="h-4 w-4" />
            {t('validationErrorsTitle')}
          </div>
          <ul className="list-disc space-y-1 ps-5 text-amber-200">
            {errors.map((e, i) => (
              <li key={`${e.field}-${i}`}>
                <span className="font-mono text-xs text-amber-300/80">{e.field}</span>
                <span className="mx-2">—</span>
                <span>{e.message[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {parsed && (
        <div className="space-y-4">
          {/* Header summary */}
          <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 md:grid-cols-3">
            <Field label={t('invoiceNumber')} value={parsed.invoice.invoice_number || '—'} />
            <Field label={t('issueDate')} value={parsed.invoice.issue_date || '—'} />
            <Field
              label={t('invoiceType')}
              value={t(`invoiceTypes.${parsed.invoice.invoice_type}`)}
            />
            <Field label={t('sellerVat')} value={parsed.seller.vatNumber ?? '—'} />
            <Field label={t('buyerVat')} value={parsed.buyer.vatNumber ?? '—'} />
            <Field label={t('uuid')} value={parsed.invoice.zatca_uuid ?? '—'} />
            <Field label={t('subtotal')} value={parsed.invoice.subtotal.toFixed(2)} />
            <Field label={t('totalVat')} value={parsed.invoice.total_vat.toFixed(2)} />
            <Field
              label={t('totalAmount')}
              value={parsed.invoice.total_amount.toFixed(2)}
              emphasize
            />
          </div>

          {/* Line items */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">#</th>
                  <th className="px-3 py-2 text-start">{t('description')}</th>
                  <th className="px-3 py-2 text-end">{t('quantity')}</th>
                  <th className="px-3 py-2 text-end">{t('unitPrice')}</th>
                  <th className="px-3 py-2 text-end">{t('vatRate')}</th>
                  <th className="px-3 py-2 text-end">{t('vatAmount')}</th>
                  <th className="px-3 py-2 text-end">{t('lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {parsed.lineItems.map((li) => (
                  <tr key={li.line_number} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{li.line_number}</td>
                    <td className="px-3 py-2 text-foreground">{li.description}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{li.quantity}</td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {li.unit_price.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {li.vat_rate.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {li.vat_amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums font-medium">
                      {li.line_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {parsed.lineItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      {t('noLines')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Save */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {savedInvoiceId
                ? t('savedHint')
                : canSave
                  ? t('readyToSave')
                  : t('fixErrorsHint')}
            </p>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!canSave || isSaving}
              variant="default"
            >
              {isSaving ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : savedInvoiceId ? (
                <CheckCircle2 className="me-2 h-4 w-4" />
              ) : (
                <Save className="me-2 h-4 w-4" />
              )}
              {savedInvoiceId ? t('saved') : t('saveDraft')}
            </Button>
          </div>

          {savedInvoiceId && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {t('savedSuccess')} <span dir="ltr" className="font-mono">{savedInvoiceId}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {!parsed && !isParsing && !fatalError && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center text-sm text-muted-foreground">
          <Upload className="h-5 w-5" />
          <span>{t('emptyState')}</span>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          emphasize
            ? 'mt-1 text-base font-semibold text-foreground'
            : 'mt-1 text-sm text-foreground'
        }
      >
        {value}
      </p>
    </div>
  )
}
