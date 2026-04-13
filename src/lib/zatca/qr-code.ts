/**
 * ZATCA TLV QR Code Generator
 *
 * Produces the base64-encoded TLV (Tag-Length-Value) payload that ZATCA
 * Phase 2 requires to be embedded in every invoice's cac:AdditionalDocumentReference
 * (name="QR"), and a PNG data URL for rendering on printed/PDF invoices.
 *
 * Tags (per ZATCA Security Implementation Standards §2.3):
 *   1 — Seller name                (UTF-8 string)
 *   2 — VAT registration number    (UTF-8 string)
 *   3 — Invoice timestamp          (ISO 8601 UTC, UTF-8 string)
 *   4 — Invoice total w/ VAT       (decimal string)
 *   5 — VAT total                  (decimal string)
 *   6 — Invoice XML hash           (raw bytes of SHA-256 digest)
 *   7 — ECDSA signature            (raw bytes of signatureValue)
 *   8 — ECDSA public key           (raw DER bytes)
 *   9 — Certificate signature      (raw bytes — simplified only; optional)
 *
 * Length byte: ZATCA uses a single byte for length. Values ≥ 256 bytes are
 * rejected (throw) rather than silently truncated.
 *
 * @see PRD_ZATCA_EINVOICING.md §7.2
 */

import QRCode from 'qrcode'

export interface GenerateTlvQrCodeParams {
  sellerName: string
  vatNumber: string
  /** ISO 8601 UTC timestamp, e.g. "2026-04-13T10:15:30Z". */
  timestamp: string
  /** Decimal string with 2 fractional digits, e.g. "115.00". */
  totalWithVat: string
  /** Decimal string with 2 fractional digits, e.g. "15.00". */
  totalVat: string
  /** Base64-encoded SHA-256 of the canonical invoice XML. */
  xmlHash: string
  /** Base64-encoded ECDSA signature value. */
  signature: string
  /** Base64-encoded DER public key. */
  publicKey: string
  /** Base64-encoded certificate signature (simplified B2C — tag 9). */
  certificateSignature?: string
}

const encodeTlv = (tag: number, value: Buffer): Buffer => {
  if (value.length > 255) {
    throw new Error(
      `ZATCA TLV tag ${tag} value is ${value.length} bytes; max 255 bytes per single-byte length encoding.`,
    )
  }
  return Buffer.concat([Buffer.from([tag, value.length]), value])
}

/**
 * Produce the ZATCA base64 TLV payload.
 *
 * Tags 6/7/8 receive the RAW bytes of the supplied base64 inputs (i.e. the
 * inputs are decoded before being embedded — the outer payload is then
 * base64-encoded as a whole). This matches ZATCA's spec: the QR content
 * is `base64(TLV-of-raw-bytes)`, NOT `base64(TLV-of-base64-strings)`.
 */
export function generateTlvQrCode(params: GenerateTlvQrCodeParams): string {
  const {
    sellerName,
    vatNumber,
    timestamp,
    totalWithVat,
    totalVat,
    xmlHash,
    signature,
    publicKey,
    certificateSignature,
  } = params

  const parts: Buffer[] = [
    encodeTlv(1, Buffer.from(sellerName, 'utf8')),
    encodeTlv(2, Buffer.from(vatNumber, 'utf8')),
    encodeTlv(3, Buffer.from(timestamp, 'utf8')),
    encodeTlv(4, Buffer.from(totalWithVat, 'utf8')),
    encodeTlv(5, Buffer.from(totalVat, 'utf8')),
    encodeTlv(6, Buffer.from(xmlHash, 'base64')),
    encodeTlv(7, Buffer.from(signature, 'base64')),
    encodeTlv(8, Buffer.from(publicKey, 'base64')),
  ]

  if (certificateSignature) {
    parts.push(encodeTlv(9, Buffer.from(certificateSignature, 'base64')))
  }

  return Buffer.concat(parts).toString('base64')
}

/**
 * Render the TLV payload as a PNG data URL suitable for <img src=…> or PDF embed.
 */
export async function generateQrCodeImage(tlvBase64: string): Promise<string> {
  return QRCode.toDataURL(tlvBase64, {
    errorCorrectionLevel: 'M',
    width: 300,
    margin: 1,
  })
}
