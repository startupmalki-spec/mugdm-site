import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import type { TransactionCategory } from '@/lib/supabase/types'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const MAX_BASE64_SIZE = 10 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

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
  line_items: LineItem[]
  ai_confidence: number
}

const EXTRACTION_PROMPT = `You are an expert at reading Saudi Arabian receipts and invoices, including Arabic text.

Analyze this receipt image and extract the following information as JSON. Return ONLY valid JSON, no explanations.

Required fields:
- total_amount: the final total amount paid as a number (e.g. 150.00), or null if not found
- vendor_name: the business or store name (in Arabic or English), or null
- date: the transaction date as ISO string (YYYY-MM-DD), or null
- category: best matching expense category from this list: ${TRANSACTION_CATEGORIES.join(', ')}
- vat_amount: the VAT (ضريبة القيمة المضافة) amount as a number, or null
- line_items: array of items purchased, each with description, quantity, unit_price, total (use null for missing values)
- ai_confidence: a number between 0 and 1 representing your confidence in the extraction accuracy

Category guidance:
- REVENUE / OTHER_INCOME: for income receipts
- GOVERNMENT: government fees, licenses, permits
- SALARY: payroll, wages
- RENT: rent, lease payments
- UTILITIES: electricity, water, internet, phone bills
- SUPPLIES: office supplies, equipment, materials
- TRANSPORT: fuel, shipping, courier, travel
- MARKETING: advertising, printing, promotions
- PROFESSIONAL: consulting, legal, accounting services
- INSURANCE: insurance premiums
- BANK_FEES: bank charges, transfer fees
- OTHER_EXPENSE: any other expense

Return exactly this JSON structure:
{
  "total_amount": 115.00,
  "vendor_name": "اسم المحل",
  "date": "2025-01-15",
  "category": "SUPPLIES",
  "vat_amount": 15.00,
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
        { error: 'Image data exceeds maximum size (10MB)' },
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

    {
      const rateCheck = await checkRateLimit(body.businessId)
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', remaining: 0, resetAt: rateCheck.resetAt },
          { status: 429 }
        )
      }
    }

    const anthropic = new Anthropic()

    const mediaType = ALLOWED_MEDIA_TYPES.includes(body.mediaType as any)
      ? (body.mediaType as Anthropic.Base64ImageSource['media_type'])
      : 'image/jpeg'

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: body.base64Data,
              },
            },
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

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] analyze-receipt failed:', {
      userId,
      businessId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Receipt analysis failed' },
      { status: 502 }
    )
  }
}
