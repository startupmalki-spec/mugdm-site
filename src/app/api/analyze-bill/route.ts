import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

import { createClient } from '@/lib/supabase/server'
import { buildRateLimitHeaders } from '@/lib/rate-limit-middleware'
import { checkRateLimit } from '@/lib/rate-limit'
import { selectModel } from '@/lib/ai/model-router'
import { computeCacheKey, getCached, setCached } from '@/lib/ai/response-cache'
import { trackUsage } from '@/lib/ai/usage-tracker'
import type { TransactionCategory } from '@/lib/supabase/types'
import type {
  BillExtractionResult,
  BillLineItemExtraction,
  BillExtractionLanguage,
} from '@/lib/bookkeeper/bill-extraction-types'

const MAX_BASE64_SIZE = 10 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
] as const

const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  'REVENUE',
  'OTHER_INCOME',
  'GOVERNMENT',
  'SALARY',
  'RENT',
  'UTILITIES',
  'SUPPLIES',
  'TRANSPORT',
  'MARKETING',
  'PROFESSIONAL',
  'INSURANCE',
  'BANK_FEES',
  'OTHER_EXPENSE',
]

const LANGUAGES: BillExtractionLanguage[] = ['ar', 'en', 'mixed']

interface AnalyzeBillRequest {
  base64Data: string
  mediaType?: string
  businessId?: string
}

const EXTRACTION_PROMPT = `You are an expert at extracting structured data from Saudi Arabian vendor BILLS and INVOICES (فواتير الموردين). These are multi-line-item documents, NOT simple receipts. You must handle Arabic, English, and mixed-language invoices, including ZATCA-compliant tax invoices and common KSA vendor formats:

- Telecom: STC (الاتصالات السعودية), Mobily (موبايلي), Zain (زين)
- Utilities: Saudi Electricity Company (شركة الكهرباء السعودية), National Water Company
- Logistics: Aramex, SMSA, DHL
- Generic commercial invoices from suppliers / contractors / consultants

Extract the following fields as STRICT JSON. Return ONLY the JSON object — no markdown, no explanation.

Fields:
- vendor_name: business/supplier name (prefer the clearest form — AR or EN)
- vendor_vat_number: KSA VAT registration (الرقم الضريبي) — 15 digits, starts with 3, ends with 3. null if absent.
- bill_number: invoice / bill / reference number (رقم الفاتورة)
- issue_date: invoice date as ISO (YYYY-MM-DD). Convert Hijri to Gregorian if needed.
- due_date: payment due date as ISO (YYYY-MM-DD). If not present but payment terms say "Net N", compute from issue_date. null if unknown.
- subtotal: pre-VAT total as number
- vat_amount: VAT (ضريبة القيمة المضافة) as number
- vat_rate: the VAT percentage (15 for standard KSA; 0 for zero-rated/exempt)
- total: grand total / amount due as number (المبلغ الإجمالي / الإجمالي المستحق)
- currency: ISO code — default "SAR" unless clearly another currency
- line_items: array. Each: { description, quantity, unit_price, amount, category_hint }
    - category_hint MUST be one of: ${TRANSACTION_CATEGORIES.join(', ')} (or null if unclear)
    - Use null for any numeric field that cannot be read
- language_detected: one of "ar" | "en" | "mixed"
- confidence: object mapping field name -> number 0..1 for each top-level field you extracted (e.g. { "vendor_name": 0.95, "total": 0.99, "due_date": 0.4 }). Be honest — low numbers for guesses.
- overall_confidence: number 0..1 summarizing the whole extraction

Category hint guidance (match to expense type):
- GOVERNMENT: government fees, licenses, MoL, Muqeem, Absher, ZATCA admin fees
- SALARY: payroll, wages, GOSI contributions
- RENT: office/warehouse/retail lease (إيجار)
- UTILITIES: electricity, water, internet, phone, mobile (STC/Mobily/Zain bills, SEC bills)
- SUPPLIES: office supplies, inventory, raw materials (مستلزمات)
- TRANSPORT: fuel, shipping, Aramex, SMSA, courier, travel, taxi
- MARKETING: advertising, printing, promotions, social media, events
- PROFESSIONAL: consulting, legal, accounting, audit, IT services
- INSURANCE: insurance premiums (تأمين)
- BANK_FEES: bank charges, transfer fees, POS fees
- OTHER_EXPENSE: fallback

Rules:
- Arabic numerals (٠١٢٣٤٥٦٧٨٩) must be converted to Western digits.
- Never hallucinate VAT numbers. If unsure, return null and drop the confidence.
- If the document is not a bill/invoice (e.g., a menu, random photo), set overall_confidence to 0 and leave fields null.
- Line items: include every row of the itemized table. Do NOT collapse them.
- If subtotal + vat_amount != total within 0.02 tolerance, reduce confidence of the suspect field.

Return shape example:
{
  "vendor_name": "شركة الاتصالات السعودية",
  "vendor_vat_number": "300012345600003",
  "bill_number": "STC-2026-0412",
  "issue_date": "2026-04-01",
  "due_date": "2026-04-30",
  "subtotal": 200.00,
  "vat_amount": 30.00,
  "vat_rate": 15,
  "total": 230.00,
  "currency": "SAR",
  "line_items": [
    { "description": "Mobile postpaid line", "quantity": 1, "unit_price": 200, "amount": 200, "category_hint": "UTILITIES" }
  ],
  "language_detected": "mixed",
  "confidence": { "vendor_name": 0.98, "vendor_vat_number": 0.95, "bill_number": 0.9, "issue_date": 0.95, "due_date": 0.9, "subtotal": 0.99, "vat_amount": 0.99, "vat_rate": 1, "total": 0.99, "line_items": 0.9 },
  "overall_confidence": 0.95
}`

function buildFallbackResult(): BillExtractionResult {
  return {
    vendor_name: null,
    vendor_vat_number: null,
    bill_number: null,
    issue_date: null,
    due_date: null,
    subtotal: null,
    vat_amount: null,
    vat_rate: null,
    total: null,
    currency: 'SAR',
    line_items: [],
    confidence: {},
    overall_confidence: 0,
    language_detected: 'en',
  }
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

function clamp01(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

function sanitizeLineItems(raw: unknown): BillLineItemExtraction[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): BillLineItemExtraction | null => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const description = strOrNull(o.description)
      if (!description) return null
      const hint = o.category_hint
      const category_hint: TransactionCategory | null =
        typeof hint === 'string' && TRANSACTION_CATEGORIES.includes(hint as TransactionCategory)
          ? (hint as TransactionCategory)
          : null
      return {
        description,
        quantity: numOrNull(o.quantity),
        unit_price: numOrNull(o.unit_price),
        amount: numOrNull(o.amount),
        category_hint,
      }
    })
    .filter((x): x is BillLineItemExtraction => x !== null)
}

function parseClaudeResponse(text: string): BillExtractionResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return buildFallbackResult()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return buildFallbackResult()
  }

  const language =
    typeof parsed.language_detected === 'string' &&
    LANGUAGES.includes(parsed.language_detected as BillExtractionLanguage)
      ? (parsed.language_detected as BillExtractionLanguage)
      : 'en'

  const confidenceRaw = parsed.confidence
  const confidence: Record<string, number> = {}
  if (confidenceRaw && typeof confidenceRaw === 'object' && !Array.isArray(confidenceRaw)) {
    for (const [k, v] of Object.entries(confidenceRaw as Record<string, unknown>)) {
      confidence[k] = clamp01(v)
    }
  }

  const currency = strOrNull(parsed.currency) ?? 'SAR'

  return {
    vendor_name: strOrNull(parsed.vendor_name),
    vendor_vat_number: strOrNull(parsed.vendor_vat_number),
    bill_number: strOrNull(parsed.bill_number),
    issue_date: strOrNull(parsed.issue_date),
    due_date: strOrNull(parsed.due_date),
    subtotal: numOrNull(parsed.subtotal),
    vat_amount: numOrNull(parsed.vat_amount),
    vat_rate: numOrNull(parsed.vat_rate),
    total: numOrNull(parsed.total),
    currency,
    line_items: sanitizeLineItems(parsed.line_items),
    confidence,
    overall_confidence: clamp01(parsed.overall_confidence),
    language_detected: language,
  }
}

export async function POST(request: Request) {
  // Feature flag gate
  if (process.env.NEXT_PUBLIC_FEATURE_BILLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let userId: string | undefined
  let businessId: string | undefined

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id

    const body = (await request.json()) as AnalyzeBillRequest
    businessId = body.businessId

    if (!body.base64Data) {
      return NextResponse.json({ error: 'base64Data is required' }, { status: 400 })
    }

    if (!body.businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    if (body.base64Data.length > MAX_BASE64_SIZE) {
      return NextResponse.json(
        { error: 'File data exceeds maximum size (10MB)' },
        { status: 413 }
      )
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', body.businessId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found or access denied' },
        { status: 403 }
      )
    }

    const rateCheck = await checkRateLimit(body.businessId)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          remaining: 0,
          limit: rateCheck.limit,
          resetAt: rateCheck.resetAt,
          tier: rateCheck.tier,
        },
        { status: 429, headers: buildRateLimitHeaders(rateCheck) }
      )
    }

    const anthropic = new Anthropic()
    const billModel = selectModel({ userId: user.id, task: 'bill_analysis' })

    const mediaType = ALLOWED_MEDIA_TYPES.includes(
      body.mediaType as (typeof ALLOWED_MEDIA_TYPES)[number]
    )
      ? body.mediaType!
      : 'image/jpeg'

    const isPdf = mediaType === 'application/pdf'

    const cacheKey = computeCacheKey({
      task: 'bill_analysis',
      model: billModel,
      payload: `${mediaType}::${body.base64Data}`,
    })
    const cached = await getCached<BillExtractionResult>(cacheKey)
    if (cached) {
      return NextResponse.json(cached.response, {
        headers: buildRateLimitHeaders(rateCheck),
      })
    }

    const documentBlock: Anthropic.ContentBlockParam = isPdf
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: body.base64Data,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType as Anthropic.Base64ImageSource['media_type'],
            data: body.base64Data,
          },
        }

    const response = await anthropic.messages.create({
      model: billModel,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [documentBlock, { type: 'text', text: EXTRACTION_PROMPT }],
        },
      ],
    })

    trackUsage(
      supabase,
      user.id,
      billModel,
      response.usage.input_tokens,
      response.usage.output_tokens,
      { taskType: 'bill_analysis', businessId: body.businessId }
    ).catch(() => {})

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const result = parseClaudeResponse(responseText)

    if (
      result.overall_confidence === 0 &&
      result.vendor_name === null &&
      result.total === null
    ) {
      return NextResponse.json(
        {
          error:
            'Could not extract bill data from the uploaded document. Please ensure the image or PDF is a clear, readable invoice.',
        },
        { status: 422 }
      )
    }

    if (result.overall_confidence >= 0.5) {
      setCached({
        cacheKey,
        task: 'bill_analysis',
        model: billModel,
        response: result,
        tokensSavedIn: response.usage.input_tokens,
        tokensSavedOut: response.usage.output_tokens,
      }).catch(() => {})
    }

    return NextResponse.json(result, { headers: buildRateLimitHeaders(rateCheck) })
  } catch (error) {
    console.error('[API] analyze-bill failed:', {
      userId,
      businessId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    const message = error instanceof Error ? error.message : ''
    const isMediaError =
      message.includes('Could not process image') || message.includes('invalid_request_error')
    const userMessage = isMediaError
      ? 'The uploaded file could not be processed. Please ensure it is a clear, readable image or PDF of a bill or invoice.'
      : 'Could not extract bill data from the uploaded document. Please ensure the image or PDF is clear and readable.'

    return NextResponse.json({ error: userMessage }, { status: 502 })
  }
}
