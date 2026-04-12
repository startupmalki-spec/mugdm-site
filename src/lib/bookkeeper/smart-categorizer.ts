import type { TransactionCategory } from '@/lib/supabase/types'
import { getSuggestedCategory } from './category-learning'

interface CategorizationResult {
  category: TransactionCategory
  confidence: number
  source: 'learned' | 'rule' | 'default'
}

interface PatternRule {
  /** Patterns to match against (case-insensitive) */
  patterns: string[]
  category: TransactionCategory
  confidence: number
}

const SAUDI_RULES: PatternRule[] = [
  // SADAD payments are typically government
  {
    patterns: ['sadad', 'سداد'],
    category: 'GOVERNMENT',
    confidence: 0.8,
  },
  // Telecom providers
  {
    patterns: ['stc', 'الاتصالات السعودية', 'mobily', 'موبايلي', 'zain', 'زين'],
    category: 'UTILITIES',
    confidence: 0.9,
  },
  // Electricity / water
  {
    patterns: [
      'saudi electricity', 'الكهرباء', 'sec ',
      'national water', 'المياه الوطنية',
      'marafiq', 'مرافق',
    ],
    category: 'UTILITIES',
    confidence: 0.95,
  },
  // Fuel / transport
  {
    patterns: ['aramco', 'أرامكو', 'petrol', 'بنزين', 'naqel', 'ناقل', 'smsa', 'dhl', 'fedex', 'aramex'],
    category: 'TRANSPORT',
    confidence: 0.85,
  },
  // Salary patterns
  {
    patterns: ['salary', 'راتب', 'payroll', 'رواتب', 'wages', 'أجور', 'wps'],
    category: 'SALARY',
    confidence: 0.9,
  },
  // Government entities
  {
    patterns: [
      'gosi', 'التأمينات الاجتماعية',
      'zatca', 'الزكاة والضريبة',
      'mol ', 'وزارة العمل',
      'qiwa', 'قوى',
      'balady', 'بلدي', 'البلدية', 'أمانة',
      'ministry', 'وزارة',
      'misa',
      'الغرفة التجارية', 'chamber of commerce',
    ],
    category: 'GOVERNMENT',
    confidence: 0.9,
  },
  // Rent
  {
    patterns: ['rent', 'إيجار', 'ejar', 'إيجار', 'lease'],
    category: 'RENT',
    confidence: 0.85,
  },
  // Insurance
  {
    patterns: ['insurance', 'تأمين', 'tawuniya', 'التعاونية', 'bupa', 'medgulf'],
    category: 'INSURANCE',
    confidence: 0.85,
  },
  // Bank fees
  {
    patterns: ['bank fee', 'رسوم بنكية', 'service charge', 'عمولة', 'commission', 'transfer fee'],
    category: 'BANK_FEES',
    confidence: 0.8,
  },
  // Marketing
  {
    patterns: ['google ads', 'meta ads', 'facebook ads', 'snapchat', 'tiktok ads', 'إعلان', 'advertising', 'تسويق'],
    category: 'MARKETING',
    confidence: 0.85,
  },
  // Professional services
  {
    patterns: ['consulting', 'استشار', 'legal', 'محاماة', 'audit', 'مراجعة', 'accounting', 'محاسبة'],
    category: 'PROFESSIONAL',
    confidence: 0.8,
  },
]

function matchesAnyPattern(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase()
  return patterns.some((p) => lower.includes(p.toLowerCase()))
}

/**
 * Smart transaction categorizer that uses:
 * 1. Learned corrections from user history (highest priority)
 * 2. Saudi-specific rule-based patterns
 * 3. Default fallback
 */
export function categorizeTransaction(
  description: string,
  vendor: string,
  _amount?: number
): CategorizationResult {
  // 1. Check learned corrections first
  if (vendor) {
    const learned = getSuggestedCategory(vendor)
    if (learned) {
      return { category: learned, confidence: 0.95, source: 'learned' }
    }
  }

  // 2. Apply Saudi-specific rules against combined text
  const haystack = [description ?? '', vendor ?? ''].join(' ')
  if (haystack.trim()) {
    for (const rule of SAUDI_RULES) {
      if (matchesAnyPattern(haystack, rule.patterns)) {
        return { category: rule.category, confidence: rule.confidence, source: 'rule' }
      }
    }
  }

  // 3. Default fallback
  return { category: 'OTHER_EXPENSE', confidence: 0.1, source: 'default' }
}
