import type { SupabaseClient } from '@supabase/supabase-js'
import type { DocumentType, ObligationType } from '@/lib/supabase/types'
import { linkDocumentToObligation } from '@/lib/documents/link-to-obligations'
import { detectComplianceImplications, type ComplianceSuggestion } from '@/lib/compliance/auto-detect'
import { DOCUMENT_OBLIGATION_MAP } from '@/lib/compliance/cross-module'

interface DocumentInput {
  id: string
  type: DocumentType
  expiry_date?: string | null
  extracted_data?: Record<string, unknown> | null
  is_current?: boolean
  file_url?: string | null
  archived_at?: string | null
}

interface OnDocumentUploadedResult {
  linked: boolean
  obligationId?: string
  obligationType?: string
  suggestions: ComplianceSuggestion[]
}

interface OnObligationCompletedResult {
  needsProof: boolean
  suggestedDocumentType?: DocumentType
  proofDocumentId?: string
}

// Reverse map: obligation type → document type
const OBLIGATION_TO_DOCUMENT = Object.fromEntries(
  Object.entries(DOCUMENT_OBLIGATION_MAP).map(([docType, obType]) => [obType, docType])
) as Partial<Record<ObligationType, DocumentType>>

async function touchBusinessTimestamp(supabase: SupabaseClient, businessId: string) {
  await (supabase.from('businesses') as unknown as {
    update(v: Record<string, unknown>): { eq(c: string, v: string): Promise<unknown> }
  }).update({ last_data_update: new Date().toISOString() }).eq('id', businessId)
}

/**
 * Called after a document is uploaded to the vault.
 * Links it to matching obligations and returns compliance suggestions.
 */
export async function onDocumentUploaded(
  supabase: SupabaseClient,
  businessId: string,
  document: DocumentInput
): Promise<OnDocumentUploadedResult> {
  try {
    // Link to obligation
    const obligationId = await linkDocumentToObligation(supabase, businessId, document as never)
    const obligationType = DOCUMENT_OBLIGATION_MAP[document.type]

    // Detect compliance implications
    const suggestions = detectComplianceImplications(document.type, {
      expiryDate: document.expiry_date,
    })

    await touchBusinessTimestamp(supabase, businessId)

    return {
      linked: obligationId !== null,
      obligationId: obligationId ?? undefined,
      obligationType: obligationType ?? undefined,
      suggestions,
    }
  } catch (err) {
    console.error('[onDocumentUploaded] Error:', err)
    return { linked: false, suggestions: [] }
  }
}

/**
 * Called after an obligation is marked as complete.
 * Checks if proof documentation exists.
 */
export async function onObligationCompleted(
  supabase: SupabaseClient,
  businessId: string,
  obligationId: string,
  obligationType: string
): Promise<OnObligationCompletedResult> {
  try {
    const suggestedDocType = OBLIGATION_TO_DOCUMENT[obligationType as ObligationType]

    if (suggestedDocType) {
      const { data: doc } = await supabase
        .from('documents')
        .select('id')
        .eq('business_id', businessId)
        .eq('type', suggestedDocType)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (doc) {
        // Attach proof to the obligation
        await (supabase.from('obligations') as unknown as {
          update(v: Record<string, unknown>): { eq(c: string, v: string): Promise<unknown> }
        }).update({
          notes: JSON.stringify({
            proof_document_id: doc.id,
            proof_uploaded_at: new Date().toISOString(),
          }),
        }).eq('id', obligationId)

        await touchBusinessTimestamp(supabase, businessId)

        return { needsProof: false, proofDocumentId: doc.id }
      }
    }

    await touchBusinessTimestamp(supabase, businessId)

    return {
      needsProof: true,
      suggestedDocumentType: suggestedDocType,
    }
  } catch (err) {
    console.error('[onObligationCompleted] Error:', err)
    return { needsProof: false }
  }
}

/**
 * Called after transactions are imported or added.
 * Lightweight signal for dashboard staleness.
 */
export async function onTransactionsChanged(
  supabase: SupabaseClient,
  businessId: string
): Promise<void> {
  try {
    await touchBusinessTimestamp(supabase, businessId)
  } catch (err) {
    console.error('[onTransactionsChanged] Error:', err)
  }
}
