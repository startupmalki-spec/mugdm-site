import { addYears } from 'date-fns'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Document, DocumentType, ObligationFrequency, ObligationType } from '@/lib/supabase/types'

type ObligationInsert = Database['public']['Tables']['obligations']['Insert']
type ObligationUpdate = Database['public']['Tables']['obligations']['Update']

interface ObligationSelectBuilder {
  select(columns: string): {
    eq(col: string, val: string): {
      eq(col: string, val: string): {
        maybeSingle(): PromiseLike<{ data: { id: string } | null }>
      }
    }
  }
}

interface ObligationUpdateBuilder {
  update(values: ObligationUpdate): {
    eq(col: string, val: string): PromiseLike<{ error: { message: string } | null }>
  }
}

interface ObligationInsertBuilder {
  insert(values: ObligationInsert): {
    select(columns: string): {
      single(): PromiseLike<{ data: { id: string } | null }>
    }
  }
}

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
      .from('obligations') as unknown as ObligationSelectBuilder)
      .select('id')
      .eq('business_id', businessId)
      .eq('type', mapping.obligationType)
      .maybeSingle()

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        linked_document_id: document.id,
      }
      if (document.expiry_date) {
        updatePayload.next_due_date = document.expiry_date
      }

      await (supabase.from('obligations') as unknown as ObligationUpdateBuilder)
        .update(updatePayload as ObligationUpdate)
        .eq('id', existing.id)

      return existing.id
    }

    const { data: created } = await (supabase
      .from('obligations') as unknown as ObligationInsertBuilder)
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
      .single()

    return created?.id ?? null
  } catch (err) {
    console.error('[linkDocumentToObligation] Failed to link document to obligation:', err)
    return null
  }
}

export { linkDocumentToObligation }
