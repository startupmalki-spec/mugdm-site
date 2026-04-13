'use client'

/**
 * Editable invoice line-items table (Task 58).
 *
 * Purely presentational / controlled — the parent owns the lines state and
 * passes in an `onChange(lines)` callback. Uses the shared `calculateLine`
 * helper for derived columns so the numbers shown to users match what the
 * server will recompute on save.
 */

import { useTranslations } from 'next-intl'
import { Plus, Trash2, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calculateLine } from '@/lib/invoicing/calculations'

export interface EditableLineItem {
  line_number: number
  description: string
  description_en?: string
  quantity: number
  unit_price: number
  discount_amount: number
  vat_rate: number
}

export const EMPTY_LINE: EditableLineItem = {
  line_number: 1,
  description: '',
  description_en: '',
  quantity: 1,
  unit_price: 0,
  discount_amount: 0,
  vat_rate: 15,
}

interface LineItemsTableProps {
  value: EditableLineItem[]
  onChange: (next: EditableLineItem[]) => void
  locale?: 'ar' | 'en'
}

const fmt = (n: number) => n.toFixed(2)

function renumber(lines: EditableLineItem[]): EditableLineItem[] {
  return lines.map((l, i) => ({ ...l, line_number: i + 1 }))
}

export function LineItemsTable({
  value,
  onChange,
  locale = 'en',
}: LineItemsTableProps) {
  const t = useTranslations('invoicing.invoices.lineItems')

  function update(index: number, patch: Partial<EditableLineItem>) {
    const next = value.map((l, i) => (i === index ? { ...l, ...patch } : l))
    onChange(next)
  }

  function addRow() {
    onChange(renumber([...value, { ...EMPTY_LINE, line_number: value.length + 1 }]))
  }

  function removeRow(index: number) {
    if (value.length <= 1) return
    onChange(renumber(value.filter((_, i) => i !== index)))
  }

  function duplicateRow(index: number) {
    const src = value[index]
    const copy = { ...src }
    const next = [...value]
    next.splice(index + 1, 0, copy)
    onChange(renumber(next))
  }

  const num = (raw: string) => {
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 pe-2 w-8">#</th>
              <th className="py-2 pe-2 min-w-[16rem]">
                {locale === 'ar' ? t('descriptionAr') : t('descriptionEn')}
              </th>
              <th className="py-2 pe-2 w-24">{t('qty')}</th>
              <th className="py-2 pe-2 w-28">{t('unitPrice')}</th>
              <th className="py-2 pe-2 w-28">{t('discount')}</th>
              <th className="py-2 pe-2 w-20">{t('vatRate')}</th>
              <th className="py-2 pe-2 w-28 text-end">{t('lineTotal')}</th>
              <th className="py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {value.map((line, i) => {
              const r = calculateLine(line)
              return (
                <tr key={i} className="border-t border-border align-top">
                  <td className="py-2 pe-2 text-muted-foreground">{line.line_number}</td>
                  <td className="py-2 pe-2 space-y-1">
                    <Input
                      value={line.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                      placeholder={t('descriptionArPlaceholder')}
                    />
                    <Input
                      value={line.description_en ?? ''}
                      onChange={(e) => update(i, { description_en: e.target.value })}
                      placeholder={t('descriptionEnPlaceholder')}
                    />
                  </td>
                  <td className="py-2 pe-2">
                    <Input
                      inputMode="decimal"
                      value={String(line.quantity)}
                      onChange={(e) => update(i, { quantity: num(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pe-2">
                    <Input
                      inputMode="decimal"
                      value={String(line.unit_price)}
                      onChange={(e) => update(i, { unit_price: num(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pe-2">
                    <Input
                      inputMode="decimal"
                      value={String(line.discount_amount)}
                      onChange={(e) =>
                        update(i, { discount_amount: num(e.target.value) })
                      }
                    />
                  </td>
                  <td className="py-2 pe-2">
                    <Input
                      inputMode="decimal"
                      value={String(line.vat_rate)}
                      onChange={(e) => update(i, { vat_rate: num(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pe-2 text-end tabular-nums">
                    {fmt(r.line_total)}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={t('duplicate')}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => duplicateRow(i)}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('remove')}
                        className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                        disabled={value.length <= 1}
                        onClick={() => removeRow(i)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="w-4 h-4" />
        {t('addLine')}
      </Button>
    </div>
  )
}
