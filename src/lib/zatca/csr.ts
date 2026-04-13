/**
 * ZATCA CSR (Certificate Signing Request) generation.
 *
 * ZATCA Phase-2 requires an ECDSA P-256 keypair and a PKCS#10 CSR carrying a
 * set of mandatory custom OIDs (VAT number, CR number, invoice type flag,
 * solution name, etc.) encoded inside `subjectAltName`.
 *
 * STATUS: STUB.
 *   Real CSR construction requires DER/ASN.1 encoding of the custom OIDs
 *   exactly as ZATCA specifies (see ZATCA "Compliance and Enablement Toolbox"
 *   section on CSR requirements). This file ships a functional P-256 keypair
 *   generator plus a placeholder CSR body. Before running against ZATCA
 *   sandbox/production, replace `buildCsr()` with a real implementation using
 *   one of:
 *     - `node-forge` (pure JS, supports custom OIDs via asn1)
 *     - `@peculiar/x509` + `@peculiar/asn1-*` (typed, modern)
 *     - OpenSSL CLI via a prebuilt template config
 *
 * The shape of `generateCsr()`'s return value is stable and what the rest of
 * the onboarding flow consumes, so callers will not need to change when the
 * stub is replaced.
 */

import { generateKeyPairSync } from 'node:crypto'

export interface CsrInput {
  /** 15-digit VAT registration number. */
  vatNumber: string
  /** 10-digit Commercial Registration number. */
  crNumber: string
  /** Business legal name (Arabic preferred). */
  businessName: string
  /** 'SA'. */
  countryCode?: string
  /**
   * Invoice type flag: '1100' = both standard + simplified.
   * See ZATCA CSR spec §"invoiceType".
   */
  invoiceType?: string
  /** Fatoora environment the CSR is intended for. */
  environment?: 'sandbox' | 'simulation' | 'production'
}

export interface CsrBundle {
  /** PEM-encoded PKCS#10 CSR — sent to ZATCA /compliance. */
  csrPem: string
  /** PEM-encoded EC private key (unencrypted). Caller MUST encrypt at rest. */
  privateKeyPem: string
  /** PEM-encoded EC public key, for debugging/inspection only. */
  publicKeyPem: string
}

/**
 * Generate a P-256 ECDSA keypair + (stubbed) CSR for ZATCA onboarding.
 *
 * TODO(task-56): Replace the placeholder CSR body below with a real
 * PKCS#10 request signed by `privateKey` and populated with ZATCA's
 * mandatory custom OIDs in `subjectAltName`:
 *   - 1.3.6.1.4.1.311.20.2  (template name)
 *   - CN = {common name}
 *   - ZATCA-specific SAN entries (VAT, CR, invoice type, solution name,
 *     business industry, etc.)
 */
export function generateCsr(input: CsrInput): CsrBundle {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // P-256 / secp256r1 — ZATCA mandated curve
  })

  const privateKeyPem = privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString()
  const publicKeyPem = publicKey
    .export({ type: 'spki', format: 'pem' })
    .toString()

  const csrPem = buildCsr(input, privateKeyPem)

  return { csrPem, privateKeyPem, publicKeyPem }
}

/**
 * STUB — build a PEM CSR.
 *
 * Current behaviour: returns a clearly-marked placeholder string so the
 * onboarding flow end-to-end can be wired up and tested against a mocked
 * ZATCA client. ZATCA WILL reject this; swap to real ASN.1/DER encoding
 * before enabling live onboarding.
 */
export function buildCsr(input: CsrInput, _privateKeyPem: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      __stub: true,
      vat: input.vatNumber,
      cr: input.crNumber,
      name: input.businessName,
      country: input.countryCode ?? 'SA',
      invoiceType: input.invoiceType ?? '1100',
      env: input.environment ?? 'sandbox',
    }),
    'utf8',
  ).toString('base64')

  return [
    '-----BEGIN CERTIFICATE REQUEST-----',
    payload,
    '-----END CERTIFICATE REQUEST-----',
    '',
  ].join('\n')
}
