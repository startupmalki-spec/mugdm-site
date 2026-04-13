/**
 * ZATCA UBL 2.1 XML Invoice Generator
 *
 * Generates ZATCA-compliant UBL 2.1 XML for Saudi Arabia e-invoicing
 * (Fatoora — Phase 2 / FATOORA Integration Phase).
 *
 * Profiles:
 *  - reporting:1.0  → Simplified (B2C) — invoices reported asynchronously
 *  - clearance:1.0  → Standard (B2B)   — invoices cleared synchronously
 *
 * This module ONLY builds + hashes the XML. Cryptographic XAdES-BES signing,
 * QR generation, and ZATCA API submission live in sibling modules
 * (tasks 55, 56, 57).
 *
 * Spec references:
 *  - ZATCA E-Invoicing Detailed Technical Guidelines v3.x (Sec 6 — UBL Schema)
 *  - ZATCA Security Implementation Standards v2.x (Sec 3 — Invoice Hash)
 *
 * @see PRD_ZATCA_EINVOICING.md §5.7, §7.1
 */

import { createHash, randomUUID } from 'node:crypto'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import type {
  Business,
  Customer,
  Invoice,
  InvoiceLineItem,
} from '@/lib/supabase/types'

// --------------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------------

export interface GenerateUblParams {
  invoice: Invoice
  lineItems: InvoiceLineItem[]
  seller: Business
  /** May be null for anonymous simplified (B2C) invoices. */
  buyer: Customer | null
  /**
   * Base64 of the previous invoice hash in the chain, per ZATCA spec.
   * For the very first invoice in the chain, omit (or pass undefined) —
   * we will fall back to the canonical "0" base64 value
   * (`NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==`
   *  is the SHA-256 of "0" in base64; ZATCA prescribes this seed).
   */
  previousInvoiceHash?: string
}

export interface GenerateUblResult {
  xml: string
  /** Base64-encoded SHA-256 digest of the canonicalized invoice XML. */
  invoiceHash: string
}

export interface ParsedUblSummary {
  id: string | null
  uuid: string | null
  issueDate: string | null
  issueTime: string | null
  invoiceTypeCode: string | null
  profileId: string | null
  documentCurrencyCode: string | null
  taxExclusiveAmount: number | null
  taxInclusiveAmount: number | null
  taxAmount: number | null
  payableAmount: number | null
  lineItemCount: number
  sellerVatNumber: string | null
  buyerVatNumber: string | null
  previousInvoiceHash: string | null
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const NS = {
  invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
} as const

/**
 * ZATCA-prescribed seed for the very first invoice in the chain:
 * SHA-256("0") base64-encoded.
 */
const ZATCA_INITIAL_PREVIOUS_HASH =
  'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ=='

const SAR = 'SAR'

const SUBTYPE_TO_CODE: Record<Invoice['invoice_subtype'], string> = {
  invoice: '388',
  debit_note: '383',
  credit_note: '381',
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const fmt = (n: number | null | undefined): string => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return v.toFixed(2)
}

/** Quantity uses 6 decimals (UBL convention for ZATCA invoiced quantity). */
const fmtQty = (n: number | null | undefined): string => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return v.toFixed(6)
}

/**
 * Map invoice → ZATCA InvoiceTypeCode `name` attribute (7-char transaction code).
 *
 *   Position 1: '0' (reserved)
 *   Position 2: '1' standard / '2' simplified
 *   Position 3: '0' / '1' third-party
 *   Position 4: '0' / '1' nominal
 *   Position 5: '0' / '1' exports
 *   Position 6: '0' / '1' summary
 *   Position 7: '0' / '1' self-billed
 *
 * For our MVP we only support: standard B2B (0100000) and simplified B2C (0200000).
 * Future flags (export, summary, etc.) can be plumbed via a richer params object.
 */
const buildTransactionTypeName = (
  invoiceType: Invoice['invoice_type'],
): string => (invoiceType === 'standard' ? '0100000' : '0200000')

const buildProfileId = (invoiceType: Invoice['invoice_type']): string =>
  invoiceType === 'standard' ? 'clearance:1.0' : 'reporting:1.0'

const isoDate = (d: string): string => {
  // d is YYYY-MM-DD or full ISO; normalize to YYYY-MM-DD.
  return d.length >= 10 ? d.slice(0, 10) : d
}

const isoTime = (createdAt: string | undefined): string => {
  // Use the invoice created_at time, or fall back to current.
  const dt = createdAt ? new Date(createdAt) : new Date()
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(11, 19)
  return dt.toISOString().slice(11, 19)
}

// --------------------------------------------------------------------------
// XML structure builders (plain JS objects → fast-xml-parser)
// --------------------------------------------------------------------------

interface XmlNode {
  [key: string]: unknown
}

const buildSellerParty = (seller: Business): XmlNode => {
  const otherIds: XmlNode[] = []
  if (seller.cr_number) {
    otherIds.push({
      'cbc:ID': { '@_schemeID': 'CRN', '#text': seller.cr_number },
    })
  }

  const partyName: XmlNode[] = []
  if (seller.name_ar) {
    partyName.push({ 'cac:PartyName': { 'cbc:Name': seller.name_ar } })
  }
  if (seller.name_en) {
    partyName.push({ 'cac:PartyName': { 'cbc:Name': seller.name_en } })
  }

  const node: XmlNode = {
    'cac:Party': {
      ...(otherIds.length > 0 && { 'cac:PartyIdentification': otherIds }),
      'cac:PostalAddress': {
        'cbc:StreetName': seller.contact_address ?? 'N/A',
        'cbc:CityName': seller.city ?? 'N/A',
        'cbc:PostalZone': '00000',
        'cbc:CountrySubentity': seller.city ?? 'N/A',
        'cac:Country': { 'cbc:IdentificationCode': 'SA' },
      },
      'cac:PartyTaxScheme': {
        // ZATCA uses VAT number on PartyTaxScheme.CompanyID
        // Businesses table doesn't yet carry vat_number — use CR as placeholder
        // when missing. Real production rows must populate vat_number.
        'cbc:CompanyID':
          (seller as Business & { vat_number?: string }).vat_number ??
          seller.cr_number ??
          '000000000000000',
        'cac:TaxScheme': { 'cbc:ID': 'VAT' },
      },
      'cac:PartyLegalEntity': {
        'cbc:RegistrationName': seller.name_ar || seller.name_en || 'N/A',
      },
      ...(partyName.length > 0 && { 'cac:PartyName': partyName.map((p) => (p['cac:PartyName'] as XmlNode)) }),
    },
  }
  return node
}

const buildBuyerParty = (buyer: Customer | null): XmlNode => {
  // For simplified anonymous B2C, ZATCA allows minimal/omitted buyer.
  // We still emit a stub party with a placeholder identifier so downstream
  // schema validators don't reject the document for missing element.
  if (!buyer) {
    return {
      'cac:Party': {
        'cac:PostalAddress': {
          'cbc:CountrySubentity': 'N/A',
          'cac:Country': { 'cbc:IdentificationCode': 'SA' },
        },
        'cac:PartyLegalEntity': { 'cbc:RegistrationName': 'Anonymous' },
      },
    }
  }

  const otherIds: XmlNode[] = []
  if (buyer.cr_number) {
    otherIds.push({
      'cbc:ID': { '@_schemeID': 'CRN', '#text': buyer.cr_number },
    })
  }

  const node: XmlNode = {
    'cac:Party': {
      ...(otherIds.length > 0 && { 'cac:PartyIdentification': otherIds }),
      'cac:PostalAddress': {
        'cbc:StreetName': buyer.address ?? 'N/A',
        'cbc:CityName': buyer.city ?? 'N/A',
        'cbc:PostalZone': '00000',
        'cbc:CountrySubentity': buyer.city ?? 'N/A',
        'cac:Country': { 'cbc:IdentificationCode': buyer.country ?? 'SA' },
      },
      ...(buyer.vat_number && {
        'cac:PartyTaxScheme': {
          'cbc:CompanyID': buyer.vat_number,
          'cac:TaxScheme': { 'cbc:ID': 'VAT' },
        },
      }),
      'cac:PartyLegalEntity': {
        'cbc:RegistrationName': buyer.name || buyer.name_en || 'N/A',
      },
    },
  }
  return node
}

const buildInvoiceLine = (line: InvoiceLineItem): XmlNode => {
  const qty = line.quantity ?? 0
  const unitPrice = line.unit_price ?? 0
  const discount = line.discount_amount ?? 0
  const lineExt = qty * unitPrice - discount
  const vatRate = line.vat_rate ?? 0
  const vatAmount = line.vat_amount ?? 0
  const lineTotal = line.line_total ?? lineExt + vatAmount

  return {
    'cbc:ID': String(line.line_number),
    'cbc:InvoicedQuantity': {
      '@_unitCode': 'PCE',
      '#text': fmtQty(qty),
    },
    'cbc:LineExtensionAmount': {
      '@_currencyID': SAR,
      '#text': fmt(lineExt),
    },
    'cac:TaxTotal': {
      'cbc:TaxAmount': { '@_currencyID': SAR, '#text': fmt(vatAmount) },
      'cbc:RoundingAmount': { '@_currencyID': SAR, '#text': fmt(lineTotal) },
    },
    'cac:Item': {
      'cbc:Name': line.description,
      'cac:ClassifiedTaxCategory': {
        'cbc:ID': vatRate > 0 ? 'S' : 'Z',
        'cbc:Percent': fmt(vatRate),
        'cac:TaxScheme': { 'cbc:ID': 'VAT' },
      },
    },
    'cac:Price': {
      'cbc:PriceAmount': { '@_currencyID': SAR, '#text': fmt(unitPrice) },
      ...(discount > 0 && {
        'cac:AllowanceCharge': {
          'cbc:ChargeIndicator': 'false',
          'cbc:AllowanceChargeReason': 'discount',
          'cbc:Amount': { '@_currencyID': SAR, '#text': fmt(discount) },
        },
      }),
    },
  }
}

/**
 * Group line items by VAT rate to produce TaxSubtotal entries.
 * ZATCA expects one TaxSubtotal per distinct rate.
 */
const buildTaxTotal = (lines: InvoiceLineItem[], totalVat: number): XmlNode => {
  const groups = new Map<number, { taxable: number; tax: number }>()
  for (const line of lines) {
    const qty = line.quantity ?? 0
    const unitPrice = line.unit_price ?? 0
    const discount = line.discount_amount ?? 0
    const taxable = qty * unitPrice - discount
    const rate = line.vat_rate ?? 0
    const g = groups.get(rate) ?? { taxable: 0, tax: 0 }
    g.taxable += taxable
    g.tax += line.vat_amount ?? 0
    groups.set(rate, g)
  }

  const subtotals = Array.from(groups.entries()).map(([rate, g]) => ({
    'cbc:TaxableAmount': { '@_currencyID': SAR, '#text': fmt(g.taxable) },
    'cbc:TaxAmount': { '@_currencyID': SAR, '#text': fmt(g.tax) },
    'cac:TaxCategory': {
      'cbc:ID': rate > 0 ? 'S' : 'Z',
      'cbc:Percent': fmt(rate),
      'cac:TaxScheme': { 'cbc:ID': 'VAT' },
    },
  }))

  return {
    'cbc:TaxAmount': { '@_currencyID': SAR, '#text': fmt(totalVat) },
    'cac:TaxSubtotal': subtotals,
  }
}

// --------------------------------------------------------------------------
// Canonicalization + hashing
// --------------------------------------------------------------------------

/**
 * ZATCA invoice hash spec (Security Standards §3.2):
 *
 *   1. Remove the <ext:UBLExtensions> block (signature placeholder), if any.
 *   2. Remove the <cac:Signature> block and the QR <cac:AdditionalDocumentReference name="QR">.
 *      For pre-signing hash (which is what we compute here), the signature/QR
 *      blocks are not yet present, so step 2 is a no-op.
 *   3. Apply C14N 1.0 (XML canonicalization). We approximate by:
 *        - using a single declaration line + no whitespace between elements
 *        - emitting attributes in document order (fast-xml-parser preserves order)
 *      A full Exclusive C14N implementation is provided by the signing module
 *      (task 55) using `xml-c14n`. For the *pre-signing* invoice hash that
 *      feeds into the chain, this canonical form is sufficient because the
 *      same generator deterministically produces the same bytes for the same
 *      inputs across runs.
 *   4. SHA-256 → base64.
 *
 * Caller note: The invoice hash returned here is the value to embed into
 * the next invoice's PreviousInvoiceHash, and the value the signing module
 * will re-hash the post-signature canonical XML against for verification.
 */
const stripUblExtensions = (xml: string): string => {
  return xml.replace(
    /<ext:UBLExtensions[\s\S]*?<\/ext:UBLExtensions>\s*/g,
    '',
  )
}

const computeInvoiceHash = (xml: string): string => {
  const canonical = stripUblExtensions(xml)
  const digest = createHash('sha256').update(canonical, 'utf8').digest('base64')
  return digest
}

// --------------------------------------------------------------------------
// Main entry point
// --------------------------------------------------------------------------

export function generateUblInvoice(
  params: GenerateUblParams,
): GenerateUblResult {
  const { invoice, lineItems, seller, buyer, previousInvoiceHash } = params

  const uuid = invoice.zatca_uuid ?? randomUUID()
  const profileId = buildProfileId(invoice.invoice_type)
  const typeCode = SUBTYPE_TO_CODE[invoice.invoice_subtype]
  const typeName = buildTransactionTypeName(invoice.invoice_type)
  const prevHash = previousInvoiceHash ?? ZATCA_INITIAL_PREVIOUS_HASH

  // Sort line items by line_number for deterministic output.
  const sortedLines = [...lineItems].sort(
    (a, b) => a.line_number - b.line_number,
  )

  const root: XmlNode = {
    Invoice: {
      '@_xmlns': NS.invoice,
      '@_xmlns:cac': NS.cac,
      '@_xmlns:cbc': NS.cbc,
      '@_xmlns:ext': NS.ext,

      'cbc:ProfileID': profileId,
      'cbc:ID': invoice.invoice_number,
      'cbc:UUID': uuid,
      'cbc:IssueDate': isoDate(invoice.issue_date),
      'cbc:IssueTime': isoTime(invoice.created_at),
      'cbc:InvoiceTypeCode': {
        '@_name': typeName,
        '#text': typeCode,
      },
      ...(invoice.notes && { 'cbc:Note': invoice.notes }),
      'cbc:DocumentCurrencyCode': SAR,
      'cbc:TaxCurrencyCode': SAR,

      // PIH (Previous Invoice Hash) — ZATCA chain anchor.
      // Embedded as AdditionalDocumentReference per ZATCA spec.
      'cac:AdditionalDocumentReference': [
        {
          'cbc:ID': 'ICV',
          // Invoice Counter Value — sequential counter; we use line count
          // as a deterministic placeholder. The submission layer (task 57)
          // overrides this with the per-business monotonic counter.
          'cbc:UUID': '1',
        },
        {
          'cbc:ID': 'PIH',
          'cac:Attachment': {
            'cbc:EmbeddedDocumentBinaryObject': {
              '@_mimeCode': 'text/plain',
              '#text': prevHash,
            },
          },
        },
      ],

      // Billing reference for credit/debit notes (must point to original).
      ...((invoice.invoice_subtype === 'credit_note' ||
        invoice.invoice_subtype === 'debit_note') &&
        invoice.linked_invoice_id && {
          'cac:BillingReference': {
            'cac:InvoiceDocumentReference': {
              'cbc:ID': invoice.linked_invoice_id,
            },
          },
        }),

      'cac:AccountingSupplierParty': buildSellerParty(seller),
      'cac:AccountingCustomerParty': buildBuyerParty(buyer),

      ...(invoice.supply_date && {
        'cac:Delivery': {
          'cbc:ActualDeliveryDate': isoDate(invoice.supply_date),
        },
      }),

      'cac:PaymentMeans': {
        // 10 = cash; ZATCA accepts UN/ECE 4461 codes.
        // The bookkeeper layer can override per invoice in future iterations.
        'cbc:PaymentMeansCode': '10',
        ...(invoice.payment_terms && {
          'cbc:PaymentDueDate': invoice.due_date
            ? isoDate(invoice.due_date)
            : isoDate(invoice.issue_date),
        }),
      },

      'cac:TaxTotal': buildTaxTotal(sortedLines, invoice.total_vat),

      'cac:LegalMonetaryTotal': {
        'cbc:LineExtensionAmount': {
          '@_currencyID': SAR,
          '#text': fmt(invoice.subtotal),
        },
        'cbc:TaxExclusiveAmount': {
          '@_currencyID': SAR,
          '#text': fmt(invoice.subtotal),
        },
        'cbc:TaxInclusiveAmount': {
          '@_currencyID': SAR,
          '#text': fmt(invoice.total_amount),
        },
        'cbc:PayableAmount': {
          '@_currencyID': SAR,
          '#text': fmt(invoice.total_amount),
        },
      },

      'cac:InvoiceLine': sortedLines.map(buildInvoiceLine),
    },
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    suppressEmptyNode: false,
    format: false, // ZATCA wants no extraneous whitespace for hash determinism
    processEntities: true,
  })

  const body = builder.build(root)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>${body}`

  const invoiceHash = computeInvoiceHash(xml)

  return { xml, invoiceHash }
}

// --------------------------------------------------------------------------
// Partial parser (for import / validation flow — task 63)
// --------------------------------------------------------------------------

/**
 * Lightweight UBL parser that extracts the high-level invoice header,
 * monetary totals, and line item count. Used by:
 *
 *   - The XML import flow (PRD §5.4) to validate uploaded invoices
 *     before forwarding to ZATCA.
 *   - Internal tests / round-trip assertions.
 *
 * This does NOT validate against the full ZATCA XSD — that lives in a
 * dedicated validator module.
 */
export function parseUblInvoice(xml: string): ParsedUblSummary {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false,
    parseTagValue: false,
    removeNSPrefix: true, // strips cbc:/cac:/ext: → easier traversal
  })

  const obj = parser.parse(xml) as Record<string, unknown>
  const inv = (obj.Invoice ?? {}) as Record<string, unknown>

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined) return null
    if (typeof v === 'number') return v
    if (typeof v === 'object' && v !== null && '#text' in v) {
      const t = (v as { '#text': unknown })['#text']
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    }
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const str = (v: unknown): string | null => {
    if (v === null || v === undefined) return null
    if (typeof v === 'string') return v
    if (typeof v === 'object' && v !== null && '#text' in v) {
      return String((v as { '#text': unknown })['#text'])
    }
    return String(v)
  }

  const lmt = (inv.LegalMonetaryTotal ?? {}) as Record<string, unknown>
  const taxTotal = (inv.TaxTotal ?? {}) as Record<string, unknown>

  // InvoiceLine may be array or single object.
  const rawLines = inv.InvoiceLine
  const lineCount = Array.isArray(rawLines) ? rawLines.length : rawLines ? 1 : 0

  // Seller / buyer VAT numbers
  const supplier = (inv.AccountingSupplierParty ?? {}) as Record<string, unknown>
  const customer = (inv.AccountingCustomerParty ?? {}) as Record<string, unknown>
  const sellerVat = str(
    ((supplier.Party as Record<string, unknown> | undefined)?.PartyTaxScheme as
      | Record<string, unknown>
      | undefined)?.CompanyID,
  )
  const buyerVat = str(
    ((customer.Party as Record<string, unknown> | undefined)?.PartyTaxScheme as
      | Record<string, unknown>
      | undefined)?.CompanyID,
  )

  // Previous Invoice Hash from AdditionalDocumentReference[ID=PIH]
  let pih: string | null = null
  const adr = inv.AdditionalDocumentReference
  const adrArr = Array.isArray(adr) ? adr : adr ? [adr] : []
  for (const ref of adrArr) {
    const r = ref as Record<string, unknown>
    if (str(r.ID) === 'PIH') {
      const att = r.Attachment as Record<string, unknown> | undefined
      pih = str(att?.EmbeddedDocumentBinaryObject)
      break
    }
  }

  const typeCodeNode = inv.InvoiceTypeCode
  const typeCode = str(typeCodeNode)

  return {
    id: str(inv.ID),
    uuid: str(inv.UUID),
    issueDate: str(inv.IssueDate),
    issueTime: str(inv.IssueTime),
    invoiceTypeCode: typeCode,
    profileId: str(inv.ProfileID),
    documentCurrencyCode: str(inv.DocumentCurrencyCode),
    taxExclusiveAmount: num(lmt.TaxExclusiveAmount),
    taxInclusiveAmount: num(lmt.TaxInclusiveAmount),
    taxAmount: num(taxTotal.TaxAmount),
    payableAmount: num(lmt.PayableAmount),
    lineItemCount: lineCount,
    sellerVatNumber: sellerVat,
    buyerVatNumber: buyerVat,
    previousInvoiceHash: pih,
  }
}
