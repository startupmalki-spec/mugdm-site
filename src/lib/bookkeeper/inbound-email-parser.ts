/**
 * Helpers for parsing inbound email webhooks (Postmark-compatible shape).
 *
 * Postmark inbound payload (relevant fields):
 *   {
 *     From: "vendor@example.com",
 *     To: "bills+acme@mugdm.com",
 *     Subject: "Invoice #1234",
 *     Attachments: [
 *       { Name: "invoice.pdf", Content: "<base64>", ContentType: "application/pdf", ContentLength: 12345 }
 *     ]
 *   }
 *
 * Mailgun / SendGrid use different field names (lowercase, "attachments"
 * array on multipart form). Translate at the route layer — this module
 * only speaks Postmark JSON.
 */

export interface InboundAttachment {
  Name: string
  Content: string // base64
  ContentType: string
  ContentLength?: number
}

export interface InboundEmailPayload {
  From?: string
  FromName?: string
  To?: string
  Subject?: string
  TextBody?: string
  HtmlBody?: string
  MessageID?: string
  Attachments?: InboundAttachment[]
}

export interface ParsedToAddress {
  /** Lower-cased business slug extracted from the address. */
  slug: string
  /** Which address style matched. */
  style: 'plus' | 'subdomain'
}

/**
 * Accepted inbound address formats:
 *   - plus-aliased:  bills+{slug}@mugdm.com
 *   - subdomain:     bills@{slug}.mugdm.com
 *
 * Slugs are lowercased, trimmed, and must match [a-z0-9][a-z0-9-]{0,62}.
 * Returns null if the address does not match either pattern.
 *
 * The "To" header may contain a display name and/or multiple addresses,
 * e.g. `"Bills Inbox" <bills+acme@mugdm.com>, other@x.com`. We accept the
 * first address that parses against either format.
 */
export function parseBusinessFromToAddress(to: string | null | undefined): ParsedToAddress | null {
  if (!to || typeof to !== 'string') return null

  // Extract individual email addresses. Handles `Name <addr@host>` and
  // comma-separated lists.
  const candidates = extractEmailAddresses(to)

  const PLUS = /^bills\+([a-z0-9][a-z0-9-]{0,62})@mugdm\.com$/i
  const SUB = /^bills@([a-z0-9][a-z0-9-]{0,62})\.mugdm\.com$/i

  for (const addr of candidates) {
    const lower = addr.toLowerCase()
    const plus = lower.match(PLUS)
    if (plus) return { slug: plus[1].toLowerCase(), style: 'plus' }
    const sub = lower.match(SUB)
    if (sub) return { slug: sub[1].toLowerCase(), style: 'subdomain' }
  }
  return null
}

function extractEmailAddresses(header: string): string[] {
  const out: string[] = []
  // angle-bracket form: <addr>
  const angle = header.match(/<([^<>]+)>/g)
  if (angle) {
    for (const a of angle) out.push(a.slice(1, -1).trim())
  }
  // bare addresses in comma-separated list
  for (const raw of header.split(',')) {
    const trimmed = raw.trim().replace(/^"[^"]*"\s*/, '')
    if (trimmed && !trimmed.includes('<') && trimmed.includes('@')) {
      out.push(trimmed)
    }
  }
  if (out.length === 0 && header.includes('@')) out.push(header.trim())
  return out
}

const BILL_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
])

/**
 * Returns attachments that look like bill documents (PDF or image).
 * Non-bill attachments (signatures, logos, .eml forwards) are filtered out.
 */
export function extractPdfAttachments(payload: InboundEmailPayload): InboundAttachment[] {
  const atts = Array.isArray(payload?.Attachments) ? payload.Attachments : []
  return atts.filter((a): a is InboundAttachment => {
    if (!a || typeof a !== 'object') return false
    if (typeof a.Name !== 'string' || typeof a.Content !== 'string') return false
    if (typeof a.ContentType !== 'string') return false
    const mime = a.ContentType.toLowerCase().split(';')[0].trim()
    if (!BILL_MIME_TYPES.has(mime)) return false
    if (a.Content.length === 0) return false
    return true
  })
}

/**
 * Best-effort slug derivation from a business name. Used when matching
 * inbound `To` addresses against stored businesses (we do not yet have a
 * dedicated `slug` column, so we compare name-derived slugs).
 */
export function deriveSlug(name: string | null | undefined): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 63)
}
