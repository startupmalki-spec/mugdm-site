/**
 * B2C Simplified-Invoice Reporting Worker (task 64).
 *
 * ZATCA allows up to 24h to REPORT simplified invoices, so we default B2C
 * submits to an optimistic local success + async background reporting:
 *   1. `submit` route signs the invoice locally, stores XML/hash/QR, sets
 *      `zatca_status='pending_clearance'`, and calls `enqueueReport`.
 *   2. A cron job (`/api/cron/process-report-queue`) calls
 *      `processReportQueue()` periodically. Each ready row runs the report
 *      pipeline against ZATCA's `/invoices/reporting/single` endpoint.
 *   3. Failures reschedule with exponential backoff
 *      (immediate, +5m, +30m, +2h, +12h). After the 5th failure, the row is
 *      dead-lettered and a `detected_issues` nudge is opened so the user can
 *      act (e.g. renew expired CSID, fix broken seller data).
 *
 * Concurrency: entries are processed sequentially inside a single cron run.
 * ZATCA's per-business throttle is the real bottleneck; parallelism would
 * just earn us 429s.
 */

import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import { reportInvoice, ZatcaApiError } from '@/lib/zatca/api-client'
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
  Database,
  Invoice,
  InvoiceLineItem,
  ZatcaCertificate,
} from '@/lib/supabase/types'

type ServiceClient = SupabaseClient<Database>

function buildServiceClient(): ServiceClient {
  return createSupabaseJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Backoff schedule in minutes. Index = attempt count BEFORE the next retry.
 * After we've tried 5 times (indices 1..5), attempts==5 triggers dead-letter.
 */
const BACKOFF_MINUTES = [0, 5, 30, 120, 720] // 0m, 5m, 30m, 2h, 12h
const MAX_ATTEMPTS = 5

export interface ProcessQueueResult {
  processed: number
  succeeded: number
  failed: number
  deadLettered: number
}

/**
 * Enqueue an invoice for async reporting. Idempotent — the unique index on
 * `invoice_id` means a second call is a no-op. Uses upsert so a re-enqueue
 * after a dead-letter manual reset would resume the loop.
 *
 * Caller is expected to ALSO flip the invoice to `zatca_status='pending_clearance'`
 * and persist the signed XML / hash / QR that it already computed locally.
 */
export async function enqueueReport(
  invoiceId: string,
  businessId: string,
  client?: ServiceClient,
): Promise<void> {
  const supabase = client ?? buildServiceClient()
  const { error } = await supabase
    .from('zatca_report_queue')
    // `as never` — loose typing to avoid coupling to generated Database type
    // updates before the migration is applied.
    .upsert(
      {
        invoice_id: invoiceId,
        business_id: businessId,
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        dead_letter: false,
        last_error: null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'invoice_id' },
    )
  if (error) {
    console.error('[report-worker] enqueue failed:', error)
    throw new Error(`Failed to enqueue report: ${error.message}`)
  }
}

interface QueueRow {
  id: string
  invoice_id: string
  business_id: string
  attempts: number
}

/**
 * Pull up to `limit` ready rows and process each sequentially.
 */
export async function processReportQueue(
  limit = 50,
  client?: ServiceClient,
): Promise<ProcessQueueResult> {
  const supabase = client ?? buildServiceClient()
  const nowIso = new Date().toISOString()

  const { data: rows, error } = await supabase
    .from('zatca_report_queue')
    .select('id, invoice_id, business_id, attempts')
    .eq('dead_letter', false)
    .lte('next_attempt_at', nowIso)
    .order('next_attempt_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[report-worker] fetch queue failed:', error)
    throw new Error(`Failed to read queue: ${error.message}`)
  }

  const result: ProcessQueueResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    deadLettered: 0,
  }

  for (const row of (rows ?? []) as QueueRow[]) {
    result.processed += 1
    const outcome = await processOne(supabase, row)
    if (outcome === 'succeeded') result.succeeded += 1
    else if (outcome === 'dead_lettered') {
      result.failed += 1
      result.deadLettered += 1
    } else {
      result.failed += 1
    }
  }

  return result
}

type Outcome = 'succeeded' | 'retry' | 'dead_lettered'

async function processOne(
  supabase: ServiceClient,
  row: QueueRow,
): Promise<Outcome> {
  try {
    // 1. Load invoice.
    const { data: invoiceData, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', row.invoice_id)
      .maybeSingle()
    if (invErr) throw new Error(`load invoice: ${invErr.message}`)
    if (!invoiceData) throw new Error('Invoice not found')
    const invoice = invoiceData as Invoice

    // If the invoice was already reported/cleared/rejected out-of-band, remove
    // the queue row — nothing to do.
    if (
      invoice.zatca_status === 'reported' ||
      invoice.zatca_status === 'cleared' ||
      invoice.zatca_status === 'rejected'
    ) {
      await supabase
        .from('zatca_report_queue')
        .delete()
        .eq('id', row.id)
      return 'succeeded'
    }

    // 2. Seller + cert.
    const { data: sellerData, error: sellerErr } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', invoice.business_id)
      .maybeSingle()
    if (sellerErr) throw new Error(`load seller: ${sellerErr.message}`)
    if (!sellerData) throw new Error('Seller business not found')
    const seller = sellerData as Business

    const certStatus = await getActiveCertStatus(supabase, invoice.business_id)
    if (!canCreateInvoices(certStatus) || !certStatus.cert) {
      // Cert expired / missing — retry with backoff. If the user renews in
      // time we'll recover automatically. Otherwise we dead-letter after
      // MAX_ATTEMPTS and surface a nudge directing them to renew.
      throw new Error('No active ZATCA certificate (expired or missing)')
    }
    const cert = certStatus.cert as ZatcaCertificate

    // 3. Line items.
    const { data: liData, error: liErr } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('line_number', { ascending: true })
    if (liErr) throw new Error(`load line items: ${liErr.message}`)
    const lineItems = (liData ?? []) as InvoiceLineItem[]
    if (lineItems.length === 0) throw new Error('Invoice has no line items')

    let buyer: Customer | null = null
    if (invoice.customer_id) {
      const { data: c } = await supabase
        .from('customers')
        .select('*')
        .eq('id', invoice.customer_id)
        .maybeSingle()
      buyer = (c ?? null) as Customer | null
    }

    // 4. UBL + sign.
    const { xml: unsignedXml, invoiceHash } = generateUblInvoice({
      invoice,
      lineItems,
      seller,
      buyer,
    })
    const privateKeyPem = decryptPrivateKey(cert.private_key_encrypted)
    const signed = signInvoiceXml({
      xml: unsignedXml,
      certificatePem: cert.certificate,
      privateKeyPem,
      signingTime: new Date().toISOString(),
    })
    const publicKeyB64 = extractPublicKeyFromCert(cert.certificate)

    const sellerVat =
      (seller as Business & { vat_number?: string }).vat_number ??
      seller.cr_number ??
      ''
    const qrCode = generateTlvQrCode({
      sellerName: seller.name_ar || seller.name_en || 'N/A',
      vatNumber: sellerVat,
      timestamp: new Date().toISOString(),
      totalWithVat: invoice.total_amount.toFixed(2),
      totalVat: invoice.total_vat.toFixed(2),
      xmlHash: invoiceHash,
      signature: signed.signatureValue,
      publicKey: publicKeyB64,
    })

    // 5. Report.
    const csidSecret =
      (cert as ZatcaCertificate & { csid_secret?: string }).csid_secret ?? ''
    const submittedAt = new Date().toISOString()

    const response = await reportInvoice(
      signed.signedXml,
      { binarySecurityToken: cert.certificate, secret: csidSecret },
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

      // Hard rejection from ZATCA — not a retryable network error. Mark the
      // invoice rejected, remove the queue row, open a nudge.
      await supabase
        .from('invoices')
        .update({
          zatca_status: 'rejected',
          zatca_submitted_at: submittedAt,
          zatca_rejection_reason: reason,
          zatca_response: (response.raw as Record<string, unknown>) ?? null,
          zatca_xml: signed.signedXml,
          zatca_hash: invoiceHash,
          zatca_qr_code: qrCode,
        } as never)
        .eq('id', invoice.id)
      await supabase.from('zatca_report_queue').delete().eq('id', row.id)
      await openDeadLetterNudge(supabase, invoice.business_id, invoice.id, reason)
      return 'dead_lettered'
    }

    // Success.
    await supabase
      .from('invoices')
      .update({
        zatca_status: 'reported',
        zatca_xml: signed.signedXml,
        zatca_hash: invoiceHash,
        zatca_qr_code: qrCode,
        zatca_submitted_at: submittedAt,
        zatca_rejection_reason: null,
        zatca_response: (response.raw as Record<string, unknown>) ?? null,
      } as never)
      .eq('id', invoice.id)

    await supabase.from('zatca_report_queue').delete().eq('id', row.id)
    return 'succeeded'
  } catch (err) {
    const reason =
      err instanceof ZatcaApiError
        ? `${err.zatcaErrorCode ?? ''} ${err.message}`.trim()
        : (err as Error).message
    console.error(
      `[report-worker] attempt failed for invoice ${row.invoice_id}:`,
      reason,
    )
    return rescheduleOrDeadLetter(supabase, row, reason)
  }
}

async function rescheduleOrDeadLetter(
  supabase: ServiceClient,
  row: QueueRow,
  reason: string,
): Promise<Outcome> {
  const newAttempts = row.attempts + 1

  if (newAttempts >= MAX_ATTEMPTS) {
    await supabase
      .from('zatca_report_queue')
      .update({
        attempts: newAttempts,
        dead_letter: true,
        last_error: reason.slice(0, 2000),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', row.id)
    await openDeadLetterNudge(
      supabase,
      row.business_id,
      row.invoice_id,
      reason,
    )
    return 'dead_lettered'
  }

  const delayMin = BACKOFF_MINUTES[newAttempts] ?? 720
  const nextAt = new Date(Date.now() + delayMin * 60 * 1000).toISOString()

  await supabase
    .from('zatca_report_queue')
    .update({
      attempts: newAttempts,
      next_attempt_at: nextAt,
      last_error: reason.slice(0, 2000),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', row.id)
  return 'retry'
}

/**
 * Insert a `detected_issues` row when a queue item dies. Mirrors the shape
 * used by `src/lib/intelligence/frustration-classifier.ts`. The title is
 * bilingual (Arabic + English concatenated) so existing UI that only renders
 * `title` still shows usable text in both tongues.
 */
async function openDeadLetterNudge(
  supabase: ServiceClient,
  businessId: string,
  invoiceId: string,
  reason: string,
): Promise<void> {
  try {
    const titleAr = 'فشل إبلاغ فاتورة مبسطة لهيئة الزكاة بعد عدة محاولات'
    const titleEn = 'Simplified invoice failed to report to ZATCA after multiple retries'
    const descAr =
      'تم تجاوز الحد الأقصى للمحاولات. يرجى مراجعة الفاتورة وحالة شهادة الزكاة ثم إعادة المحاولة يدويًا.'
    const descEn =
      'Max retries exceeded. Review the invoice and your ZATCA certificate status, then retry manually.'

    await supabase.from('detected_issues').insert({
      business_id: businessId,
      issue_type: 'bug',
      severity: 'high',
      status: 'open',
      source: 'system',
      feature_area: 'invoicing.zatca.reporting',
      title: `${titleAr} / ${titleEn}`,
      description: `${descAr}\n\n${descEn}\n\nLast error: ${reason}`,
      evidence: [
        {
          invoice_id: invoiceId,
          last_error: reason,
          component: 'zatca_report_queue',
          title_ar: titleAr,
          title_en: titleEn,
          description_ar: descAr,
          description_en: descEn,
        },
      ] as never,
    } as never)
  } catch (e) {
    console.error('[report-worker] failed to open dead-letter nudge:', e)
    // Non-fatal.
  }
}
