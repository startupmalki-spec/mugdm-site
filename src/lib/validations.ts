const CR_NUMBER_LENGTH = 10
const IQAMA_LENGTH = 10
// Matches: +966XXXXXXXXX, 966XXXXXXXXX, 05XXXXXXXX, 5XXXXXXXX
// Mobile (05x) and landline (01x) patterns
const SAUDI_PHONE_INTL_REGEX = /^\+?966[015]\d{8}$/
const SAUDI_PHONE_LOCAL_REGEX = /^0[15]\d{8}$/
const SAUDI_PHONE_SHORT_REGEX = /^[15]\d{8}$/

export function isValidCRNumber(cr: string): boolean {
  const digits = cr.replace(/\s/g, '')
  return digits.length === CR_NUMBER_LENGTH && /^\d+$/.test(digits)
}

/**
 * Verify a CR number against Wathq (live MoC data).
 *
 * Returns `{ valid: false }` when the format is wrong, when WATHQ_API_KEY is
 * not configured, or when Wathq rejects/cannot find the CR. Never throws —
 * callers can rely on this in a graceful-degradation chain.
 */
export async function validateCRWithWathq(crNumber: string): Promise<{
  valid: boolean
  status?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
  error?: string
}> {
  if (!isValidCRNumber(crNumber)) return { valid: false, error: 'INVALID_CR' }
  // Lazy import: keep this module side-effect-free for client bundles.
  const { lookupCR, isWathqConfigured } = await import('@/lib/wathq/client')
  if (!isWathqConfigured()) return { valid: false, error: 'NOT_CONFIGURED' }
  try {
    const res = await lookupCR(crNumber.replace(/\s/g, ''))
    const status = res.status ?? undefined
    const isActive =
      !status || /active|valid|نشط|سار/i.test(status)
    return { valid: isActive, status, data: res.data }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'UPSTREAM_ERROR',
    }
  }
}

/**
 * Saudi VAT registration numbers are 15 digits, must start AND end with the
 * digit "3" per ZATCA Fatoora spec (e.g. 3XXXXXXXXXXXXX3).
 */
export function isValidSaudiVat(vat: string): boolean {
  const digits = vat.replace(/\s/g, '')
  return (
    digits.length === 15 &&
    /^\d+$/.test(digits) &&
    digits.startsWith('3') &&
    digits.endsWith('3')
  )
}

export function isValidIqama(iqama: string): boolean {
  const digits = iqama.replace(/\s/g, '')
  if (digits.length !== IQAMA_LENGTH || !/^\d+$/.test(digits)) return false
  return digits.startsWith('1') || digits.startsWith('2')
}

export function isValidSaudiPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '')
  return (
    SAUDI_PHONE_INTL_REGEX.test(cleaned) ||
    SAUDI_PHONE_LOCAL_REGEX.test(cleaned) ||
    SAUDI_PHONE_SHORT_REGEX.test(cleaned)
  )
}

export function formatSaudiPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('966') && digits.length === 12) {
    const local = digits.slice(3)
    return `+966 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`
  }

  if (digits.startsWith('05') && digits.length === 10) {
    return `+966 ${digits.slice(1, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }

  return phone
}

export function maskIqama(iqama: string): string {
  const digits = iqama.replace(/\s/g, '')
  if (digits.length < 4) return digits
  return '***' + digits.slice(3)
}

export function isSaudiNational(iqama: string): boolean {
  return iqama.replace(/\s/g, '').startsWith('1')
}
