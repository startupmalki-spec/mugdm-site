/**
 * POST /api/invoicing/invoices/[id]/submit
 *
 * Submits a draft standard (B2B) invoice to ZATCA clearance.
 *
 * Pipeline:
 *   1. Load invoice + line items (ordered) + seller business + buyer customer.
 *   2. Load the active production ZATCA certificate for the business and
 *      enforce `canCreateInvoices(status)` (403 if past grace period).
 *   3. Build unsigned UBL XML via `generateUblInvoice`.
 *   4. XAdES-BES sign via `signInvoiceXml` (uses the decrypted private key).
 *   5. Compute TLV QR payload via `generateTlvQrCode` (ZATCA trusts the QR we
 *      embed; on clearance success we may replace it with the QR returned by
 *      ZATCA — see below).
 *   6. POST to `clearInvoice`.
 *   7. On success → mark invoice cleared with XML/hash/QR/UUID/cleared_at.
 *      On ZATCA rejection → mark rejected with the rejection reason.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Known ambiguity (documented in report):
 *   The `zatca_certificates` schema stores `certificate` (binarySecurityToken)
 *   and `private_key_encrypted` only — there is no column for the paired CSID
 *   `secret` required for Basic auth against ZATCA. Once that column is
 *   added (see follow-up migration), pass it into `clearInvoice` below. For
 *   now we send an empty secret which will fail against the real ZATCA
 *   endpoint; this code path is shape-correct and ready for that column.
 * ────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { enqueueReport } from '@/lib/invoicing/report-worker'
import {
  clearInvoice,
  reportInvoice,
  ZatcaApiError,
} from '@/lib/zatca/api-client'
import { decryptPrivateKey } from '@/lib/zatca/cert-crypto'
import {
  canCreateInvoices,
  getActiveCertStatus,
} from '@/lib/zatca/cert-monitor'
import { generateTlvQrCode } from '@/lib/zatca/qr-code'
import {
  extractPublicKeyFromCert,
  signInvoiceXml,
} from '@/lib/zatca/signing'
import { generateUblInvoice } from '@/lib/zatca/ubl-generator'
import type {
  Business,
  Customer,
  Invoice,
  InvoiceLineItem,
  ZatcaCertificate,
} from '@/lib/supabase/types'

function bilingualError(ar: string, en: string, status: number) {
  return NextResponse.json({ error: { ar, en } }, { status })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params

    // Task 64: B2C simplified invoices default to async reporting (the ZATCA
    // spec allows a 24h window). Callers can force the legacy synchronous
    // path by passing `?sync=1` or a body `{ syncReport: true }` flag —
    // used mainly by tests. B2B clearance is always synchronous.
    const url = new URL(request.url)
    const syncQuery = url.searchParams.get('sync')
    let syncBody = false
    try {
      const ct = request.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        const body = (await request.clone().json().catch(() => null)) as
          | { syncReport?: boolean }
          | null
        syncBody = Boolean(body?.syncReport)
      }
    } catch {
      // Ignore body parse errors — sync flag is optional.
    }
    const forceSync = syncQuery === '1' || syncQuery === 'true' || syncBody
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return bilingualError('غير مصرّح.', 'Unauthorized.', 401)
    }

    // 1. Load invoice.
    const { data: invoiceRow, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (invErr) {
      console.error('[invoices/:id/submit] invoice load failed:', invErr)
      return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
    }
    if (!invoiceRow) {
      return bilingualError(
        'الفاتورة غير موجودة.',
        'Invoice not found.',
        404,
      )
    }
    const invoice = invoiceRow as Invoice

    if (invoice.zatca_status !== 'draft') {
      return bilingualError(
        'هذه الفاتورة تم إرسالها مسبقًا.',
        'This invoice has already been submitted.',
        409,
      )
    }

    // Ownership.
    const { data: seller } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', invoice.business_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!seller) {
      return bilingualError(
        'النشاط التجاري غير موجود أو لا يخصّك.',
        'Business not found or not owned by current user.',
        403,
      )
    }

    // 2. Cert + hard-block gate.
    const certStatus = await getActiveCertStatus(supabase, invoice.business_id)
    if (!canCreateInvoices(certStatus)) {
      return bilingualError(
        'انتهت صلاحية شهادة الزكاة. يرجى تجديد CSID الإنتاج قبل إرسال الفواتير.',
        'ZATCA certificate has expired. Renew the production CSID before submitting invoices.',
        403,
      )
    }
    if (!certStatus.cert) {
      return bilingualError(
        'لا توجد شهادة ZATCA فعّالة.',
        'No active ZATCA production certificate.',
        412,
      )
    }
    const cert = certStatus.cert as ZatcaCertificate

    // 3. Line items + buyer.
    const { data: lineItemsData, error: liErr } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('line_number', { ascending: true })
    if (liErr) {
      console.error('[invoices/:id/submit] line items load failed:', liErr)
      return bilingualError(
        'فشل تحميل بنود الفاتورة.',
        'Failed to load line items.',
        500,
      )
    }
    const lineItems = (lineItemsData ?? []) as InvoiceLineItem[]
    if (lineItems.length === 0) {
      return bilingualError(
        'الفاتورة لا تحتوي على بنود.',
        'Invoice has no line items.',
        400,
      )
    }

    let buyer: Customer | null = null
    if (invoice.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', invoice.customer_id)
        .maybeSingle()
      buyer = (customer ?? null) as Customer | null
    }

    // 4. Build UBL + sign.
    const { xml: unsignedXml, invoiceHash } = generateUblInvoice({
      invoice,
      lineItems,
      seller: seller as Business,
      buyer,
    })

    let signedXml: string
    let signatureValue: string
    let publicKeyB64: string
    try {
      const privateKeyPem = decryptPrivateKey(cert.private_key_encrypted)
      const signed = signInvoiceXml({
        xml: unsignedXml,
        certificatePem: cert.certificate,
        privateKeyPem,
        signingTime: new Date().toISOString(),
      })
      signedXml = signed.signedXml
      signatureValue = signed.signatureValue
      publicKeyB64 = extractPublicKeyFromCert(cert.certificate)
    } catch (e) {
      console.error('[invoices/:id/submit] signing failed:', e)
      return bilingualError(
        'فشل توقيع الفاتورة.',
        'Failed to sign invoice XML.',
        500,
      )
    }

    // 5. QR payload.
    const sellerVat =
      (seller as Business & { vat_number?: string }).vat_number ??
      seller.cr_number ??
      ''
    const qrCode = generateTlvQrCode({
      sellerName: (seller as Business).name_ar || (seller as Business).name_en || 'N/A',
      vatNumber: sellerVat,
      timestamp: new Date().toISOString(),
      totalWithVat: invoice.total_amount.toFixed(2),
      totalVat: invoice.total_vat.toFixed(2),
      xmlHash: invoiceHash,
      signature: signatureValue,
      publicKey: publicKeyB64,
    })

    // 6. Submit.
    // See file-level ambiguity: the `secret` is not persisted yet.
    const csidSecret =
      (cert as ZatcaCertificate & { csid_secret?: string }).csid_secret ?? ''

    const submittedAt = new Date().toISOString()
    const isSimplified = invoice.invoice_type === 'simplified'

    // Task 64: async path for simplified invoices (default).
    if (isSimplified && !forceSync) {
      // Persist the locally computed signed XML, hash, TLV QR, and flip to
      // `pending_clearance` so the UI can show the receipt immediately. The
      // background worker (`/api/cron/process-report-queue`) will actually
      // report to ZATCA and flip the status to `reported` or `rejected`.
      const { error: upErr } = await supabase
        .from('invoices')
        .update({
          zatca_status: 'pending_clearance',
          zatca_xml: signedXml,
          zatca_hash: invoiceHash,
          zatca_qr_code: qrCode,
          zatca_submitted_at: submittedAt,
          zatca_rejection_reason: null,
        } as never)
        .eq('id', id)
      if (upErr) {
        console.error('[invoices/:id/submit] pre-enqueue update failed:', upErr)
        return bilingualError(
          'فشل تحديث السجل محليًا قبل إضافته للطابور.',
          'Failed to update local record before enqueueing.',
          500,
        )
      }

      try {
        await enqueueReport(id, invoice.business_id)
      } catch (e) {
        console.error('[invoices/:id/submit] enqueue failed:', e)
        return bilingualError(
          'فشل إضافة الفاتورة إلى طابور الإبلاغ.',
          'Failed to enqueue invoice for reporting.',
          500,
        )
      }

      return NextResponse.json({
        ok: true,
        zatca_status: 'pending_clearance',
        queued: true,
        invoice_hash: invoiceHash,
        qr_code: qrCode,
      })
    }

    try {
      if (isSimplified) {
        // B2C simplified: report (fire-and-forget style). ZATCA does async
        // validation; we mark the invoice `reported` on ack and rely on the
        // embedded TLV QR for the customer receipt.
        const response = await reportInvoice(
          signedXml,
          {
            binarySecurityToken: cert.certificate,
            secret: csidSecret,
          },
          { invoiceHash, uuid: invoice.zatca_uuid ?? undefined },
        )

        const status = response.reportingStatus
        const isReported =
          status === 'REPORTED' || status === 'REPORTED_WITH_WARNINGS'

        if (!isReported) {
          const rejectionMessages =
            response.validationResults?.errorMessages?.map(
              (m) => m.message ?? m.code ?? 'unknown',
            ) ?? []
          const reason =
            rejectionMessages.join('; ') || status || 'ZATCA rejected invoice.'

          await supabase
            .from('invoices')
            .update({
              zatca_status: 'rejected',
              zatca_submitted_at: submittedAt,
              zatca_rejection_reason: reason,
              zatca_response: (response.raw as Record<string, unknown>) ?? null,
              zatca_xml: signedXml,
              zatca_hash: invoiceHash,
              zatca_qr_code: qrCode,
            } as never)
            .eq('id', id)

          return NextResponse.json(
            {
              ok: false,
              zatca_status: 'rejected',
              rejection_reason: reason,
            },
            { status: 422 },
          )
        }

        const { error: upErr } = await supabase
          .from('invoices')
          .update({
            zatca_status: 'reported',
            zatca_xml: signedXml,
            zatca_hash: invoiceHash,
            zatca_qr_code: qrCode,
            zatca_uuid: invoice.zatca_uuid,
            zatca_submitted_at: submittedAt,
            // Reported invoices are not "cleared" — leave zatca_cleared_at null.
            zatca_rejection_reason: null,
            zatca_response: (response.raw as Record<string, unknown>) ?? null,
          } as never)
          .eq('id', id)

        if (upErr) {
          console.error('[invoices/:id/submit] update post-reporting failed:', upErr)
          return bilingualError(
            'تم الإبلاغ لدى الهيئة لكن فشل تحديث السجل محليًا.',
            'Reported to ZATCA but failed to update local record.',
            500,
          )
        }

        return NextResponse.json({
          ok: true,
          zatca_status: 'reported',
          invoice_hash: invoiceHash,
          qr_code: qrCode,
        })
      }

      const response = await clearInvoice(
        signedXml,
        {
          binarySecurityToken: cert.certificate,
          secret: csidSecret,
        },
        { invoiceHash, uuid: invoice.zatca_uuid ?? undefined },
      )

      const status = response.clearanceStatus
      const isCleared =
        status === 'CLEARED' || status === 'CLEARED_WITH_WARNINGS'

      if (!isCleared) {
        const rejectionMessages =
          response.validationResults?.errorMessages?.map(
            (m) => m.message ?? m.code ?? 'unknown',
          ) ?? []
        const reason =
          rejectionMessages.join('; ') || status || 'ZATCA rejected invoice.'

        await supabase
          .from('invoices')
          .update({
            zatca_status: 'rejected',
            zatca_submitted_at: submittedAt,
            zatca_rejection_reason: reason,
            zatca_response: (response.raw as Record<string, unknown>) ?? null,
            zatca_xml: signedXml,
            zatca_hash: invoiceHash,
            zatca_qr_code: qrCode,
          } as never)
          .eq('id', id)

        return NextResponse.json(
          {
            ok: false,
            zatca_status: 'rejected',
            rejection_reason: reason,
          },
          { status: 422 },
        )
      }

      // Success: prefer ZATCA's cleared XML + QR when returned.
      const clearedXml = response.clearedInvoice
        ? Buffer.from(response.clearedInvoice, 'base64').toString('utf8')
        : signedXml
      const finalQr = response.qrCode ?? qrCode
      const finalHash = response.invoiceHash ?? invoiceHash

      const { error: upErr } = await supabase
        .from('invoices')
        .update({
          zatca_status: 'cleared',
          zatca_xml: clearedXml,
          zatca_hash: finalHash,
          zatca_qr_code: finalQr,
          zatca_uuid: invoice.zatca_uuid,
          zatca_submitted_at: submittedAt,
          zatca_cleared_at: submittedAt,
          zatca_rejection_reason: null,
          zatca_response: (response.raw as Record<string, unknown>) ?? null,
        } as never)
        .eq('id', id)

      if (upErr) {
        console.error('[invoices/:id/submit] update post-clearance failed:', upErr)
        return bilingualError(
          'تم القبول لدى الهيئة لكن فشل تحديث السجل محليًا.',
          'Cleared by ZATCA but failed to update local record.',
          500,
        )
      }

      return NextResponse.json({
        ok: true,
        zatca_status: 'cleared',
        invoice_hash: finalHash,
        qr_code: finalQr,
      })
    } catch (e) {
      const isZatca = e instanceof ZatcaApiError
      const reason = isZatca
        ? `${(e as ZatcaApiError).zatcaErrorCode ?? ''} ${(e as Error).message}`.trim()
        : (e as Error).message
      console.error('[invoices/:id/submit] submission failed:', e)

      await supabase
        .from('invoices')
        .update({
          zatca_status: 'rejected',
          zatca_submitted_at: submittedAt,
          zatca_rejection_reason: reason,
          zatca_xml: signedXml,
          zatca_hash: invoiceHash,
          zatca_qr_code: qrCode,
        } as never)
        .eq('id', id)

      return NextResponse.json(
        { ok: false, zatca_status: 'rejected', rejection_reason: reason },
        { status: 502 },
      )
    }
  } catch (err) {
    console.error('[invoices/:id/submit] failed:', err)
    return bilingualError('خطأ غير متوقّع.', 'Unexpected error.', 500)
  }
}
