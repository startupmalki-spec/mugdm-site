import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

import { createClient } from '@/lib/supabase/server'
import { buildRateLimitHeaders } from '@/lib/rate-limit-middleware'
import { checkRateLimit } from '@/lib/rate-limit'
import type { TransactionCategory, TransactionType } from '@/lib/supabase/types'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const SAUDI_BANKS = [
  'Al Rajhi Bank',
  'Saudi National Bank (SNB)',
  'Riyad Bank',
  'SABB',
  'Banque Saudi Fransi',
  'Arab National Bank',
  'Alinma Bank',
  'Bank Albilad',
  'Saudi Investment Bank',
  'Gulf International Bank',
]

interface ParseStatementRequest {
  csvContent?: string
  pdfBase64?: string
  pdfMediaType?: string
  bankName?: string
  businessId?: string
}

interface ParsedTransaction {
  date: string
  amount: number
  type: TransactionType
  description: string
  vendor_or_client: string | null
  category: TransactionCategory
  ai_confidence: number
}

interface ParseStatementResponse {
  transactions: ParsedTransaction[]
  period_start: string | null
  period_end: string | null
  total_rows_parsed: number
}

function buildParsingPrompt(csvContent: string, bankName: string | undefined): string {
  const bankHint = bankName ? `The bank is: ${bankName}.` : `The bank may be one of: ${SAUDI_BANKS.join(', ')}.`

  return `You are an expert at parsing Saudi Arabian bank statement CSV files, including Arabic text columns.

${bankHint}

Parse the following CSV bank statement data and extract all transactions as a JSON array.

For each transaction row, extract:
- date: ISO date string (YYYY-MM-DD)
- amount: absolute numeric amount (always positive)
- type: "INCOME" if money came in (credit/deposit/واردات), "EXPENSE" if money went out (debit/withdrawal/مدين)
- description: the raw transaction description from the CSV
- vendor_or_client: extracted business/person name from description if identifiable, or null
- category: best matching category from: REVENUE, OTHER_INCOME, GOVERNMENT, SALARY, RENT, UTILITIES, SUPPLIES, TRANSPORT, MARKETING, PROFESSIONAL, INSURANCE, BANK_FEES, OTHER_EXPENSE
- ai_confidence: 0 to 1, your confidence this row was parsed correctly

Category hints:
- GOVERNMENT: GOSI, ZATCA, Balady, ministry fees, government charges
- SALARY: payroll, wages, مرتب, راتب
- RENT: rent, إيجار, lease
- UTILITIES: SEC, SWCC, STC, Mobily, Zain, electricity, water, internet
- TRANSPORT: fuel, petrol, Aramco, شحن, courier, Uber, Careem
- BANK_FEES: bank charges, commission, رسوم, ATM fees, transfer fees
- SUPPLIES: office supplies, materials, equipment purchases
- MARKETING: advertising, Google, Meta, printing, promotions
- PROFESSIONAL: consulting, legal, accounting, advisory
- INSURANCE: insurance premiums, tamin, تأمين

Also return:
- period_start: earliest date found as ISO string, or null
- period_end: latest date found as ISO string, or null
- total_rows_parsed: number of transaction rows processed

Skip header rows, summary rows, and non-transaction rows.

Return ONLY valid JSON in this exact structure:
{
  "transactions": [
    {
      "date": "2025-01-15",
      "amount": 5000.00,
      "type": "INCOME",
      "description": "Transfer from client ABC",
      "vendor_or_client": "ABC Company",
      "category": "REVENUE",
      "ai_confidence": 0.9
    }
  ],
  "period_start": "2025-01-01",
  "period_end": "2025-01-31",
  "total_rows_parsed": 25
}

CSV data to parse:
\`\`\`
${csvContent}
\`\`\``
}

function buildPdfParsingPrompt(bankName: string | undefined): string {
  const bankHint = bankName ? `The bank is: ${bankName}.` : `The bank may be one of: ${SAUDI_BANKS.join(', ')}.`

  return `You are an expert at parsing Saudi Arabian bank statement PDF files, including Arabic text.

${bankHint}

This is a PDF bank statement. Extract all transactions from the tables in this document.

For each transaction row, extract:
- date: ISO date string (YYYY-MM-DD)
- amount: absolute numeric amount (always positive)
- type: "INCOME" if money came in (credit/deposit/واردات), "EXPENSE" if money went out (debit/withdrawal/مدين)
- description: the raw transaction description
- vendor_or_client: extracted business/person name from description if identifiable, or null
- category: best matching category from: REVENUE, OTHER_INCOME, GOVERNMENT, SALARY, RENT, UTILITIES, SUPPLIES, TRANSPORT, MARKETING, PROFESSIONAL, INSURANCE, BANK_FEES, OTHER_EXPENSE
- ai_confidence: 0 to 1, your confidence this row was parsed correctly

Category hints:
- GOVERNMENT: GOSI, ZATCA, Balady, ministry fees, government charges
- SALARY: payroll, wages, مرتب, راتب
- RENT: rent, إيجار, lease
- UTILITIES: SEC, SWCC, STC, Mobily, Zain, electricity, water, internet
- TRANSPORT: fuel, petrol, Aramco, شحن, courier, Uber, Careem
- BANK_FEES: bank charges, commission, رسوم, ATM fees, transfer fees
- SUPPLIES: office supplies, materials, equipment purchases
- MARKETING: advertising, Google, Meta, printing, promotions
- PROFESSIONAL: consulting, legal, accounting, advisory
- INSURANCE: insurance premiums, tamin, تأمين

Also return:
- period_start: earliest date found as ISO string, or null
- period_end: latest date found as ISO string, or null
- total_rows_parsed: number of transaction rows processed

Skip header rows, summary rows, and non-transaction rows.

Return ONLY valid JSON in this exact structure:
{
  "transactions": [
    {
      "date": "2025-01-15",
      "amount": 5000.00,
      "type": "INCOME",
      "description": "Transfer from client ABC",
      "vendor_or_client": "ABC Company",
      "category": "REVENUE",
      "ai_confidence": 0.9
    }
  ],
  "period_start": "2025-01-01",
  "period_end": "2025-01-31",
  "total_rows_parsed": 25
}`
}

function buildFallbackResponse(): ParseStatementResponse {
  return {
    transactions: [],
    period_start: null,
    period_end: null,
    total_rows_parsed: 0,
  }
}

function parseClaudeResponse(text: string): ParseStatementResponse {
  // Greedy match needed — response contains nested objects (transactions array)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return buildFallbackResponse()

  let parsed: Partial<ParseStatementResponse>
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return buildFallbackResponse()
  }

  const validTypes: TransactionType[] = ['INCOME', 'EXPENSE']
  const validCategories: TransactionCategory[] = [
    'REVENUE', 'OTHER_INCOME', 'GOVERNMENT', 'SALARY', 'RENT', 'UTILITIES',
    'SUPPLIES', 'TRANSPORT', 'MARKETING', 'PROFESSIONAL', 'INSURANCE', 'BANK_FEES', 'OTHER_EXPENSE',
  ]

  const transactions: ParsedTransaction[] = Array.isArray(parsed.transactions)
    ? parsed.transactions.map((tx) => {
        const type: TransactionType = validTypes.includes(tx.type as TransactionType)
          ? (tx.type as TransactionType)
          : 'EXPENSE'

        const category: TransactionCategory = validCategories.includes(tx.category as TransactionCategory)
          ? (tx.category as TransactionCategory)
          : 'OTHER_EXPENSE'

        const confidence =
          typeof tx.ai_confidence === 'number'
            ? Math.min(1, Math.max(0, tx.ai_confidence))
            : 0.5

        return {
          date: tx.date ?? '',
          amount: typeof tx.amount === 'number' ? Math.abs(tx.amount) : 0,
          type,
          description: tx.description ?? '',
          vendor_or_client: tx.vendor_or_client ?? null,
          category,
          ai_confidence: Math.round(confidence * 100) / 100,
        }
      }).filter((tx) => tx.date && tx.amount > 0)
    : []

  return {
    transactions,
    period_start: parsed.period_start ?? null,
    period_end: parsed.period_end ?? null,
    total_rows_parsed: typeof parsed.total_rows_parsed === 'number' ? parsed.total_rows_parsed : transactions.length,
  }
}

const MAX_CSV_CHARS = 80_000

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

    const body = (await request.json()) as ParseStatementRequest
    businessId = body.businessId

    const hasCsv = body.csvContent && typeof body.csvContent === 'string'
    const hasPdf = body.pdfBase64 && typeof body.pdfBase64 === 'string'

    if (!hasCsv && !hasPdf) {
      return NextResponse.json(
        { error: 'csvContent or pdfBase64 is required' },
        { status: 400 }
      )
    }

    if (!body.businessId) {
      return NextResponse.json(
        { error: 'businessId is required' },
        { status: 400 }
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

    let response: Anthropic.Message

    if (hasPdf && body.pdfBase64) {
      // PDF path: send as document block
      const mediaType = (body.pdfMediaType as 'application/pdf') || 'application/pdf'

      response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: body.pdfBase64,
                },
              },
              {
                type: 'text',
                text: buildPdfParsingPrompt(body.bankName),
              },
            ],
          },
        ],
      })
    } else {
      // CSV text path
      const csvContent = body.csvContent!
      const truncatedCsv = csvContent.length > MAX_CSV_CHARS
        ? csvContent.slice(0, MAX_CSV_CHARS)
        : csvContent

      response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: buildParsingPrompt(truncatedCsv, body.bankName),
          },
        ],
      })
    }

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const result = parseClaudeResponse(responseText)

    return NextResponse.json(result, { headers: buildRateLimitHeaders(rateCheck) })
  } catch (error) {
    console.error('[API] parse-statement failed:', {
      userId,
      businessId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Statement parsing failed' },
      { status: 502 }
    )
  }
}
