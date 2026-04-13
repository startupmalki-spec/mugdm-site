/**
 * Bilingual ZATCA-compliant invoice PDF (Task 61).
 *
 * Uses `@react-pdf/renderer`. The template intentionally keeps layout simple:
 *
 *   - For B2B (`standard`) invoices we render two side-by-side columns
 *     (Arabic | English) so the same document satisfies both audiences without
 *     branching templates.
 *   - For simplified (B2C) invoices we render a single column in the language
 *     the user picked (`invoice.language`). For `language='both'` we also use
 *     the bilingual two-column layout so receipts remain bilingual when asked.
 *
 * The QR PNG bytes are passed in as a base64 string so the route can resolve
 * them from `generateQrCodeImage` without coupling this component to Node APIs.
 *
 * TODO(polish): font embedding for proper Arabic shaping (default Helvetica
 * does not cover Arabic glyphs) — when productionising, register a font like
 * Noto Sans Arabic via `Font.register({...})` and wire it into `styles.ar`.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'

import type {
  Invoice,
  InvoiceLineItem,
  Customer,
  Business,
} from '@/lib/supabase/types'

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: 700 },
  subTitle: { fontSize: 9, color: '#64748b', marginTop: 2 },
  twoCol: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  label: { color: '#64748b', fontSize: 8, marginBottom: 2 },
  value: { fontSize: 9 },
  table: { borderTopWidth: 1, borderColor: '#e2e8f0', marginTop: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  cellNum: { width: 20 },
  cellDesc: { flex: 1 },
  cellQty: { width: 28, textAlign: 'right' },
  cellPrice: { width: 50, textAlign: 'right' },
  cellTotal: { width: 56, textAlign: 'right' },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderColor: '#0f172a',
    fontWeight: 700,
  },
  qrWrap: {
    width: 110,
    height: 110,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 4,
  },
  rejected: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 6,
    marginBottom: 8,
    color: '#b91c1c',
  },
})

export interface InvoicePdfProps {
  invoice: Invoice
  lineItems: InvoiceLineItem[]
  customer: Customer | null
  business: Pick<
    Business,
    'name_ar' | 'name_en' | 'cr_number' | 'contact_address' | 'contact_phone' | 'contact_email'
  > & { vat_number?: string | null }
  qrDataUrl: string | null
}

const labels = {
  ar: {
    taxInvoice: 'فاتورة ضريبية',
    simplifiedTaxInvoice: 'فاتورة ضريبية مبسطة',
    creditNote: 'إشعار دائن',
    debitNote: 'إشعار مدين',
    invoiceNo: 'رقم الفاتورة',
    issueDate: 'تاريخ الإصدار',
    supplyDate: 'تاريخ التوريد',
    dueDate: 'تاريخ الاستحقاق',
    seller: 'البائع',
    buyer: 'المشتري',
    walkIn: 'عميل عام',
    vatNo: 'الرقم الضريبي',
    crNo: 'السجل التجاري',
    description: 'الوصف',
    qty: 'الكمية',
    unitPrice: 'سعر الوحدة',
    lineTotal: 'الإجمالي',
    subtotal: 'المجموع قبل الضريبة',
    vat: 'ضريبة القيمة المضافة',
    grandTotal: 'الإجمالي',
    rejected: 'تم رفض هذه الفاتورة من قِبل هيئة الزكاة',
  },
  en: {
    taxInvoice: 'Tax Invoice',
    simplifiedTaxInvoice: 'Simplified Tax Invoice',
    creditNote: 'Credit Note',
    debitNote: 'Debit Note',
    invoiceNo: 'Invoice #',
    issueDate: 'Issue date',
    supplyDate: 'Supply date',
    dueDate: 'Due date',
    seller: 'Seller',
    buyer: 'Buyer',
    walkIn: 'Walk-in customer',
    vatNo: 'VAT #',
    crNo: 'CR #',
    description: 'Description',
    qty: 'Qty',
    unitPrice: 'Unit price',
    lineTotal: 'Total',
    rejected: 'This invoice was rejected by ZATCA',
    subtotal: 'Subtotal',
    vat: 'VAT',
    grandTotal: 'Total',
  },
} as const

type Lang = 'ar' | 'en'

function fmt(n: number) {
  return n.toFixed(2)
}

function PartyCard({
  lang,
  title,
  name,
  vat,
  cr,
  address,
}: {
  lang: Lang
  title: string
  name: string
  vat?: string | null
  cr?: string | null
  address?: string | null
}) {
  const L = labels[lang]
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.value}>{name || '—'}</Text>
      {vat ? (
        <Text style={styles.value}>
          {L.vatNo}: {vat}
        </Text>
      ) : null}
      {cr ? (
        <Text style={styles.value}>
          {L.crNo}: {cr}
        </Text>
      ) : null}
      {address ? <Text style={styles.value}>{address}</Text> : null}
    </View>
  )
}

function Column({
  lang,
  invoice,
  lineItems,
  customer,
  business,
}: InvoicePdfProps & { lang: Lang }) {
  const L = labels[lang]
  const docTitle =
    invoice.invoice_subtype === 'credit_note'
      ? L.creditNote
      : invoice.invoice_subtype === 'debit_note'
        ? L.debitNote
        : invoice.invoice_type === 'simplified'
          ? L.simplifiedTaxInvoice
          : L.taxInvoice

  const sellerName =
    lang === 'ar'
      ? business.name_ar || business.name_en || ''
      : business.name_en || business.name_ar || ''
  const buyerName =
    !customer
      ? invoice.invoice_type === 'simplified'
        ? L.walkIn
        : '—'
      : lang === 'ar'
        ? customer.name
        : customer.name_en || customer.name

  return (
    <View style={styles.col}>
      <Text style={styles.title}>{docTitle}</Text>
      <Text style={styles.subTitle}>
        {L.invoiceNo}: {invoice.invoice_number}
      </Text>
      <Text style={styles.subTitle}>
        {L.issueDate}: {invoice.issue_date}
      </Text>
      {invoice.supply_date ? (
        <Text style={styles.subTitle}>
          {L.supplyDate}: {invoice.supply_date}
        </Text>
      ) : null}
      {invoice.due_date ? (
        <Text style={styles.subTitle}>
          {L.dueDate}: {invoice.due_date}
        </Text>
      ) : null}

      {invoice.zatca_status === 'rejected' ? (
        <View style={styles.rejected}>
          <Text>{L.rejected}</Text>
          {invoice.zatca_rejection_reason ? (
            <Text>{invoice.zatca_rejection_reason}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: 8 }}>
        <PartyCard
          lang={lang}
          title={L.seller}
          name={sellerName}
          vat={business.vat_number ?? null}
          cr={business.cr_number}
          address={business.contact_address ?? null}
        />
        <PartyCard
          lang={lang}
          title={L.buyer}
          name={buyerName}
          vat={customer?.vat_number ?? null}
          cr={customer?.cr_number ?? null}
          address={customer?.address ?? null}
        />
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.cellNum}>#</Text>
          <Text style={styles.cellDesc}>{L.description}</Text>
          <Text style={styles.cellQty}>{L.qty}</Text>
          <Text style={styles.cellPrice}>{L.unitPrice}</Text>
          <Text style={styles.cellTotal}>{L.lineTotal}</Text>
        </View>
        {lineItems.map((li) => (
          <View key={li.id} style={styles.tableRow}>
            <Text style={styles.cellNum}>{li.line_number}</Text>
            <Text style={styles.cellDesc}>{li.description}</Text>
            <Text style={styles.cellQty}>{fmt(Number(li.quantity))}</Text>
            <Text style={styles.cellPrice}>{fmt(Number(li.unit_price))}</Text>
            <Text style={styles.cellTotal}>{fmt(Number(li.line_total))}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 8 }}>
        <View style={styles.totalsRow}>
          <Text>{L.subtotal}</Text>
          <Text>{fmt(Number(invoice.subtotal))} SAR</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text>{L.vat}</Text>
          <Text>{fmt(Number(invoice.total_vat))} SAR</Text>
        </View>
        <View style={styles.grandTotal}>
          <Text>{L.grandTotal}</Text>
          <Text>{fmt(Number(invoice.total_amount))} SAR</Text>
        </View>
      </View>
    </View>
  )
}

export function InvoicePdf(props: InvoicePdfProps) {
  const { invoice, qrDataUrl } = props

  // For B2B and `language='both'`, render bilingual side-by-side columns;
  // otherwise honour `invoice.language`.
  const bilingual =
    invoice.invoice_type === 'standard' || invoice.language === 'both'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {bilingual ? (
          <View style={styles.twoCol}>
            <Column {...props} lang="en" />
            <Column {...props} lang="ar" />
          </View>
        ) : (
          <Column {...props} lang={invoice.language === 'ar' ? 'ar' : 'en'} />
        )}

        {qrDataUrl ? (
          <View style={styles.qrWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qrDataUrl} />
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          {invoice.zatca_uuid ? `UUID: ${invoice.zatca_uuid}` : ''}
          {invoice.zatca_hash ? `   ·   Hash: ${invoice.zatca_hash}` : ''}
        </Text>
      </Page>
    </Document>
  )
}
