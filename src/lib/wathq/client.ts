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

const DEFAULT_BASE_URLS = [
  'https://api.wathq.sa/v5',
  'https://api.wathq.sa/v5/trial',
  'https://apidev.wathq.sa/v5',
]
const REQUEST_TIMEOUT_MS = 10_000

function getCandidateBases(): string[] {
  const fromEnv = process.env.WATHQ_BASE_URLS?.trim()
  if (!fromEnv) return DEFAULT_BASE_URLS
  return fromEnv
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

function buildUrl(base: string, crDigits: string): string {
  const path = crDigits.startsWith('7')
    ? 'commercialregistration/unified'
    : 'commercialregistration/info'
  return `${base.replace(/\/+$/, '')}/${path}/${crDigits}`
}

export type WathqErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_CR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'SUBSCRIPTION_DENIED'
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

interface SingleAttempt {
  status: number
  ok: boolean
  body: string
  parsed: WathqRawResponse | null
}

async function tryLookupCR(
  base: string,
  crDigits: string,
  apiKey: string,
): Promise<SingleAttempt> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  // Per Wathq OpenAPI securityDefinitions: single `apiKey` header carrying
  // the Consumer Key.
  const headers: Record<string, string> = {
    apiKey,
    Accept: 'application/json',
  }
  let res: Response
  try {
    res = await fetch(buildUrl(base, crDigits), {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  const body = await res.text().catch(() => '')
  let parsed: WathqRawResponse | null = null
  if (res.ok) {
    try {
      parsed = JSON.parse(body) as WathqRawResponse
    } catch {
      parsed = null
    }
  }
  return { status: res.status, ok: res.ok, body, parsed }
}

/**
 * Look up a CR number via Wathq with automatic base-URL fallback.
 * Throws `WathqError` on any failure (including NOT_CONFIGURED).
 */
export async function lookupCR(crNumber: string): Promise<WathqLookupResult> {
  const stripQuotes = (v?: string) =>
    v?.trim().replace(/^["']|["']$/g, '') ?? ''
  const apiKey = stripQuotes(process.env.WATHQ_API_KEY)
  const apiSecret = stripQuotes(process.env.WATHQ_API_SECRET)
  if (!apiKey) {
    throw new WathqError('NOT_CONFIGURED', 'WATHQ_API_KEY is not set')
  }
  void apiSecret // kept for future-proofing; not sent on the wire

  const digits = crNumber.replace(/\s/g, '')
  if (!/^\d{10}$/.test(digits)) {
    throw new WathqError('INVALID_CR', 'CR number must be 10 digits')
  }

  const bases = getCandidateBases()
  let lastStatus: number | undefined
  let lastBodyExcerpt = ''
  let allDenied = true

  for (const base of bases) {
    let attempt: SingleAttempt
    try {
      attempt = await tryLookupCR(base, digits, apiKey)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // timeout — try the next base
        lastStatus = undefined
        lastBodyExcerpt = 'request timed out'
        continue
      }
      lastStatus = undefined
      lastBodyExcerpt =
        err instanceof Error ? err.message : 'network error contacting Wathq'
      continue
    }

    lastStatus = attempt.status
    lastBodyExcerpt = attempt.body.slice(0, 200)

    if (attempt.ok && attempt.parsed) {
      console.info(`[wathq] lookup succeeded via ${base}`)
      return mapWathqToCRData(attempt.parsed)
    }

    if (attempt.status === 404) {
      // Definitive: this CR doesn't exist on the gateway path; don't keep trying.
      throw new WathqError('NOT_FOUND', 'CR number not found at Wathq', 404)
    }
    if (attempt.status === 429) {
      throw new WathqError('RATE_LIMITED', 'Wathq rate limit hit', 429)
    }
    if (attempt.status === 401 || attempt.status === 403) {
      // Subscription/access issue — try the next base.
      continue
    }
    // Any other non-2xx (5xx etc.) — try the next base, but mark we hit
    // something that wasn't simply "denied" so we can disambiguate later.
    allDenied = false
  }

  if (allDenied) {
    throw new WathqError(
      'SUBSCRIPTION_DENIED',
      `Wathq key valid but subscription does not grant access to this resource (likely Trial-only or pending propagation). last status=${lastStatus ?? 'n/a'} body="${lastBodyExcerpt}"`,
      lastStatus,
    )
  }
  throw new WathqError(
    'UPSTREAM_ERROR',
    `Wathq returned HTTP ${lastStatus ?? 'unknown'} across all candidate bases. body="${lastBodyExcerpt}"`,
    lastStatus,
  )
}

/**
 * Diagnostic-only helper. Hits every candidate base URL with the given test
 * CR using only the `apiKey` header. Returns one row per base. Never throws.
 */
export async function probeWathqAccess(
  apiKey: string,
  testCr: string,
): Promise<{ base: string; status: number; ok: boolean; bodyExcerpt: string }[]> {
  const digits = testCr.replace(/\s/g, '')
  const bases = getCandidateBases()
  const rows: { base: string; status: number; ok: boolean; bodyExcerpt: string }[] = []
  for (const base of bases) {
    try {
      const a = await tryLookupCR(base, digits, apiKey)
      rows.push({ base, status: a.status, ok: a.ok, bodyExcerpt: a.body.slice(0, 400) })
    } catch (err) {
      rows.push({
        base,
        status: 0,
        ok: false,
        bodyExcerpt: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return rows
}
