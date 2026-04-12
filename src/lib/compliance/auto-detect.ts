import type { DocumentType, ObligationType } from '@/lib/supabase/types'

export interface ComplianceSuggestion {
  suggestion: string
  suggestionAr: string
  obligationType: ObligationType
  autoCreate: boolean
}

interface ExtractedData {
  expiryDate?: string | null
  registrationNumber?: string | null
  teamMemberCount?: number | null
  [key: string]: unknown
}

/**
 * When a document is uploaded, check if it triggers new compliance requirements.
 * Returns an array of suggestions to show the user.
 */
export function detectComplianceImplications(
  documentType: DocumentType,
  extractedData: ExtractedData
): ComplianceSuggestion[] {
  const suggestions: ComplianceSuggestion[] = []

  switch (documentType) {
    case 'LEASE':
      suggestions.push({
        suggestion: 'New lease detected. Create a Balady license renewal obligation?',
        suggestionAr: 'تم اكتشاف عقد إيجار جديد. هل تريد إنشاء التزام تجديد رخصة البلدية؟',
        obligationType: 'BALADY',
        autoCreate: false,
      })
      break

    case 'INSURANCE':
      suggestions.push({
        suggestion: 'Insurance document uploaded. Create an insurance renewal obligation?',
        suggestionAr: 'تم رفع مستند تأمين. هل تريد إنشاء التزام تجديد التأمين؟',
        obligationType: 'INSURANCE',
        autoCreate: false,
      })
      break

    case 'GOSI_CERT':
      suggestions.push({
        suggestion: 'GOSI certificate uploaded. Verify that team member count matches your records.',
        suggestionAr: 'تم رفع شهادة التأمينات الاجتماعية. تحقق من تطابق عدد الموظفين مع سجلاتك.',
        obligationType: 'GOSI',
        autoCreate: false,
      })
      break

    case 'CR':
      suggestions.push({
        suggestion: 'Commercial Registration uploaded. Create a CR confirmation obligation?',
        suggestionAr: 'تم رفع السجل التجاري. هل تريد إنشاء التزام تأكيد السجل التجاري؟',
        obligationType: 'CR_CONFIRMATION',
        autoCreate: false,
      })
      break

    case 'ZAKAT_CLEARANCE':
      suggestions.push({
        suggestion: 'Zakat clearance uploaded. Create a Zakat filing reminder?',
        suggestionAr: 'تم رفع شهادة الزكاة. هل تريد إنشاء تذكير بإيداع الزكاة؟',
        obligationType: 'ZAKAT',
        autoCreate: false,
      })
      break

    case 'CHAMBER':
      suggestions.push({
        suggestion: 'Chamber of Commerce certificate uploaded. Create a renewal obligation?',
        suggestionAr: 'تم رفع شهادة الغرفة التجارية. هل تريد إنشاء التزام تجديد؟',
        obligationType: 'CHAMBER',
        autoCreate: false,
      })
      break

    case 'BALADY':
      suggestions.push({
        suggestion: 'Balady license uploaded. Create a renewal obligation?',
        suggestionAr: 'تم رفع رخصة البلدية. هل تريد إنشاء التزام تجديد؟',
        obligationType: 'BALADY',
        autoCreate: false,
      })
      break

    case 'MISA':
      suggestions.push({
        suggestion: 'MISA document uploaded. Create a MISA renewal obligation?',
        suggestionAr: 'تم رفع مستند وزارة الاستثمار. هل تريد إنشاء التزام تجديد؟',
        obligationType: 'MISA',
        autoCreate: false,
      })
      break

    default:
      break
  }

  // Any document with an expiry date should suggest a renewal reminder
  if (extractedData.expiryDate && documentType !== 'BANK_STATEMENT') {
    const alreadyHasTypeSpecific = suggestions.some(
      (s) => s.obligationType !== 'CUSTOM'
    )

    if (!alreadyHasTypeSpecific || suggestions.length === 0) {
      suggestions.push({
        suggestion: `Document has an expiry date (${extractedData.expiryDate}). Create a renewal reminder?`,
        suggestionAr: `المستند له تاريخ انتهاء (${extractedData.expiryDate}). هل تريد إنشاء تذكير بالتجديد؟`,
        obligationType: 'CUSTOM',
        autoCreate: false,
      })
    }
  }

  return suggestions
}
