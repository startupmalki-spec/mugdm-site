import { addYears } from 'date-fns'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Document, DocumentType, ObligationFrequency, ObligationType } from '@/lib/supabase/types'

interface ObligationMapping {
  obligationType: ObligationType
  name: string
  frequency: ObligationFrequency
}

const DOCUMENT_TO_OBLIGATION: Partial<Record<DocumentType, ObligationMapping>> = {
  CR: { obligationType: 'CR_CONFIRMATION', name: 'CR Confirmation', frequency: 'ANNUAL' },
  GOSI_CERT: { obligationType: 'GOSI', name: 'GOSI Payment', frequency: 'MONTHLY' },
  ZAKAT_CLEARANCE: { obligationType: 'ZAKAT', name: 'Zakat Filing', frequency: 'ANNUAL' },
  INSURANCE: { obligationType: 'INSURANCE', name: 'Insurance Renewal', frequency: 'ANNUAL' },
  CHAMBER: { obligationType: 'CHAMBER', name: 'Chamber of Commerce Renewal', frequency: 'ANNUAL' },
  BALADY: { obligationType: 'BALADY', name: 'Balady License Renewal', frequency: 'ANNUAL' },
  MISA: { obligationType: 'MISA', name: 'MISA License Renewal', frequency: 'ANNUAL' },
  SAUDIZATION_CERT: { obligationType: 'QIWA', name: 'Qiwa Saudization', frequency: 'ANNUAL' },
  TAX_REGISTRATION: { obligationType: 'ZATCA_VAT', name: 'VAT Return Filing', frequency: 'QUARTERLY' },
}

async function linkDocumentToObligation(
  supabase: SupabaseClient,
  businessId: string,
  document: Document
): Promise<string | null> {
  const mapping = DOCUMENT_TO_OBLIGATION[document.type]
  if (!mapping) return null

  try {
    const nextDueDate = document.expiry_date
      ? document.expiry_date
      : addYears(new Date(), 1).toISOString().split('T')[0]

    const { data: existing } = await (supabase
      .from('obligations') as any)
      .select('id')
      .eq('business_id', businessId)
      .eq('type', mapping.obligationType)
      .maybeSingle() as { data: { id: string } | null }

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        linked_document_id: document.id,
      }
      if (document.expiry_date) {
        updatePayload.next_due_date = document.expiry_date
      }

      await (supabase.from('obligations') as any)
        .update(updatePayload)
        .eq('id', existing.id)

      return existing.id
    }

    const { data: created } = await (supabase
      .from('obligations') as any)
      .insert({
        business_id: businessId,
        type: mapping.obligationType,
        name: mapping.name,
        frequency: mapping.frequency,
        next_due_date: nextDueDate,
        linked_document_id: document.id,
        last_completed_at: null,
        reminder_30d_sent: false,
        reminder_15d_sent: false,
        reminder_7d_sent: false,
        reminder_1d_sent: false,
        description: null,
        notes: null,
      })
      .select('id')
      .single() as { data: { id: string } | null }

    return created?.id ?? null
  } catch (err) {
    console.error('[linkDocumentToObligation] Failed to link document to obligation:', err)
    return null
  }
}

export { linkDocumentToObligation }
