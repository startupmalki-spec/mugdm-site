/**
 * Public share view for an invoice (Task 61).
 *
 * Verifies a JWT minted by /api/invoicing/invoices/[id]/share and renders a
 * read-only invoice view. Uses the Supabase service-role client to bypass RLS
 * (the JWT itself is the access grant). No app chrome — this page is meant to
 * be embedded in an email or shared with a non-user.
 *
 * Required env: SHARE_LINK_SECRET, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY.
 */

import { notFound } from 'next/navigation'
import jwt from 'jsonwebtoken'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { generateQrCodeImage } from '@/lib/zatca/qr-code'

interface PageProps {
  params: Promise<{ token: string }>
}

interface SharePayload {
  invoiceId: string
  iat: number
  exp: number
}

function fmt(n: number) {
  return Number(n).toFixed(2)
}

export const dynamic = 'force-dynamic'

export default async function SharedInvoicePage({ params }: PageProps) {
  const { token } = await params
  const secret = process.env.SHARE_LINK_SECRET
  if (!secret) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-sm text-red-600">Server misconfiguration.</div>
      </main>
    )
  }

  let payload: SharePayload
  try {
    payload = jwt.verify(token, secret) as SharePayload
  } catch {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold mb-1">Link expired</h1>
          <p className="text-sm text-slate-600">
            This share link is invalid or has expired. Ask the issuer for a new one.
          </p>
        </div>
      </main>
    )
  }

  const supabase = createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', payload.invoiceId)
    .maybeSingle()
  if (!invoice) return notFound()

  const [{ data: lineItems }, { data: business }, customerRes] =
    await Promise.all([
      supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('line_number', { ascending: true }),
      supabase
        .from('businesses')
        .select('id, name_ar, name_en, cr_number, contact_address, contact_phone, contact_email')
        .eq('id', invoice.business_id)
        .maybeSingle(),
      invoice.customer_id
        ? supabase.from('customers').select('*').eq('id', invoice.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  const customer = customerRes?.data ?? null

  const qrDataUrl = invoice.zatca_qr_code
    ? await generateQrCodeImage(invoice.zatca_qr_code)
    : null

  const sellerName = business?.name_en || business?.name_ar || ''
  const buyerName =
    customer?.name_en ||
    customer?.name ||
    (invoice.invoice_type === 'simplified' ? 'Walk-in customer' : '—')

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow border border-slate-200 p-8 text-slate-900">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {invoice.invoice_subtype === 'credit_note'
                ? 'Credit Note'
                : invoice.invoice_subtype === 'debit_note'
                  ? 'Debit Note'
                  : invoice.invoice_type === 'simplified'
                    ? 'Simplified Tax Invoice'
                    : 'Tax Invoice'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              #{invoice.invoice_number}
            </p>
            <p className="text-sm text-slate-600">
              Issued {invoice.issue_date}
            </p>
          </div>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="ZATCA QR code"
              className="w-28 h-28 bg-white"
            />
          ) : null}
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6">
          <div>
            <div className="text-xs text-slate-500 uppercase">Seller</div>
            <div className="text-sm font-medium">{sellerName}</div>
            {business?.cr_number && (
              <div className="text-xs text-slate-600">CR: {business.cr_number}</div>
            )}
            {business?.contact_address && (
              <div className="text-xs text-slate-600">{business.contact_address}</div>
            )}
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase">Buyer</div>
            <div className="text-sm font-medium">{buyerName}</div>
            {customer?.vat_number && (
              <div className="text-xs text-slate-600">VAT: {customer.vat_number}</div>
            )}
            {customer?.address && (
              <div className="text-xs text-slate-600">{customer.address}</div>
            )}
          </div>
        </section>

        <table className="w-full text-sm border-t border-slate-200">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2 pr-2 w-8">#</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 w-16 text-right">Qty</th>
              <th className="py-2 pr-2 w-24 text-right">Unit price</th>
              <th className="py-2 pr-2 w-24 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(lineItems ?? []).map((li) => (
              <tr key={li.id} className="border-t border-slate-100">
                <td className="py-2 pr-2 text-slate-500">{li.line_number}</td>
                <td className="py-2 pr-2">{li.description}</td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {fmt(Number(li.quantity))}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {fmt(Number(li.unit_price))}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {fmt(Number(li.line_total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 ml-auto sm:w-72 text-sm">
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Subtotal</span>
            <span className="tabular-nums">{fmt(Number(invoice.subtotal))} SAR</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">VAT</span>
            <span className="tabular-nums">{fmt(Number(invoice.total_vat))} SAR</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{fmt(Number(invoice.total_amount))} SAR</span>
          </div>
        </section>

        {invoice.zatca_uuid ? (
          <footer className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-400 break-all">
            UUID: {invoice.zatca_uuid}
            {invoice.zatca_hash ? ` · Hash: ${invoice.zatca_hash}` : ''}
          </footer>
        ) : null}
      </div>
    </main>
  )
}
