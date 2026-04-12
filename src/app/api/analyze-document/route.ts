import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

import { createClient } from '@/lib/supabase/server'
import { buildRateLimitHeaders } from '@/lib/rate-limit-middleware'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractCRData } from '@/lib/agents/cr-agent'
import type { DocumentType } from '@/lib/supabase/types'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const ALLOWED_URL_PATTERN = /^https:\/\/[a-z]+\.supabase\.co\/storage\//
const MAX_BASE64_SIZE = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf'] as const

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
  /** When true, uses the multi-step CR agent for richer extraction */
  useCRAgent?: boolean
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

This may be a multi-page document. Extract data from ALL pages. For multi-page contracts or financial reports, summarize key terms from each section. Do not stop after the first page — process every page thoroughly.

Extract EVERY piece of text and data visible in the document. Saudi government documents often contain critical information in both Arabic and English — extract both versions.

Analyze this document and extract the following information as JSON. Return ONLY valid JSON, no explanations.

Required fields:
- document_type: one of ${DOCUMENT_TYPES.join(', ')}
- expiry_date: ISO date string (YYYY-MM-DD) or null if not present/applicable
- issuing_authority: the government body or organization that issued this document, or null
- registration_number: any registration, license, or certificate number, or null
- holder_name: the name of the business or individual this document belongs to (in Arabic or English), or null
- additional_data: an object with any other relevant extracted fields (see below for document-specific fields)
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

For Commercial Registration (CR) documents, extract ALL fields including: CR number (رقم السجل التجاري), business name in Arabic and English, business type/activity, capital amount, issue date, expiry date, city, owner names and their ID numbers (Iqama/national ID), and any other registration details. Place these in additional_data using these keys: name_ar, name_en, activity_type, capital, city, issue_date, owners (array of objects with name and id_number fields).

If you can see a barcode or QR code in the document, describe its location and any visible URL or data it might encode. Include this in additional_data as 'barcode_url' or 'qr_data'.

Return exactly this JSON structure:
{
  "document_type": "CR",
  "expiry_date": "2025-12-31",
  "issuing_authority": "Ministry of Commerce",
  "registration_number": "1234567890",
  "holder_name": "شركة الأمثلة المحدودة",
  "additional_data": {
    "name_ar": "شركة الأمثلة المحدودة",
    "name_en": "Example Company Ltd",
    "activity_type": "General Trading",
    "capital": "500000",
    "city": "Riyadh",
    "issue_date": "2020-01-01",
    "owners": [{"name": "محمد أحمد", "id_number": "1234567890"}],
    "barcode_url": "https://...",
    "qr_data": "..."
  },
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

  let parsed: Partial<ExtractedDocumentData>
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return buildFallbackResponse()
  }

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
        { error: 'Rate limit exceeded', remaining: 0, limit: rateCheck.limit, resetAt: rateCheck.resetAt, tier: rateCheck.tier },
        { status: 429, headers: buildRateLimitHeaders(rateCheck) }
      )
    }

    /* ── CR Agent path: multi-step extraction with QR verification ── */
    if (body.useCRAgent) {
      const crResult = await extractCRData({
        fileUrl: body.fileUrl,
        base64Data: body.base64Data,
        mediaType: body.mediaType,
      })

      // Map CR agent result to the standard response shape
      const d = crResult.data
      const result: ExtractedDocumentData = {
        document_type: 'CR',
        expiry_date: d.cr_expiry_date,
        issuing_authority: 'Ministry of Commerce',
        registration_number: d.cr_number,
        holder_name: d.name_ar,
        additional_data: {
          name_ar: d.name_ar,
          name_en: d.name_en,
          cr_number: d.cr_number,
          activity_type: d.activity_type,
          capital: d.capital,
          city: d.city,
          issue_date: d.cr_issuance_date,
          owners: d.owners,
          barcode_url: d.barcode_url,
          legal_form: d.legal_form,
          main_activity_code: d.main_activity_code,
          sub_activities: d.sub_activities,
          fiscal_year_end: d.fiscal_year_end,
          cr_agent_source: crResult.source,
          cr_agent_steps: crResult.steps,
        },
        ai_confidence: crResult.confidence,
      }

      return NextResponse.json(result, { headers: buildRateLimitHeaders(rateCheck) })
    }

    /* ── Standard single-call extraction path ── */
    const anthropic = new Anthropic()

    // Detect PDF from mediaType OR from file URL extension
    const isPdf = body.mediaType === 'application/pdf' ||
      (body.fileUrl && /\.pdf(\?|$)/i.test(body.fileUrl))
    let contentBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam

    if (isPdf) {
      if (body.base64Data) {
        contentBlock = {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: body.base64Data,
          },
        }
      } else {
        contentBlock = {
          type: 'document',
          source: {
            type: 'url',
            url: body.fileUrl!,
          },
        }
      }
    } else if (body.base64Data) {
      const mediaType = ALLOWED_MEDIA_TYPES.includes(body.mediaType as typeof ALLOWED_MEDIA_TYPES[number])
        ? (body.mediaType as Anthropic.Base64ImageSource['media_type'])
        : 'image/jpeg'
      contentBlock = {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: body.base64Data,
        },
      }
    } else {
      contentBlock = {
        type: 'image',
        source: {
          type: 'url',
          url: body.fileUrl!,
        },
      }
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
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

    return NextResponse.json(result, { headers: buildRateLimitHeaders(rateCheck) })
  } catch (error) {
    console.error('[API] analyze-document failed:', {
      userId,
      businessId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Document analysis failed' },
      { status: 502 }
    )
  }
}
