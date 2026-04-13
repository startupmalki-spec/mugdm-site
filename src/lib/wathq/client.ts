/**
 * Wathq Commercial Registration API client.
 *
 * Wathq is the Saudi government data marketplace (https://api.wathq.sa) that
 * exposes verified Ministry of Commerce CR records via REST.
 *
 * Endpoint: GET https://api.wathq.sa/v5/commercialregistration/info/{crNumber}
 * Auth:     header `apiKey: <WATHQ_API_KEY>`
 *
 * NOTE: The exact response schema is documented in the Wathq OpenAPI YAML
 *   (https://developer.wathq.sa/sites/default/files/2026-01/Wathq%20Commercial%20Registration%20API%20v6.15.0_0.yaml)
 *   We have not fetched it in this dev environment (no network) so the
 *   `WathqRawResponse` shape below is intentionally permissive (`any` /
 *   optional). Tighten these types once a real successful response is
 *   captured.  TODO(types): replace `WathqRawResponse` with generated types.
 */

import type { CRAgentData, CROwner } from '@/lib/agents/cr-agent'

const WATHQ_CR_URL = 'https://api.wathq.sa/v5/commercialregistration/info'
const WATHQ_UNIFIED_URL = 'https://api.wathq.sa/v5/commercialregistration/unified'
const REQUEST_TIMEOUT_MS = 10_000

export type WathqErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_CR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'

export class WathqError extends Error {
  constructor(public code: WathqErrorCode, message: string, public status?: number) {
    super(message)
    this.name = 'WathqError'
  }
}

/**
 * Permissive raw response shape based on documented Wathq fields.
 * All optional — the API is known to omit fields when not applicable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WathqRawResponse = Record<string, any>

export interface WathqLookupResult {
  raw: WathqRawResponse
  data: CRAgentData
  status: string | null // "active", "expired", etc.
  vatNumber: string | null
}

/* ───────── Helpers ───────── */

function pickString(obj: WathqRawResponse | undefined, ...keys: string[]): string | null {
  if (!obj) return null
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return null
}

function pickNested(obj: WathqRawResponse | undefined, path: string[]): unknown {
  let cur: unknown = obj
  for (const seg of path) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg]
    } else {
      return undefined
    }
  }
  return cur
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const s = String(value)
  // Accept "YYYY-MM-DD", ISO timestamps, or epoch-like strings
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

function extractOwners(raw: WathqRawResponse): CROwner[] {
  // Wathq commonly exposes parties under `parties`, `owners`, `partners`,
  // `members`, or under `entity.parties`. Be defensive.
  const candidates: unknown[] = [
    raw.parties,
    raw.owners,
    raw.partners,
    raw.members,
    pickNested(raw, ['entity', 'parties']),
    pickNested(raw, ['entity', 'owners']),
  ]
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      return c
        .map((p): CROwner | null => {
          if (!p || typeof p !== 'object') return null
          const party = p as Record<string, unknown>
          const name =
            (typeof party.name === 'string' && party.name) ||
            (typeof party.fullName === 'string' && party.fullName) ||
            (typeof party.partyName === 'string' && party.partyName) ||
            ''
          const id =
            (typeof party.identity === 'string' && party.identity) ||
            (typeof party.id === 'string' && party.id) ||
            (typeof party.idNumber === 'string' && party.idNumber) ||
            (typeof party.nationalId === 'string' && party.nationalId) ||
            ''
          const shareRaw =
            (typeof party.share === 'number' && party.share) ||
            (typeof party.sharePercentage === 'number' && party.sharePercentage) ||
            (typeof party.percentage === 'number' && party.percentage) ||
            0
          if (!name) return null
          return { name, id_number: String(id), share: Number(shareRaw) || 0 }
        })
        .filter((o): o is CROwner => o !== null)
    }
  }
  return []
}

/**
 * Map a raw Wathq response into our internal CRAgentData shape.
 * Defensive: never throws on unexpected/missing fields.
 */
export function mapWathqToCRData(raw: WathqRawResponse): WathqLookupResult {
  const entity: WathqRawResponse | undefined =
    (raw.entity as WathqRawResponse | undefined) ?? raw

  const nameAr =
    pickString(entity, 'crName', 'tradeName', 'name', 'arabicName') ??
    pickString(raw, 'crName', 'tradeName', 'name', 'arabicName')

  const nameEn =
    pickString(entity, 'crEnglishName', 'tradeNameEn', 'englishName', 'nameEn') ??
    pickString(raw, 'crEnglishName', 'tradeNameEn', 'englishName', 'nameEn')

  const crNumber =
    pickString(raw, 'crNumber', 'crEntityNumber', 'commercialRegistrationNumber') ??
    pickString(entity, 'crNumber')

  const issuanceDate = normalizeDate(
    raw.issueDate ?? raw.crIssueDate ?? entity?.issueDate ?? entity?.crIssueDate
  )
  const expiryDate = normalizeDate(
    raw.expiryDate ?? raw.crExpiryDate ?? entity?.expiryDate ?? entity?.crExpiryDate
  )

  const activityType =
    pickString(entity, 'activityType', 'mainActivity', 'activity') ??
    pickString(raw, 'activityType', 'mainActivity', 'activity')

  const cityRaw =
    pickNested(raw, ['address', 'city']) ??
    pickNested(entity, ['address', 'city']) ??
    raw.city ??
    entity?.city
  const city = typeof cityRaw === 'string' ? cityRaw : pickString({ v: cityRaw } as never, 'v')

  const capitalRaw =
    raw.capital ??
    pickNested(raw, ['capital', 'announced']) ??
    pickNested(raw, ['capital', 'amount']) ??
    pickNested(entity, ['capital', 'announced']) ??
    entity?.capital
  const capital =
    typeof capitalRaw === 'number'
      ? String(capitalRaw)
      : typeof capitalRaw === 'string' && capitalRaw.trim()
        ? capitalRaw.trim()
        : null

  const legalForm =
    pickString(entity, 'legalForm', 'legalEntity', 'companyType') ??
    pickString(raw, 'legalForm', 'legalEntity', 'companyType')

  const status =
    pickString(raw, 'status', 'crStatus') ??
    pickString(entity, 'status', 'crStatus')

  // VAT may live under `vatNumber`, `vat`, or under a `taxes`/`vat` block.
  const vatNumber =
    pickString(raw, 'vatNumber', 'vat') ??
    pickString(entity, 'vatNumber', 'vat') ??
    (typeof pickNested(raw, ['vat', 'number']) === 'string'
      ? (pickNested(raw, ['vat', 'number']) as string)
      : null)

  const data: CRAgentData = {
    name_ar: nameAr,
    name_en: nameEn,
    cr_number: crNumber,
    cr_expiry_date: expiryDate,
    cr_issuance_date: issuanceDate,
    activity_type: activityType,
    city: typeof city === 'string' ? city : null,
    capital,
    owners: extractOwners(raw),
    barcode_url: null,
    legal_form: legalForm,
    main_activity_code: pickString(entity, 'mainActivityCode') ?? pickString(raw, 'mainActivityCode'),
    sub_activities: Array.isArray(raw.subActivities)
      ? raw.subActivities.filter((s: unknown): s is string => typeof s === 'string')
      : [],
    fiscal_year_end:
      pickString(entity, 'fiscalYearEnd', 'financialYearEnd') ??
      pickString(raw, 'fiscalYearEnd', 'financialYearEnd'),
  }

  return { raw, data, status, vatNumber }
}

/* ───────── Public API ───────── */

export function isWathqConfigured(): boolean {
  return Boolean(process.env.WATHQ_API_KEY && process.env.WATHQ_API_KEY.trim())
}

/**
 * Look up a CR number via Wathq.
 * Throws `WathqError` on any failure (including NOT_CONFIGURED).
 */
export async function lookupCR(crNumber: string): Promise<WathqLookupResult> {
  // Wathq's THIQAH gateway requires both Consumer Key and Consumer Secret
  // as separate headers (apiKey + apiSecret).
  const stripQuotes = (v?: string) =>
    v?.trim().replace(/^["']|["']$/g, '') ?? ''
  const apiKey = stripQuotes(process.env.WATHQ_API_KEY)
  const apiSecret = stripQuotes(process.env.WATHQ_API_SECRET)
  if (!apiKey) {
    throw new WathqError('NOT_CONFIGURED', 'WATHQ_API_KEY is not set')
  }

  const digits = crNumber.replace(/\s/g, '')
  if (!/^\d{10}$/.test(digits)) {
    throw new WathqError('INVALID_CR', 'CR number must be 10 digits')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  const headers: Record<string, string> = {
    apiKey,
    Accept: 'application/json',
  }
  if (apiSecret) {
    headers.apiSecret = apiSecret
  }

  let res: Response
  try {
    // Wathq has two endpoints: regular CR (most numbers) and Unified Number
    // (700-series). Pick by prefix so callers can paste either.
    const baseUrl = digits.startsWith('7') ? WATHQ_UNIFIED_URL : WATHQ_CR_URL
    res = await fetch(`${baseUrl}/${digits}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new WathqError('TIMEOUT', 'Wathq request timed out')
    }
    throw new WathqError(
      'NETWORK_ERROR',
      err instanceof Error ? err.message : 'Network error contacting Wathq'
    )
  }
  clearTimeout(timer)

  if (res.status === 401 || res.status === 403) {
    throw new WathqError('UNAUTHORIZED', 'Wathq rejected the API key', res.status)
  }
  if (res.status === 404) {
    throw new WathqError('NOT_FOUND', 'CR number not found at Wathq', 404)
  }
  if (res.status === 429) {
    throw new WathqError('RATE_LIMITED', 'Wathq rate limit hit', 429)
  }
  if (!res.ok) {
    throw new WathqError(
      'UPSTREAM_ERROR',
      `Wathq returned HTTP ${res.status}`,
      res.status
    )
  }

  let raw: WathqRawResponse
  try {
    raw = (await res.json()) as WathqRawResponse
  } catch {
    throw new WathqError('UPSTREAM_ERROR', 'Wathq returned non-JSON body')
  }

  return mapWathqToCRData(raw)
}
