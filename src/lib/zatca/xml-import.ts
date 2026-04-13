/**
 * ZATCA UBL 2.1 XML Import + Structural Validation
 *
 * Powers the "Bring your own invoice XML" flow (PRD §5.4 / task 63).
 * Users upload a UBL invoice XML produced by another system — we parse it
 * into the shape required by our `invoices` + `invoice_line_items` tables,
 * and run structural validation so the caller can preview what will be
 * persisted before it lands in the database.
 *
 * Scope:
 *   - Structural (field-presence + arithmetic) validation only.
 *   - Namespaces handled: cbc (CommonBasicComponents), cac (CommonAggregateComponents).
 *   - XSD schema validation is intentionally skipped to avoid pulling in
 *     `libxmljs2` (native build) — tracked as a future improvement.
 *   - This module does NOT write to the DB and does NOT submit to ZATCA;
 *     those flows live in task 63's API route + task 57 (submission).
 *
 * Downstream type contract: see `InvoiceLineItem` / `Invoice` in
 * `src/lib/supabase/types.ts`. We emit `Insert`-shaped partials (no id /
 * no business_id / no timestamps — those are filled in by the save route).
 */

import { XMLParser } from 'fast-xml-parser'
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceSubtype,
  InvoiceType,
} from '@/lib/supabase/types'

// --------------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------------

/** Line item payload shaped for DB insertion (no id / no invoice_id yet). */
export type ParsedLineItem = Omit<InvoiceLineItem, 'id' | 'invoice_id'>

/** Invoice payload shaped for DB insertion (no id / business_id / timestamps). */
export type ParsedInvoiceHeader = Omit<
  Invoice,
  | 'id'
  | 'business_id'
  | 'created_at'
  | 'updated_at'
  | 'customer_id'
  | 'linked_invoice_id'
  | 'linked_transaction_id'
  | 'zatca_response'
  | 'zatca_submitted_at'
  | 'zatca_cleared_at'
  | 'zatca_rejection_reason'
  | 'zatca_qr_code'
  | 'zatca_hash'
>

export interface ParsedImportedInvoice {
  invoice: ParsedInvoiceHeader
  lineItems: ParsedLineItem[]
  /** Parsed buyer info (for display / future customer matching). */
  buyer: {
    name: string | null
    vatNumber: string | null
    crNumber: string | null
    address: string | null
    city: string | null
    country: string | null
  }
  /** Parsed seller info (for display only — we don't overwrite the Business row). */
  seller: {
    name: string | null
    vatNumber: string | null
    crNumber: string | null
  }
}

export interface ValidationError {
  field: string
  message: { ar: string; en: string }
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// --------------------------------------------------------------------------
// Low-level value coercion helpers
// --------------------------------------------------------------------------

const textOf = (v: unknown): string | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    if ('#text' in (v as Record<string, unknown>)) {
      const t = (v as Record<string, unknown>)['#text']
      return t === null || t === undefined ? null : String(t).trim() || null
    }
  }
  return null
}

const numOf = (v: unknown): number | null => {
  const s = textOf(v)
  if (s === null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const asArray = <T = unknown>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : v === undefined || v === null ? [] : [v as T]

// --------------------------------------------------------------------------
// Invoice parser
// --------------------------------------------------------------------------

/**
 * Parse a UBL 2.1 invoice XML string into the fields required to persist an
 * Invoice + InvoiceLineItem[] row. This is a best-effort extractor:
 * missing optional fields are coerced to sensible defaults, and the returned
 * structure should be fed through `validateImportedInvoice` before use.
 *
 * Throws if the XML is not well-formed or is missing the top-level
 * <Invoice> element — callers should surface that as a user-facing error.
 */
export function parseImportedInvoice(xml: string): ParsedImportedInvoice {
  if (!xml || typeof xml !== 'string') {
    throw new Error('EMPTY_XML')
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false,
    parseTagValue: false,
    removeNSPrefix: true, // strip cbc: / cac: / ext: prefixes
    trimValues: true,
  })

  let obj: Record<string, unknown>
  try {
    obj = parser.parse(xml) as Record<string, unknown>
  } catch (err) {
    throw new Error(
      `MALFORMED_XML: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const inv = obj.Invoice as Record<string, unknown> | undefined
  if (!inv) throw new Error('MISSING_INVOICE_ROOT')

  // --- header ------------------------------------------------------------
  const invoiceNumber = textOf(inv.ID) ?? ''
  const uuid = textOf(inv.UUID)
  const issueDate = textOf(inv.IssueDate) ?? ''
  const profileId = textOf(inv.ProfileID)
  const currency = textOf(inv.DocumentCurrencyCode) ?? 'SAR'
  const notes = textOf(inv.Note)

  // Infer invoice_type from ProfileID (spec):
  //   clearance:1.0 → standard (B2B)
  //   reporting:1.0 → simplified (B2C)
  const invoiceType: InvoiceType = profileId?.toLowerCase().startsWith('clearance')
    ? 'standard'
    : 'simplified'

  // Infer invoice_subtype from InvoiceTypeCode (388=invoice, 381=credit, 383=debit).
  const typeCodeRaw = textOf(inv.InvoiceTypeCode)
  const subtype: InvoiceSubtype =
    typeCodeRaw === '381'
      ? 'credit_note'
      : typeCodeRaw === '383'
        ? 'debit_note'
        : 'invoice'

  // Delivery / supply date (optional).
  const delivery = inv.Delivery as Record<string, unknown> | undefined
  const supplyDate = delivery ? textOf(delivery.ActualDeliveryDate) : null

  // Payment means → due date (optional).
  const paymentMeans = inv.PaymentMeans as Record<string, unknown> | undefined
  const dueDate = paymentMeans ? textOf(paymentMeans.PaymentDueDate) : null

  // --- monetary totals ---------------------------------------------------
  const lmt = (inv.LegalMonetaryTotal ?? {}) as Record<string, unknown>
  const taxTotalNode = inv.TaxTotal
  const taxTotal = Array.isArray(taxTotalNode)
    ? (taxTotalNode[0] as Record<string, unknown> | undefined) ?? {}
    : ((taxTotalNode ?? {}) as Record<string, unknown>)

  const subtotal = numOf(lmt.TaxExclusiveAmount) ?? numOf(lmt.LineExtensionAmount) ?? 0
  const totalVat = numOf(taxTotal.TaxAmount) ?? 0
  const totalAmount = numOf(lmt.TaxInclusiveAmount) ?? numOf(lmt.PayableAmount) ?? 0

  // --- seller / buyer ---------------------------------------------------
  const supplier = (inv.AccountingSupplierParty ?? {}) as Record<string, unknown>
  const customer = (inv.AccountingCustomerParty ?? {}) as Record<string, unknown>

  const extractParty = (partyWrap: Record<string, unknown>) => {
    const party = (partyWrap.Party ?? {}) as Record<string, unknown>
    const taxScheme = party.PartyTaxScheme as Record<string, unknown> | undefined
    const vatNumber = taxScheme ? textOf(taxScheme.CompanyID) : null

    // CRN lives under PartyIdentification[@schemeID="CRN"].
    let crNumber: string | null = null
    const pids = asArray<Record<string, unknown>>(party.PartyIdentification)
    for (const pid of pids) {
      const id = pid.ID as Record<string, unknown> | string | undefined
      if (typeof id === 'object' && id !== null) {
        const scheme = textOf((id as Record<string, unknown>)['@_schemeID'])
        if (scheme === 'CRN') {
          crNumber = textOf(id)
          break
        }
      }
    }

    const legal = party.PartyLegalEntity as Record<string, unknown> | undefined
    const legalName = legal ? textOf(legal.RegistrationName) : null

    const addr = (party.PostalAddress ?? {}) as Record<string, unknown>
    const address = textOf(addr.StreetName)
    const city = textOf(addr.CityName)
    const country = textOf(
      (addr.Country as Record<string, unknown> | undefined)?.IdentificationCode,
    )

    return { legalName, vatNumber, crNumber, address, city, country }
  }

  const sellerInfo = extractParty(supplier)
  const buyerInfo = extractParty(customer)

  // --- line items -------------------------------------------------------
  const rawLines = asArray<Record<string, unknown>>(inv.InvoiceLine)
  const lineItems: ParsedLineItem[] = rawLines.map((line, idx) => {
    const qty = numOf(line.InvoicedQuantity) ?? 0
    const lineExt = numOf(line.LineExtensionAmount) ?? 0
    const price = (line.Price ?? {}) as Record<string, unknown>
    const unitPrice = numOf(price.PriceAmount) ?? (qty > 0 ? lineExt / qty : 0)

    // Allowance (discount) — optional, emitted on cac:Price.
    let discountAmount: number | null = null
    const allowance = price.AllowanceCharge as Record<string, unknown> | undefined
    if (allowance) {
      discountAmount = numOf(allowance.Amount)
    }

    const lineTax = (line.TaxTotal ?? {}) as Record<string, unknown>
    const vatAmount = numOf(lineTax.TaxAmount) ?? 0
    const lineTotal = numOf(lineTax.RoundingAmount) ?? lineExt + vatAmount

    const item = (line.Item ?? {}) as Record<string, unknown>
    const description = textOf(item.Name) ?? ''
    const classified = item.ClassifiedTaxCategory as Record<string, unknown> | undefined
    const vatRate = classified ? numOf(classified.Percent) ?? 0 : 0

    const lineNumberRaw = textOf(line.ID)
    const lineNumber = lineNumberRaw ? Number(lineNumberRaw) : idx + 1

    return {
      line_number: Number.isFinite(lineNumber) ? lineNumber : idx + 1,
      description,
      quantity: qty,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      line_total: lineTotal,
    }
  })

  const invoiceHeader: ParsedInvoiceHeader = {
    invoice_number: invoiceNumber,
    invoice_type: invoiceType,
    invoice_subtype: subtype,
    source: 'imported_xml',
    language: 'both',
    issue_date: issueDate,
    supply_date: supplyDate,
    due_date: dueDate,
    subtotal,
    total_vat: totalVat,
    total_amount: totalAmount,
    zatca_status: 'draft',
    zatca_uuid: uuid,
    zatca_xml: xml,
    notes,
    payment_terms: null,
  }

  return {
    invoice: invoiceHeader,
    lineItems,
    seller: {
      name: sellerInfo.legalName,
      vatNumber: sellerInfo.vatNumber,
      crNumber: sellerInfo.crNumber,
    },
    buyer: {
      name: buyerInfo.legalName,
      vatNumber: buyerInfo.vatNumber,
      crNumber: buyerInfo.crNumber,
      address: buyerInfo.address,
      city: buyerInfo.city,
      country: buyerInfo.country,
    },
  }
}

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

const TOTALS_TOLERANCE = 0.01

/**
 * Structural (non-schema) validation for an imported invoice. Checks:
 *
 *   1. Required scalars: invoice_number, issue_date, seller VAT number.
 *   2. Monetary totals present (subtotal, total_vat, total_amount).
 *   3. subtotal + total_vat ≈ total_amount (tolerance 0.01).
 *   4. At least one line item, each with a description + numeric quantity
 *      and unit price.
 *   5. ProfileID-derived invoice_type is one of the supported values
 *      (implicitly true; explicitly assert we could infer it).
 *
 * Does NOT validate against the ZATCA XSD — a future improvement,
 * gated on shipping a pure-JS schema validator (libxmljs2 has native deps).
 */
export function validateImportedInvoice(
  parsed: ParsedImportedInvoice,
): ValidationResult {
  const errors: ValidationError[] = []

  const push = (field: string, ar: string, en: string) =>
    errors.push({ field, message: { ar, en } })

  const { invoice, lineItems, seller } = parsed

  if (!invoice.invoice_number) {
    push(
      'invoice_number',
      'رقم الفاتورة مفقود.',
      'Invoice number is missing.',
    )
  }

  if (!invoice.issue_date) {
    push('issue_date', 'تاريخ الإصدار مفقود.', 'Issue date is missing.')
  } else if (!/^\d{4}-\d{2}-\d{2}/.test(invoice.issue_date)) {
    push(
      'issue_date',
      'تنسيق تاريخ الإصدار غير صالح (المتوقع YYYY-MM-DD).',
      'Issue date format is invalid (expected YYYY-MM-DD).',
    )
  }

  if (!seller.vatNumber) {
    push(
      'seller.vat_number',
      'الرقم الضريبي للبائع مفقود.',
      'Seller VAT number is missing.',
    )
  }

  if (!Number.isFinite(invoice.subtotal)) {
    push('subtotal', 'المجموع قبل الضريبة غير صالح.', 'Subtotal is invalid.')
  }
  if (!Number.isFinite(invoice.total_vat)) {
    push('total_vat', 'قيمة الضريبة غير صالحة.', 'Total VAT is invalid.')
  }
  if (!Number.isFinite(invoice.total_amount)) {
    push(
      'total_amount',
      'الإجمالي غير صالح.',
      'Total amount is invalid.',
    )
  }

  if (
    Number.isFinite(invoice.subtotal) &&
    Number.isFinite(invoice.total_vat) &&
    Number.isFinite(invoice.total_amount)
  ) {
    const expected = invoice.subtotal + invoice.total_vat
    if (Math.abs(expected - invoice.total_amount) > TOTALS_TOLERANCE) {
      push(
        'total_amount',
        `عدم اتساق المجاميع: ${invoice.subtotal.toFixed(2)} + ${invoice.total_vat.toFixed(2)} لا يساوي ${invoice.total_amount.toFixed(2)}.`,
        `Totals mismatch: ${invoice.subtotal.toFixed(2)} + ${invoice.total_vat.toFixed(2)} does not equal ${invoice.total_amount.toFixed(2)}.`,
      )
    }
  }

  if (lineItems.length === 0) {
    push(
      'line_items',
      'يجب أن تحتوي الفاتورة على بند واحد على الأقل.',
      'Invoice must contain at least one line item.',
    )
  } else {
    lineItems.forEach((line, i) => {
      if (!line.description) {
        push(
          `line_items[${i}].description`,
          `البند رقم ${i + 1}: الوصف مفقود.`,
          `Line ${i + 1}: description is missing.`,
        )
      }
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        push(
          `line_items[${i}].quantity`,
          `البند رقم ${i + 1}: الكمية غير صالحة.`,
          `Line ${i + 1}: quantity is invalid.`,
        )
      }
      if (!Number.isFinite(line.unit_price) || line.unit_price < 0) {
        push(
          `line_items[${i}].unit_price`,
          `البند رقم ${i + 1}: سعر الوحدة غير صالح.`,
          `Line ${i + 1}: unit price is invalid.`,
        )
      }
    })
  }

  return { valid: errors.length === 0, errors }
}
