import type { TransactionCategory } from '@/lib/supabase/types'

export interface BillLineItemExtraction {
  description: string
  quantity: number | null
  unit_price: number | null
  amount: number | null
  category_hint?: TransactionCategory | null
}

export type BillExtractionLanguage = 'ar' | 'en' | 'mixed'

export interface BillExtractionResult {
  vendor_name: string | null
  vendor_vat_number: string | null
  bill_number: string | null
  issue_date: string | null
  due_date: string | null
  subtotal: number | null
  vat_amount: number | null
  vat_rate: number | null
  total: number | null
  currency: string
  line_items: BillLineItemExtraction[]
  confidence: Record<string, number>
  overall_confidence: number
  language_detected: BillExtractionLanguage
}
