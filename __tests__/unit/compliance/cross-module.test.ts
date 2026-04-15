import { describe, it, expect } from 'vitest'
import {
  calculateComplianceHealthScore,
  linkDocumentsToObligations,
  DOCUMENT_OBLIGATION_MAP,
} from '@/lib/compliance/cross-module'
import type { Document, Obligation } from '@/lib/supabase/types'

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    business_id: 'biz-1',
    name: 'Test Doc',
    type: 'CR',
    file_url: '/test.pdf',
    file_size: 1000,
    mime_type: 'application/pdf',
    expiry_date: '2027-01-01',
    is_current: true,
    archived_at: null,
    ai_confidence: 0.9,
    extracted_data: null,
    version_number: 1,
    previous_version_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Document
}

function makeOb(overrides: Partial<Obligation> = {}): Obligation {
  return {
    id: 'ob-1',
    business_id: 'biz-1',
    type: 'CR_CONFIRMATION',
    name: 'CR Confirmation',
    frequency: 'ANNUAL',
    next_due_date: '2027-01-01',
    last_completed_at: null,
    linked_document_id: null,
    reminder_30d_sent: false,
    reminder_15d_sent: false,
    reminder_7d_sent: false,
    reminder_1d_sent: false,
    description: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Obligation
}

describe('DOCUMENT_OBLIGATION_MAP', () => {
  it('should map CR to CR_CONFIRMATION', () => {
    expect(DOCUMENT_OBLIGATION_MAP.CR).toBe('CR_CONFIRMATION')
  })

  it('should map GOSI_CERT to GOSI', () => {
    expect(DOCUMENT_OBLIGATION_MAP.GOSI_CERT).toBe('GOSI')
  })

  it('should map ZAKAT_CLEARANCE to ZAKAT', () => {
    expect(DOCUMENT_OBLIGATION_MAP.ZAKAT_CLEARANCE).toBe('ZAKAT')
  })
})

describe('linkDocumentsToObligations', () => {
  it('should link matching documents to obligations', () => {
    const docs = [makeDoc({ id: 'doc-cr', type: 'CR' })]
    const obs = [makeOb({ id: 'ob-cr', type: 'CR_CONFIRMATION' })]
    const links = linkDocumentsToObligations(docs, obs)
    expect(links.length).toBe(1)
    expect(links[0].documentId).toBe('doc-cr')
    expect(links[0].obligationId).toBe('ob-cr')
  })

  it('should not link archived documents', () => {
    const docs = [makeDoc({ id: 'doc-cr', type: 'CR', archived_at: '2026-01-01T00:00:00Z' })]
    const obs = [makeOb({ id: 'ob-cr', type: 'CR_CONFIRMATION' })]
    const links = linkDocumentsToObligations(docs, obs)
    expect(links.length).toBe(0)
  })

  it('should not link non-current documents', () => {
    const docs = [makeDoc({ id: 'doc-cr', type: 'CR', is_current: false })]
    const obs = [makeOb({ id: 'ob-cr', type: 'CR_CONFIRMATION' })]
    const links = linkDocumentsToObligations(docs, obs)
    expect(links.length).toBe(0)
  })

  it('should return empty for unmatched types', () => {
    const docs = [makeDoc({ type: 'OTHER' })]
    const obs = [makeOb({ type: 'CR_CONFIRMATION' })]
    const links = linkDocumentsToObligations(docs, obs)
    expect(links.length).toBe(0)
  })

  it('should link multiple documents to multiple obligations', () => {
    const docs = [
      makeDoc({ id: 'doc-cr', type: 'CR' }),
      makeDoc({ id: 'doc-gosi', type: 'GOSI_CERT' }),
    ]
    const obs = [
      makeOb({ id: 'ob-cr', type: 'CR_CONFIRMATION' }),
      makeOb({ id: 'ob-gosi', type: 'GOSI' }),
    ]
    const links = linkDocumentsToObligations(docs, obs)
    expect(links.length).toBe(2)
  })
})

describe('calculateComplianceHealthScore', () => {
  it('should return 100 for perfect compliance', () => {
    const docs = [makeDoc({ expiry_date: '2027-12-31' })]
    const obs = [makeOb({ next_due_date: '2027-06-01' })]
    const result = calculateComplianceHealthScore(docs, obs)
    expect(result.score).toBe(100)
  })

  it('should return 100 for empty documents and obligations', () => {
    const result = calculateComplianceHealthScore([], [])
    expect(result.score).toBe(100)
  })

  it('should penalize for overdue obligations', () => {
    const docs: Document[] = []
    const obs = [makeOb({ next_due_date: '2025-01-01', last_completed_at: null })]
    const result = calculateComplianceHealthScore(docs, obs)
    expect(result.score).toBeLessThan(100)
    expect(result.breakdown.obligationsUpToDate).toBe(0)
  })

  it('should penalize for expired documents', () => {
    const docs = [makeDoc({ expiry_date: '2025-01-01' })]
    const obs: Obligation[] = []
    const result = calculateComplianceHealthScore(docs, obs)
    expect(result.score).toBeLessThan(100)
    expect(result.breakdown.documentsValid).toBe(0)
  })

  it('should give bonus for no overdue items', () => {
    const docs = [makeDoc({ expiry_date: '2027-12-31' })]
    const obs = [makeOb({ next_due_date: '2027-06-01' })]
    const result = calculateComplianceHealthScore(docs, obs)
    expect(result.breakdown.noOverdueBonus).toBe(100)
  })

  it('should not give bonus when overdue items exist', () => {
    const docs = [makeDoc({ expiry_date: '2025-01-01' })]
    const obs: Obligation[] = []
    const result = calculateComplianceHealthScore(docs, obs)
    expect(result.breakdown.noOverdueBonus).toBe(0)
  })

  it('should return score between 0 and 100', () => {
    const docs = [makeDoc({ expiry_date: '2025-01-01' })]
    const obs = [makeOb({ next_due_date: '2025-01-01' })]
    const result = calculateComplianceHealthScore(docs, obs)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('should ignore archived documents', () => {
    const docs = [
      makeDoc({ id: 'archived', expiry_date: '2025-01-01', archived_at: '2026-01-01T00:00:00Z' }),
      makeDoc({ id: 'current', expiry_date: '2027-12-31' }),
    ]
    const result = calculateComplianceHealthScore(docs, [])
    expect(result.breakdown.documentsValid).toBe(100)
  })
})
