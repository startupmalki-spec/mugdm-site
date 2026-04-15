/**
 * Vector retriever. Embeds a query, calls the match_rag_chunks RPC defined in
 * migration 016, and returns top-k chunks (RLS applies — caller's session
 * decides visibility of business-scoped vs global docs).
 */

import { createClient } from '@/lib/supabase/server'

import { embed } from './embeddings'
import type { RagChunk, RetrieveParams, RetrieveResult, RagSourceType } from './types'

const DEFAULT_K = 8

export async function retrieve(params: RetrieveParams): Promise<RetrieveResult> {
  const { query, businessId = null, sourceTypes, k = DEFAULT_K } = params

  const queryEmbedding = await embed(query)

  const supabase = await createClient()
  // @ts-expect-error — RPC added in migration 016, types not regenerated yet
  const { data, error } = await supabase.rpc('match_rag_chunks', {
    query_embedding: queryEmbedding,
    match_count: k,
    filter_business_id: businessId,
    filter_source_types: sourceTypes ?? null,
  })

  if (error) {
    console.error('[RAG] retrieve failed:', error.message)
    return { chunks: [] }
  }

  const rows = (data ?? []) as Array<{
    chunk_id: string
    document_id: string
    content: string
    metadata: Record<string, unknown> | null
    source_type: string
    score: number
  }>

  const chunks: RagChunk[] = rows.map((r) => ({
    chunk_id: r.chunk_id,
    document_id: r.document_id,
    content: r.content,
    metadata: r.metadata ?? {},
    score: r.score,
    source_type: r.source_type as RagSourceType,
  }))

  return { chunks }
}
