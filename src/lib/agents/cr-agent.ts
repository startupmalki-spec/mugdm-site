import Anthropic from '@anthropic-ai/sdk'

import { selectModel } from '@/lib/ai/model-router'

/* ───────── Public types ───────── */

export interface CROwner {
  name: string
  id_number: string
  share: number
}

export interface CRAgentData {
  name_ar: string | null
  name_en: string | null
  cr_number: string | null
  cr_expiry_date: string | null
  cr_issuance_date: string | null
  activity_type: string | null
  city: string | null
  capital: string | null
  owners: CROwner[]
  barcode_url: string | null
  legal_form: string | null
  main_activity_code: string | null
  sub_activities: string[]
  fiscal_year_end: string | null
}

export interface CRAgentResult {
  source: 'qr_webpage' | 'document_ocr' | 'fallback'
  confidence: number
  data: CRAgentData
  /** Status messages emitted by each step (useful for UX progress) */
  steps: string[]
}

/* ───────── Prompts ───────── */

const STEP_A_PROMPT = `You are an expert at reading Saudi Arabian Commercial Registration (CR) documents (سجل تجاري).

This is a CR document. Perform TWO tasks:

1. FIND THE QR/BARCODE URL: Saudi CRs contain a QR code or barcode that links to the Ministry of Commerce verification page (mc.gov.sa or ecr.mc.gov.sa). Look carefully at the document for any QR code, barcode, or printed URL. Extract the full URL.

2. EXTRACT ALL VISIBLE BUSINESS DATA: Read every piece of text on the document in both Arabic and English.

Return ONLY valid JSON with this structure:
{
  "barcode_url": "https://..." or null,
  "name_ar": "الاسم بالعربي" or null,
  "name_en": "English Name" or null,
  "cr_number": "1234567890" or null,
  "cr_expiry_date": "YYYY-MM-DD" or null,
  "cr_issuance_date": "YYYY-MM-DD" or null,
  "activity_type": "..." or null,
  "city": "..." or null,
  "capital": "500000" or null,
  "owners": [{"name": "...", "id_number": "...", "share": 50}],
  "legal_form": "..." or null,
  "main_activity_code": "..." or null,
  "sub_activities": [],
  "fiscal_year_end": "..." or null
}`

const STEP_C_PROMPT = `You are an expert at extracting business data from Saudi Ministry of Commerce (mc.gov.sa) CR verification web pages.

This is HTML content from a Saudi Ministry of Commerce CR verification page. Extract ALL business information.

Return ONLY valid JSON with this structure:
{
  "name_ar": "الاسم بالعربي" or null,
  "name_en": "English Name" or null,
  "cr_number": "1234567890" or null,
  "cr_expiry_date": "YYYY-MM-DD" or null,
  "cr_issuance_date": "YYYY-MM-DD" or null,
  "activity_type": "..." or null,
  "city": "..." or null,
  "capital": "500000" or null,
  "owners": [{"name": "...", "id_number": "...", "share": 50}],
  "legal_form": "..." or null,
  "main_activity_code": "..." or null,
  "sub_activities": [],
  "fiscal_year_end": "..." or null
}

Extract data from all sections. For owners, include every partner/shareholder listed. Convert all dates to YYYY-MM-DD format. For Hijri dates, convert to Gregorian.`

/* ───────── Helpers ───────── */

function emptyData(): CRAgentData {
  return {
    name_ar: null,
    name_en: null,
    cr_number: null,
    cr_expiry_date: null,
    cr_issuance_date: null,
    activity_type: null,
    city: null,
    capital: null,
    owners: [],
    barcode_url: null,
    legal_form: null,
    main_activity_code: null,
    sub_activities: [],
    fiscal_year_end: null,
  }
}

function parseJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
}

/** Merge two data objects — non-null values from `over` take precedence */
function mergeData(base: CRAgentData, over: Partial<CRAgentData>): CRAgentData {
  const merged = { ...base }
  for (const key of Object.keys(over) as (keyof CRAgentData)[]) {
    const val = over[key]
    if (val === null || val === undefined) continue
    if (Array.isArray(val) && val.length === 0) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(merged as any)[key] = val
  }
  return merged
}

function isValidMCUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('mc.gov.sa') ||
        parsed.hostname.endsWith('.mc.gov.sa'))
    )
  } catch {
    return false
  }
}

/* ───────── Main agent ───────── */

export async function extractCRData(params: {
  fileUrl?: string
  base64Data?: string
  mediaType?: string
}): Promise<CRAgentResult> {
  const anthropic = new Anthropic()
  const steps: string[] = []

  // Build the document content block for Claude
  const isPdf =
    params.mediaType === 'application/pdf' ||
    (params.fileUrl && /\.pdf(\?|$)/i.test(params.fileUrl))

  let contentBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam

  if (isPdf) {
    if (params.base64Data) {
      contentBlock = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: params.base64Data },
      }
    } else {
      contentBlock = {
        type: 'document',
        source: { type: 'url', url: params.fileUrl! },
      }
    }
  } else if (params.base64Data) {
    const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const).includes(
      params.mediaType as 'image/jpeg'
    )
      ? (params.mediaType as Anthropic.Base64ImageSource['media_type'])
      : 'image/jpeg'
    contentBlock = {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: params.base64Data },
    }
  } else {
    contentBlock = {
      type: 'image',
      source: { type: 'url', url: params.fileUrl! },
    }
  }

  /* ── Step A: Analyze document + extract QR URL ── */

  steps.push('Reading CR document...')
  let docData: CRAgentData = emptyData()

  try {
    const stepAResponse = await anthropic.messages.create({
      model: selectModel({ userId: 'system', task: 'cr_extraction' }),
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: STEP_A_PROMPT }],
        },
      ],
    })

    const stepAText = stepAResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const parsed = parseJson<CRAgentData & { barcode_url?: string }>(stepAText)
    if (parsed) {
      docData = mergeData(docData, parsed)
    }
  } catch (err) {
    console.error('[CR Agent] Step A failed:', err instanceof Error ? err.message : err)
    steps.push('Document reading failed')
    return { source: 'fallback', confidence: 0, data: emptyData(), steps }
  }

  steps.push('Extracted document data')

  /* ── Step B: Fetch the MC verification webpage ── */

  const barcodeUrl = docData.barcode_url
  if (!barcodeUrl || !isValidMCUrl(barcodeUrl)) {
    steps.push('No QR code URL found — using document data only')
    return {
      source: 'document_ocr',
      confidence: docData.cr_number ? 0.75 : 0.4,
      data: docData,
      steps,
    }
  }

  steps.push(`Found QR code URL: ${barcodeUrl}`)
  steps.push('Verifying with Ministry of Commerce...')

  let htmlContent: string | null = null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(barcodeUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MugdmBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (res.ok) {
      const raw = await res.text()
      // Limit HTML to ~100KB to avoid token overflow
      htmlContent = raw.slice(0, 100_000)
    }
  } catch (err) {
    console.error('[CR Agent] Step B fetch failed:', err instanceof Error ? err.message : err)
  }

  if (!htmlContent) {
    steps.push('Could not reach MC website — using document data only')
    return {
      source: 'document_ocr',
      confidence: docData.cr_number ? 0.75 : 0.4,
      data: docData,
      steps,
    }
  }

  steps.push('Fetched MC verification page')

  /* ── Step C: Parse webpage with Claude ── */

  steps.push('Extracting business details from MC page...')

  try {
    const stepCResponse = await anthropic.messages.create({
      model: selectModel({ userId: 'system', task: 'cr_extraction' }),
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${STEP_C_PROMPT}\n\n--- HTML CONTENT ---\n${htmlContent}`,
        },
      ],
    })

    const stepCText = stepCResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const webData = parseJson<CRAgentData>(stepCText)
    if (webData) {
      // Webpage data is higher confidence — merge it on top of document data
      docData = mergeData(docData, webData)
      // Keep the barcode_url from document analysis
      docData.barcode_url = barcodeUrl
      steps.push('Successfully extracted data from MC verification page')

      return {
        source: 'qr_webpage',
        confidence: 0.95,
        data: docData,
        steps,
      }
    }
  } catch (err) {
    console.error('[CR Agent] Step C failed:', err instanceof Error ? err.message : err)
  }

  steps.push('MC page parsing failed — using document data only')
  return {
    source: 'document_ocr',
    confidence: docData.cr_number ? 0.75 : 0.4,
    data: docData,
    steps,
  }
}
