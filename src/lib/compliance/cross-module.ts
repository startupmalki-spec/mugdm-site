import type { Document, DocumentType, Obligation, ObligationType } from '@/lib/supabase/types'
import { getExpiryStatus } from '@/lib/documents'
import { getObligationStatus } from '@/lib/compliance/rules-engine'

// --- Document-to-Obligation mapping ---

const DOCUMENT_OBLIGATION_MAP: Partial<Record<DocumentType, ObligationType>> = {
  CR: 'CR_CONFIRMATION',
  GOSI_CERT: 'GOSI',
  ZAKAT_CLEARANCE: 'ZAKAT',
  INSURANCE: 'INSURANCE',
  CHAMBER: 'CHAMBER',
  BALADY: 'BALADY',
}

interface DocumentObligationLink {
  documentId: string
  obligationId: string
  documentType: DocumentType
  obligationType: ObligationType
}

/**
 * Auto-detect which documents relate to which obligations based on type mapping.
 */
function linkDocumentsToObligations(
  documents: Document[],
  obligations: Obligation[]
): DocumentObligationLink[] {
  const links: DocumentObligationLink[] = []

  for (const doc of documents) {
    if (!doc.is_current || doc.archived_at) continue
    const obligationType = DOCUMENT_OBLIGATION_MAP[doc.type]
    if (!obligationType) continue

    const matchingObligation = obligations.find((ob) => ob.type === obligationType)
    if (matchingObligation) {
      links.push({
        documentId: doc.id,
        obligationId: matchingObligation.id,
        documentType: doc.type,
        obligationType,
      })
    }
  }

  return links
}

// --- Compliance Health Score ---

interface ComplianceHealthScore {
  score: number
  breakdown: {
    obligationsUpToDate: number
    documentsValid: number
    obligationsWithProof: number
    noOverdueBonus: number
  }
}

/**
 * Calculate a 0-100 compliance health score based on documents and obligations.
 *
 * Weights:
 * - 40% obligations up to date (not overdue)
 * - 30% documents valid (not expired)
 * - 20% obligations with linked proof documents
 * - 10% no overdue items bonus
 */
function calculateComplianceHealthScore(
  documents: Document[],
  obligations: Obligation[]
): ComplianceHealthScore {
  const currentDocs = documents.filter((d) => d.is_current && !d.archived_at)

  // 1. % of obligations up to date (not overdue) — weight 40%
  let obligationsUpToDatePct = 1
  if (obligations.length > 0) {
    const upToDate = obligations.filter((ob) => {
      const status = getObligationStatus(ob.next_due_date, ob.last_completed_at)
      return status !== 'overdue'
    }).length
    obligationsUpToDatePct = upToDate / obligations.length
  }

  // 2. % of documents valid (not expired) — weight 30%
  let documentsValidPct = 1
  if (currentDocs.length > 0) {
    const valid = currentDocs.filter((d) => {
      const status = getExpiryStatus(d.expiry_date)
      return status === 'valid' || status === 'none'
    }).length
    documentsValidPct = valid / currentDocs.length
  }

  // 3. % of obligations with linked proof documents — weight 20%
  let obligationsWithProofPct = 1
  const links = linkDocumentsToObligations(currentDocs, obligations)
  const obligationsWithLinks = new Set(links.map((l) => l.obligationId))
  const linkableObligations = obligations.filter((ob) =>
    Object.values(DOCUMENT_OBLIGATION_MAP).includes(ob.type)
  )
  if (linkableObligations.length > 0) {
    obligationsWithProofPct = Math.min(
      1,
      obligationsWithLinks.size / linkableObligations.length
    )
  }

  // 4. No overdue items bonus — weight 10%
  const hasOverdue = obligations.some((ob) => {
    const status = getObligationStatus(ob.next_due_date, ob.last_completed_at)
    return status === 'overdue'
  })
  const hasExpired = currentDocs.some((d) => getExpiryStatus(d.expiry_date) === 'expired')
  const noOverdueBonus = !hasOverdue && !hasExpired ? 1 : 0

  const score = Math.round(
    obligationsUpToDatePct * 40 +
      documentsValidPct * 30 +
      obligationsWithProofPct * 20 +
      noOverdueBonus * 10
  )

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      obligationsUpToDate: Math.round(obligationsUpToDatePct * 100),
      documentsValid: Math.round(documentsValidPct * 100),
      obligationsWithProof: Math.round(obligationsWithProofPct * 100),
      noOverdueBonus: noOverdueBonus * 100,
    },
  }
}

/**
 * Get the color class for a compliance health score.
 */
function getHealthScoreColor(score: number): {
  text: string
  stroke: string
  bg: string
} {
  if (score > 80) {
    return {
      text: 'text-emerald-400',
      stroke: 'stroke-emerald-400',
      bg: 'bg-emerald-500/10',
    }
  }
  if (score >= 50) {
    return {
      text: 'text-amber-400',
      stroke: 'stroke-amber-400',
      bg: 'bg-amber-500/10',
    }
  }
  return {
    text: 'text-red-400',
    stroke: 'stroke-red-400',
    bg: 'bg-red-500/10',
  }
}

export {
  linkDocumentsToObligations,
  calculateComplianceHealthScore,
  getHealthScoreColor,
  DOCUMENT_OBLIGATION_MAP,
}

export type { DocumentObligationLink, ComplianceHealthScore }
