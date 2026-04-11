import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

import type { DocumentType } from '@/lib/supabase/types'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

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
  try {
    const body = (await request.json()) as AnalyzeDocumentRequest

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

    const anthropic = new Anthropic()

    let imageContent: Anthropic.ImageBlockParam

    if (body.base64Data) {
      const mediaType = (body.mediaType as Anthropic.Base64ImageSource['media_type']) ?? 'image/jpeg'
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
  } catch {
    return NextResponse.json(buildFallbackResponse())
  }
}
