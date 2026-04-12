import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

import { createClient } from '@/lib/supabase/server'
import { buildRateLimitHeaders } from '@/lib/rate-limit-middleware'
import { checkRateLimit } from '@/lib/rate-limit'
import type { TransactionCategory } from '@/lib/supabase/types'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const MAX_BASE64_SIZE = 10 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'] as const

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

interface AnalyzeReceiptRequest {
  base64Data: string
  mediaType?: string
  businessId?: string
}

interface LineItem {
  description: string
  quantity: number | null
  unit_price: number | null
  total: number | null
}

interface ReceiptExtractionResult {
  total_amount: number | null
  vendor_name: string | null
  date: string | null
  category: TransactionCategory
  vat_amount: number | null
  vat_registration_number: string | null
  invoice_number: string | null
  payment_terms: string | null
  line_items: LineItem[]
  ai_confidence: number
}

const EXTRACTION_PROMPT = `You are an expert at reading Saudi Arabian receipts and invoices (فواتير وإيصالات), including Arabic text. You handle both single-page receipts and multi-page PDF invoices.

Analyze this receipt or invoice and extract the following information as JSON. Return ONLY valid JSON, no explanations.

Required fields:
- total_amount: the final total amount (المبلغ الإجمالي) paid as a number (e.g. 150.00), or null if not found. For invoices, use the grand total / amount due.
- vendor_name: the business, store, or supplier name (in Arabic or English), or null
- date: the transaction or invoice date as ISO string (YYYY-MM-DD), or null. For invoices, prefer the invoice date over the due date.
- category: best matching expense category from this list: ${TRANSACTION_CATEGORIES.join(', ')}
- vat_amount: the VAT (ضريبة القيمة المضافة) amount as a number, or null
- vat_registration_number: the VAT registration number (الرقم الضريبي) of the vendor, or null
- invoice_number: the invoice or receipt number, or null
- payment_terms: payment terms if present (e.g. "Net 30", "Due on receipt"), or null
- line_items: array of items or services, each with description, quantity, unit_price, total (use null for missing values). For multi-page documents, include items from all pages.
- ai_confidence: a number between 0 and 1 representing your confidence in the extraction accuracy

If the receipt appears handwritten, do your best to extract amounts and vendor. Flag low confidence by setting ai_confidence below 0.5. Handwritten receipts are common in Saudi markets and small shops.

Category guidance:
- REVENUE / OTHER_INCOME: for income receipts
- GOVERNMENT: government fees, licenses, permits (رسوم حكومية)
- SALARY: payroll, wages
- RENT: rent, lease payments (إيجار)
- UTILITIES: electricity, water, internet, phone bills (مرافق)
- SUPPLIES: office supplies, equipment, materials (مستلزمات)
- TRANSPORT: fuel, shipping, courier, travel (نقل)
- MARKETING: advertising, printing, promotions (تسويق)
- PROFESSIONAL: consulting, legal, accounting services (خدمات مهنية)
- INSURANCE: insurance premiums (تأمين)
- BANK_FEES: bank charges, transfer fees (رسوم بنكية)
- OTHER_EXPENSE: any other expense

Additional guidance:
- Always extract the total amount even if individual line items are unclear
- Look for VAT registration numbers (الرقم الضريبي) — they are typically 15-digit numbers starting with 3 in Saudi Arabia
- Extract invoice numbers from headers or footers

Return exactly this JSON structure:
{
  "total_amount": 115.00,
  "vendor_name": "اسم المحل",
  "date": "2025-01-15",
  "category": "SUPPLIES",
  "vat_amount": 15.00,
  "vat_registration_number": "300012345600003",
  "invoice_number": "INV-2025-001",
  "payment_terms": "Net 30",
  "line_items": [
    { "description": "Item name", "quantity": 1, "unit_price": 100.00, "total": 100.00 }
  ],
  "ai_confidence": 0.92
}`

function buildFallbackResponse(): ReceiptExtractionResult {
  return {
    total_amount: null,
    vendor_name: null,
    date: null,
    category: 'OTHER_EXPENSE',
    vat_amount: null,
    vat_registration_number: null,
    invoice_number: null,
    payment_terms: null,
    line_items: [],
    ai_confidence: 0,
  }
}

function parseClaudeResponse(text: string): ReceiptExtractionResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return buildFallbackResponse()

  let parsed: Partial<ReceiptExtractionResult>
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return buildFallbackResponse()
  }

  const category: TransactionCategory = TRANSACTION_CATEGORIES.includes(
    parsed.category as TransactionCategory
  )
    ? (parsed.category as TransactionCategory)
    : 'OTHER_EXPENSE'

  const confidence =
    typeof parsed.ai_confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.ai_confidence))
      : 0.5

  return {
    total_amount: typeof parsed.total_amount === 'number' ? parsed.total_amount : null,
    vendor_name: parsed.vendor_name ?? null,
    date: parsed.date ?? null,
    category,
    vat_amount: typeof parsed.vat_amount === 'number' ? parsed.vat_amount : null,
    vat_registration_number: parsed.vat_registration_number ?? null,
    invoice_number: parsed.invoice_number ?? null,
    payment_terms: parsed.payment_terms ?? null,
    line_items: Array.isArray(parsed.line_items) ? parsed.line_items : [],
    ai_confidence: Math.round(confidence * 100) / 100,
  }
}

export async function POST(request: Request) {
  let userId: string | undefined
  let businessId: string | undefined

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id

    const body = (await request.json()) as AnalyzeReceiptRequest
    businessId = body.businessId

    if (!body.base64Data) {
      return NextResponse.json(
        { error: 'base64Data is required' },
        { status: 400 }
      )
    }

    if (!body.businessId) {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 }
      )
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
        { error: 'Rate limit exceeded', remaining: 0, limit: rateCheck.limit, resetAt: rateCheck.resetAt, tier: rateCheck.tier },
        { status: 429, headers: buildRateLimitHeaders(rateCheck) }
      )
    }

    const anthropic = new Anthropic()

    const mediaType = ALLOWED_MEDIA_TYPES.includes(body.mediaType as typeof ALLOWED_MEDIA_TYPES[number])
      ? body.mediaType!
      : 'image/jpeg'

    const isPdf = mediaType === 'application/pdf'

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
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            documentBlock,
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    })

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const result = parseClaudeResponse(responseText)

    if (result.ai_confidence === 0 && result.total_amount === null && result.vendor_name === null) {
      return NextResponse.json(
        { error: 'Could not extract data from the uploaded document. Please ensure the image or PDF is clear and readable.' },
        { status: 422 }
      )
    }

    return NextResponse.json(result, { headers: buildRateLimitHeaders(rateCheck) })
  } catch (error) {
    console.error('[API] analyze-receipt failed:', {
      userId,
      businessId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    const message = error instanceof Error ? error.message : ''
    const isMediaError = message.includes('Could not process image') || message.includes('invalid_request_error')
    const userMessage = isMediaError
      ? 'The uploaded file could not be processed. Please ensure it is a clear, readable image or PDF of a receipt or invoice.'
      : 'Could not extract data from the uploaded document. Please ensure the image or PDF is clear and readable.'

    return NextResponse.json(
      { error: userMessage },
      { status: 502 }
    )
  }
}
