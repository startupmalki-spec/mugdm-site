import { NextResponse } from 'next/server'

import type { DocumentType } from '@/lib/supabase/types'

interface AnalyzeRequest {
  fileUrl: string
  fileName: string
  businessId: string
}

interface AnalyzeResponse {
  type: DocumentType
  confidence: number
  expiryDate: string | null
}

/**
 * Mock document analysis endpoint.
 * In production, this would call Claude Vision API to:
 * 1. Identify the document type from visual content
 * 2. Extract expiry dates, registration numbers, etc.
 * 3. Return structured extracted_data
 */

const FILENAME_PATTERNS: Array<{ pattern: RegExp; type: DocumentType }> = [
  { pattern: /cr|commercial|سجل|تجاري/i, type: 'CR' },
  { pattern: /gosi|تأمين|social/i, type: 'GOSI_CERT' },
  { pattern: /zakat|زكاة|clearance/i, type: 'ZAKAT_CLEARANCE' },
  { pattern: /insurance|تأمين.*شامل/i, type: 'INSURANCE' },
  { pattern: /chamber|غرفة/i, type: 'CHAMBER' },
  { pattern: /balad|بلد|municipal/i, type: 'BALADY' },
  { pattern: /misa|استثمار|invest/i, type: 'MISA' },
  { pattern: /lease|إيجار|rent/i, type: 'LEASE' },
  { pattern: /saudiz|توطين|nitaqat/i, type: 'SAUDIZATION_CERT' },
  { pattern: /bank|بنك|statement/i, type: 'BANK_STATEMENT' },
  { pattern: /tax|ضريب|vat/i, type: 'TAX_REGISTRATION' },
]

function detectTypeFromFilename(fileName: string): { type: DocumentType; confidence: number } {
  for (const { pattern, type } of FILENAME_PATTERNS) {
    if (pattern.test(fileName)) {
      return { type, confidence: 0.6 + Math.random() * 0.25 }
    }
  }
  return { type: 'OTHER', confidence: 0.3 }
}

function generateMockExpiryDate(): string {
  const today = new Date()
  const monthsAhead = 1 + Math.floor(Math.random() * 12)
  const expiry = new Date(today.getFullYear(), today.getMonth() + monthsAhead, today.getDate())
  return expiry.toISOString().split('T')[0]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest

    if (!body.fileUrl || !body.businessId) {
      return NextResponse.json(
        { error: 'fileUrl and businessId are required' },
        { status: 400 }
      )
    }

    // NOTE(moe): Replace with Claude Vision API call for production
    // const anthropic = new Anthropic()
    // const response = await anthropic.messages.create({
    //   model: 'claude-sonnet-4-20250514',
    //   max_tokens: 1024,
    //   messages: [{ role: 'user', content: [
    //     { type: 'image', source: { type: 'url', url: body.fileUrl } },
    //     { type: 'text', text: 'Identify this Saudi business document...' }
    //   ]}]
    // })

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    const fileName = body.fileName ?? body.fileUrl.split('/').pop() ?? ''
    const { type, confidence } = detectTypeFromFilename(fileName)
    const hasExpiry = type !== 'BANK_STATEMENT' && type !== 'OTHER'

    const result: AnalyzeResponse = {
      type,
      confidence: Math.round(confidence * 100) / 100,
      expiryDate: hasExpiry ? generateMockExpiryDate() : null,
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Failed to analyze document' },
      { status: 500 }
    )
  }
}
