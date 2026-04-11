import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import type { DocumentType } from '@/lib/supabase/types'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const ALLOWED_URL_PATTERN = /^https:\/\/[a-z]+\.supabase\.co\/storage\//
const MAX_BASE64_SIZE = 10 * 1024 * 1024
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

function isAllowedFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && ALLOWED_URL_PATTERN.test(url)
  } catch {
    return false
  }
}

const DOCUMENT_TYPES: DocumentType[] = [
  'CR',
  'GOSI_CERT',
  'ZAKAT_CLEARANCE',
  'INSURANCE',
  'CHAMBER',
  'BALADY',
  'MISA',
  'LEASE',
  'SAUDIZATION_CERT',
  'BANK_STATEMENT',
  'TAX_REGISTRATION',
  'OTHER',
]

interface AnalyzeDocumentRequest {
  fileUrl?: string
  base64Data?: string
  mediaType?: string
  businessId: string
}

interface ExtractedDocumentData {
  document_type: DocumentType
  expiry_date: string | null
  issuing_authority: string | null
  registration_number: string | null
  holder_name: string | null
  additional_data: Record<string, unknown>
  ai_confidence: number
}

const ANALYSIS_PROMPT = `You are an expert at reading Saudi Arabian government and business documents, including Arabic text.

Analyze this document image and extract the following information as JSON. Return ONLY valid JSON, no explanations.

Required fields:
- document_type: one of ${DOCUMENT_TYPES.join(', ')}
- expiry_date: ISO date string (YYYY-MM-DD) or null if not present/applicable
- issuing_authority: the government body or organization that issued this document, or null
- registration_number: any registration, license, or certificate number, or null
- holder_name: the name of the business or individual this document belongs to (in Arabic or English), or null
- additional_data: an object with any other relevant extracted fields (e.g., issue_date, activity_type, city, cr_number)
- ai_confidence: a number between 0 and 1 representing your confidence in the extraction accuracy

Document type guidance:
- CR: Commercial Registration (سجل تجاري)
- GOSI_CERT: GOSI/Social Insurance certificate (شهادة التأمينات)
- ZAKAT_CLEARANCE: Zakat clearance certificate (شهادة الزكاة)
- INSURANCE: Insurance policy or certificate
- CHAMBER: Chamber of Commerce membership (عضوية الغرفة التجارية)
- BALADY: Municipal/Balady license (رخصة البلدية)
- MISA: Investment license / MISA certificate
- LEASE: Lease/rental agreement (عقد إيجار)
- SAUDIZATION_CERT: Saudization/Nitaqat certificate (شهادة التوطين)
- BANK_STATEMENT: Bank statement (كشف حساب)
- TAX_REGISTRATION: VAT/Tax registration certificate (شهادة ضريبية)
- OTHER: Any other document type

Return exactly this JSON structure:
{
  "document_type": "CR",
  "expiry_date": "2025-12-31",
  "issuing_authority": "Ministry of Commerce",
  "registration_number": "1234567890",
  "holder_name": "شركة الأمثلة المحدودة",
  "additional_data": {},
  "ai_confidence": 0.95
}`

function buildFallbackResponse(): ExtractedDocumentData {
  return {
    document_type: 'OTHER',
    expiry_date: null,
    issuing_authority: null,
    registration_number: null,
    holder_name: null,
    additional_data: {},
    ai_confidence: 0,
  }
}

function parseClaudeResponse(text: string): ExtractedDocumentData {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return buildFallbackResponse()

  const parsed = JSON.parse(jsonMatch[0]) as Partial<ExtractedDocumentData>

  const documentType: DocumentType = DOCUMENT_TYPES.includes(parsed.document_type as DocumentType)
    ? (parsed.document_type as DocumentType)
    : 'OTHER'

  const confidence = typeof parsed.ai_confidence === 'number'
    ? Math.min(1, Math.max(0, parsed.ai_confidence))
    : 0.5

  return {
    document_type: documentType,
    expiry_date: parsed.expiry_date ?? null,
    issuing_authority: parsed.issuing_authority ?? null,
    registration_number: parsed.registration_number ?? null,
    holder_name: parsed.holder_name ?? null,
    additional_data: parsed.additional_data ?? {},
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

    const body = (await request.json()) as AnalyzeDocumentRequest
    businessId = body.businessId

    if (!body.businessId) {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 }
      )
    }

    if (!body.fileUrl && !body.base64Data) {
      return NextResponse.json(
        { error: 'Either fileUrl or base64Data is required' },
        { status: 400 }
      )
    }

    if (body.fileUrl && !isAllowedFileUrl(body.fileUrl)) {
      return NextResponse.json(
        { error: 'fileUrl must be a valid Supabase storage URL' },
        { status: 400 }
      )
    }

    if (body.base64Data && body.base64Data.length > MAX_BASE64_SIZE) {
      return NextResponse.json(
        { error: 'Image data exceeds maximum size (10MB)' },
        { status: 413 }
      )
    }

    // During onboarding, businessId is the user's ID (no business exists yet)
    const isOnboarding = body.businessId === user.id
    if (!isOnboarding) {
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
    }

    const rateCheck = await checkRateLimit(body.businessId)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', remaining: 0, resetAt: rateCheck.resetAt },
        { status: 429 }
      )
    }

    const anthropic = new Anthropic()

    let imageContent: Anthropic.ImageBlockParam

    if (body.base64Data) {
      const mediaType = ALLOWED_MEDIA_TYPES.includes(body.mediaType as any)
        ? (body.mediaType as Anthropic.Base64ImageSource['media_type'])
        : 'image/jpeg'
      imageContent = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: body.base64Data,
        },
      }
    } else {
      imageContent = {
        type: 'image',
        source: {
          type: 'url',
          url: body.fileUrl!,
        },
      }
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            { type: 'text', text: ANALYSIS_PROMPT },
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
    console.error('[API] analyze-document failed:', {
      userId,
      businessId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json(buildFallbackResponse())
  }
}
