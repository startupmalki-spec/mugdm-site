/**
 * ZATCA Certificate / Private Key Crypto
 *
 * Symmetric encryption of ZATCA onboarding / production PEM private keys
 * at rest. Keys are stored encrypted in the database (column:
 * `businesses.zatca_private_key_encrypted`) and decrypted in-memory only
 * at signing time.
 *
 * DEVIATION FROM TASK DETAIL:
 *   Task 55 scaffolding example used AES-256-CBC. We use AES-256-GCM
 *   instead because it is authenticated (detects tampering) and is the
 *   modern standard for symmetric encryption of secrets at rest.
 *   Exported function names are unchanged so callers can swap without churn.
 *
 * Format (base64-wrapped):
 *   [ iv (12 bytes) || authTag (16 bytes) || ciphertext (n bytes) ]
 *
 * Key source: `process.env.ZATCA_CERT_ENCRYPTION_KEY`
 *   - Required at call time (fail-closed; no silent fallback).
 *   - 64 hex characters = 32 raw bytes.
 *   - Rotate by re-encrypting all stored keys; no KDF is applied here.
 *
 * @see PRD_ZATCA_EINVOICING.md §8 (Security)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12 // GCM recommended
const TAG_LEN = 16

const loadKey = (): Buffer => {
  const hex = process.env.ZATCA_CERT_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'ZATCA_CERT_ENCRYPTION_KEY is not set. Configure a 32-byte hex key (64 chars) for ZATCA private key encryption.',
    )
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ZATCA_CERT_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).',
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a PEM-encoded private key string.
 * Returns a single base64 string suitable for DB storage.
 */
export function encryptPrivateKey(privateKeyPem: string): string {
  const key = loadKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(privateKeyPem, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/**
 * Decrypt a base64 payload previously produced by `encryptPrivateKey`.
 * Throws on tampering or wrong key (GCM auth tag mismatch).
 */
export function decryptPrivateKey(encrypted: string): string {
  const key = loadKey()
  const buf = Buffer.from(encrypted, 'base64')
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Encrypted ZATCA private key payload is truncated.')
  }
  const iv = buf.subarray(0, IV_LEN)
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
