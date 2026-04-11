import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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
  csvContent: string
  bankName?: string
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

function buildFallbackResponse(): ParseStatementResponse {
  return {
    transactions: [],
    period_start: null,
    period_end: null,
    total_rows_parsed: 0,
  }
}

function parseClaudeResponse(text: string): ParseStatementResponse {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return buildFallbackResponse()

  const parsed = JSON.parse(jsonMatch[0]) as Partial<ParseStatementResponse>

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
  try {
    const body = (await request.json()) as ParseStatementRequest

    if (!body.csvContent || typeof body.csvContent !== 'string') {
      return NextResponse.json(
        { error: 'csvContent is required' },
        { status: 400 }
      )
    }

    const truncatedCsv = body.csvContent.length > MAX_CSV_CHARS
      ? body.csvContent.slice(0, MAX_CSV_CHARS)
      : body.csvContent

    const anthropic = new Anthropic()

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: buildParsingPrompt(truncatedCsv, body.bankName),
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
