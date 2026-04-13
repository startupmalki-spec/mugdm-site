/**
 * Shared invoice line / totals calculation helpers (Task 58).
 *
 * These formulas are the single source of truth for monetary math across the
 * UI (new-invoice form, totals panel, preview) and the server-side create /
 * submit routes. Keeping them here guarantees the XML that hits ZATCA agrees
 * with what the user signed off on in the browser.
 *
 * Formulas (ZATCA Phase-2 aligned, pre-rounding on amounts, 2-decimal money):
 *
 *   lineExtension = quantity * unit_price - discount_amount
 *   vat_amount    = round(lineExtension * vat_rate / 100, 2)
 *   line_total    = lineExtension + vat_amount
 *
 *   subtotal      = Σ lineExtension
 *   total_vat     = Σ vat_amount
 *   total_amount  = subtotal + total_vat
 */

export interface CalcLineInput {
  quantity: number | null | undefined
  unit_price: number | null | undefined
  discount_amount?: number | null | undefined
  vat_rate: number | null | undefined
}

export interface CalcLineResult {
  lineExtension: number
  vat_amount: number
  line_total: number
}

export interface CalcInvoiceTotals {
  subtotal: number
  total_vat: number
  total_amount: number
}

const toNum = (n: number | null | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) ? n : 0

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Compute line-level monetary fields for a single invoice line.
 * All returned values are rounded to 2 decimals.
 */
export function calculateLine(item: CalcLineInput): CalcLineResult {
  const qty = toNum(item.quantity)
  const price = toNum(item.unit_price)
  const discount = toNum(item.discount_amount)
  const rate = toNum(item.vat_rate)

  const lineExtension = round2(qty * price - discount)
  const vat_amount = round2((lineExtension * rate) / 100)
  const line_total = round2(lineExtension + vat_amount)

  return { lineExtension, vat_amount, line_total }
}

/**
 * Roll up a collection of line inputs into invoice-level totals.
 * Uses `calculateLine` for each row so rounding semantics match.
 */
export function calculateInvoiceTotals(
  items: CalcLineInput[],
): CalcInvoiceTotals {
  let subtotal = 0
  let total_vat = 0
  for (const item of items) {
    const r = calculateLine(item)
    subtotal += r.lineExtension
    total_vat += r.vat_amount
  }
  subtotal = round2(subtotal)
  total_vat = round2(total_vat)
  const total_amount = round2(subtotal + total_vat)
  return { subtotal, total_vat, total_amount }
}
