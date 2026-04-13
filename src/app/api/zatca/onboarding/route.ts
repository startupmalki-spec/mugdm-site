/**
 * POST /api/zatca/onboarding
 *
 * Orchestrates ZATCA Phase-2 onboarding server-side:
 *   1. Generate P-256 keypair + CSR (stub — see src/lib/zatca/csr.ts).
 *   2. requestComplianceCsid(otp, csr)          → compliance CSID
 *   3. submitComplianceInvoice(sample, csid)    → compliance check
 *   4. requestProductionCsid(complianceCsid)    → production CSID
 *   5. Encrypt private key, persist active row in `zatca_certificates`
 *      (cert_type='production', is_active=true).
 *   6. Flip `businesses.zatca_onboarded = true`.
 *   7. Seed a ZATCA_VAT obligation via the existing obligations table with a
 *      30-day reminder window before cert expiry.
 *
 * The client sends ONLY { vatNumber, crNumber, otp }. All CSR/key material
 * stays server-side.
 *
 * NOTE: The CSR is stubbed (see src/lib/zatca/csr.ts). ZATCA sandbox will
 * reject the stub payload; this endpoint is scaffolding for the wizard UI
 * and will become fully functional once `buildCsr()` is implemented.
 */

import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  requestComplianceCsid,
  submitComplianceInvoice,
  requestProductionCsid,
  ZatcaApiError,
  getZatcaErrorMessage,
} from '@/lib/zatca/api-client'
import { encryptPrivateKey } from '@/lib/zatca/cert-crypto'
import { generateCsr } from '@/lib/zatca/csr'
import type { Database } from '@/lib/supabase/types'

type Tables = Database['public']['Tables']

interface OnboardingRequest {
  vatNumber: string
  crNumber: string
  otp: string
}

interface TypedInsertBuilder<TInsert> {
  insert(values: TInsert | TInsert[]): PromiseLike<{ error: { message: string } | null }>
}
interface TypedUpdateBuilder {
  update(values: Record<string, unknown>): {
    eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }>
  }
}

/**
 * A minimal stand-in XML for the compliance check step. The real compliance
 * test flow (task 54/55) generates three signed sample invoices (standard,
 * simplified, credit-note). Here we post a placeholder; ZATCA will reject
 * it and we surface the error to the user. Replace once signing is wired.
 */
function buildSampleComplianceInvoice(params: {
  vatNumber: string
  crNumber: string
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- TODO(task-56): replace with signed UBL 2.1 sample invoice -->
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">SAMPLE-001</cbc:ID>
  <mugdm:stub xmlns:mugdm="https://mugdm.sa/ns" vat="${params.vatNumber}" cr="${params.crNumber}" />
</Invoice>`
}

export async function POST(request: Request) {
  let userId: string | undefined
  let businessId: string | undefined

  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id

    const body = (await request.json()) as Partial<OnboardingRequest>
    const vatNumber = (body.vatNumber ?? '').trim()
    const crNumber = (body.crNumber ?? '').trim()
    const otp = (body.otp ?? '').trim()

    if (!/^\d{15}$/.test(vatNumber)) {
      return NextResponse.json(
        { error: 'vatNumber must be 15 digits' },
        { status: 400 },
      )
    }
    if (!/^\d{10}$/.test(crNumber)) {
      return NextResponse.json(
        { error: 'crNumber must be 10 digits' },
        { status: 400 },
      )
    }
    if (!otp) {
      return NextResponse.json({ error: 'otp is required' }, { status: 400 })
    }

    // Resolve the user's business.
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, name_ar, name_en')
      .eq('user_id', user.id)
      .maybeSingle()

    if (bizError || !business) {
      return NextResponse.json(
        { error: 'No business found for user. Complete onboarding first.' },
        { status: 404 },
      )
    }
    businessId = business.id as string
    const businessName =
      (business as { name_ar?: string; name_en?: string }).name_ar ??
      (business as { name_ar?: string; name_en?: string }).name_en ??
      'Mugdm Business'

    // ── Step 1: generate keypair + CSR (CSR is stubbed; see csr.ts) ──
    const { csrPem, privateKeyPem } = generateCsr({
      vatNumber,
      crNumber,
      businessName,
    })

    // ── Step 2: compliance CSID ──
    const complianceCsid = await requestComplianceCsid({ otp, csr: csrPem })

    // ── Step 3: compliance invoice check ──
    const sampleXml = buildSampleComplianceInvoice({ vatNumber, crNumber })
    const complianceCheck = await submitComplianceInvoice(sampleXml, {
      binarySecurityToken: complianceCsid.binarySecurityToken,
      secret: complianceCsid.secret,
    })

    const checkStatus = complianceCheck.clearanceStatus ?? complianceCheck.reportingStatus
    if (
      checkStatus &&
      checkStatus !== 'CLEARED' &&
      checkStatus !== 'CLEARED_WITH_WARNINGS' &&
      checkStatus !== 'REPORTED' &&
      checkStatus !== 'REPORTED_WITH_WARNINGS'
    ) {
      return NextResponse.json(
        {
          error: 'Compliance check failed',
          details: complianceCheck.validationResults,
        },
        { status: 422 },
      )
    }

    // ── Step 4: production CSID ──
    const productionCsid = await requestProductionCsid({
      complianceCsid: complianceCsid.binarySecurityToken,
      complianceSecret: complianceCsid.secret,
      complianceRequestId: complianceCsid.requestID,
    })

    // ── Step 5: persist encrypted production cert ──
    const encryptedKey = encryptPrivateKey(privateKeyPem)
    const issuedAt = new Date()
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1) // ZATCA production CSID ~1y

    // Deactivate any previously-active production certs for this business to
    // respect the `(business_id, cert_type, is_active)` unique constraint.
    await (supabase.from('zatca_certificates') as unknown as TypedUpdateBuilder)
      .update({ is_active: false })
      .eq('business_id', businessId)

    const { error: certError } = await (
      supabase.from('zatca_certificates') as unknown as TypedInsertBuilder<
        Tables['zatca_certificates']['Insert']
      >
    ).insert({
      business_id: businessId,
      cert_type: 'production',
      certificate: productionCsid.binarySecurityToken,
      private_key_encrypted: encryptedKey,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_active: true,
    })

    if (certError) {
      console.error('[ZATCA onboarding] cert insert failed:', {
        userId,
        businessId,
        error: certError.message,
      })
      return NextResponse.json(
        { error: 'Failed to persist production certificate' },
        { status: 500 },
      )
    }

    // ── Step 6: flip flag on business ──
    await (supabase.from('businesses') as unknown as TypedUpdateBuilder)
      .update({ zatca_onboarded: true })
      .eq('id', businessId)

    // ── Step 7: seed renewal obligation w/ 30-day reminder window ──
    // The reminder_30d_sent = false default on the obligations table drives
    // the existing reminder pipeline (see rules-engine.ts / obligation-generator.ts).
    const renewalDate = new Date(expiresAt)
    await (
      supabase.from('obligations') as unknown as TypedInsertBuilder<
        Tables['obligations']['Insert']
      >
    ).insert({
      business_id: businessId,
      type: 'ZATCA_VAT',
      name: 'ZATCA Production CSID Renewal',
      description:
        'Renew the ZATCA production CSID before expiry to keep e-invoicing active.',
      frequency: 'ANNUAL',
      next_due_date: renewalDate.toISOString().split('T')[0],
      last_completed_at: null,
      reminder_30d_sent: false,
      reminder_15d_sent: false,
      reminder_7d_sent: false,
      reminder_1d_sent: false,
      linked_document_id: null,
      notes: null,
    })

    return NextResponse.json(
      {
        ok: true,
        certificate: {
          issuedAt: issuedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          requestId: productionCsid.requestID,
        },
        validationResults: complianceCheck.validationResults ?? null,
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof ZatcaApiError) {
      console.error('[ZATCA onboarding] api error:', {
        userId,
        businessId,
        status: err.statusCode,
        code: err.zatcaErrorCode,
        message: err.message,
      })
      return NextResponse.json(
        {
          error: err.message || getZatcaErrorMessage(err.zatcaErrorCode, 'en'),
          code: err.zatcaErrorCode,
        },
        { status: err.statusCode || 502 },
      )
    }
    console.error('[ZATCA onboarding] unexpected error:', {
      userId,
      businessId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
