import { describe, it, expect, vi } from 'vitest'
import { onDocumentUploaded, onObligationCompleted, onTransactionsChanged } from '@/lib/cross-module/events'

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    single: vi.fn().mockResolvedValue({ data: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  }
  return {
    from: vi.fn().mockReturnValue(chainable),
    ...overrides,
  } as unknown as Parameters<typeof onDocumentUploaded>[0]
}

describe('onDocumentUploaded', () => {
  it('should return linked: false for unknown document types', async () => {
    const supabase = createMockSupabase()
    const result = await onDocumentUploaded(supabase, 'biz-1', {
      id: 'doc-1',
      type: 'OTHER',
    })
    expect(result.linked).toBe(false)
    expect(result.suggestions).toEqual([])
  })

  it('should return suggestions for CR documents', async () => {
    const supabase = createMockSupabase()
    const result = await onDocumentUploaded(supabase, 'biz-1', {
      id: 'doc-1',
      type: 'CR',
      expiry_date: '2027-01-01',
    })
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions[0].obligationType).toBe('CR_CONFIRMATION')
  })

  it('should return suggestions for GOSI_CERT documents', async () => {
    const supabase = createMockSupabase()
    const result = await onDocumentUploaded(supabase, 'biz-1', {
      id: 'doc-1',
      type: 'GOSI_CERT',
    })
    expect(result.suggestions.some((s) => s.obligationType === 'GOSI')).toBe(true)
  })

  it('should not throw on Supabase errors', async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => { throw new Error('DB down') }),
    } as unknown as Parameters<typeof onDocumentUploaded>[0]

    const result = await onDocumentUploaded(supabase, 'biz-1', {
      id: 'doc-1',
      type: 'CR',
    })
    expect(result.linked).toBe(false)
    expect(result.suggestions).toEqual([])
  })

  it('should return correct shape', async () => {
    const supabase = createMockSupabase()
    const result = await onDocumentUploaded(supabase, 'biz-1', {
      id: 'doc-1',
      type: 'INSURANCE',
      expiry_date: '2027-06-01',
    })
    expect(result).toHaveProperty('linked')
    expect(result).toHaveProperty('suggestions')
    expect(Array.isArray(result.suggestions)).toBe(true)
  })
})

describe('onObligationCompleted', () => {
  it('should return needsProof: true when no matching document exists', async () => {
    const supabase = createMockSupabase()
    const result = await onObligationCompleted(supabase, 'biz-1', 'ob-1', 'GOSI')
    expect(result.needsProof).toBe(true)
    expect(result.suggestedDocumentType).toBe('GOSI_CERT')
  })

  it('should return needsProof: true with no suggested doc type for unmapped obligation types', async () => {
    const supabase = createMockSupabase()
    const result = await onObligationCompleted(supabase, 'biz-1', 'ob-1', 'CUSTOM')
    expect(result.needsProof).toBe(true)
    expect(result.suggestedDocumentType).toBeUndefined()
  })

  it('should not throw on Supabase errors', async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => { throw new Error('DB down') }),
    } as unknown as Parameters<typeof onObligationCompleted>[0]

    const result = await onObligationCompleted(supabase, 'biz-1', 'ob-1', 'GOSI')
    expect(result.needsProof).toBe(false)
  })

  it('should return correct shape', async () => {
    const supabase = createMockSupabase()
    const result = await onObligationCompleted(supabase, 'biz-1', 'ob-1', 'ZATCA_VAT')
    expect(result).toHaveProperty('needsProof')
  })
})

describe('onTransactionsChanged', () => {
  it('should not throw on success', async () => {
    const supabase = createMockSupabase()
    await expect(onTransactionsChanged(supabase, 'biz-1')).resolves.toBeUndefined()
  })

  it('should not throw on Supabase errors', async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => { throw new Error('DB down') }),
    } as unknown as Parameters<typeof onTransactionsChanged>[0]

    await expect(onTransactionsChanged(supabase, 'biz-1')).resolves.toBeUndefined()
  })
})
