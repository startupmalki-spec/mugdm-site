/**
 * Document ingestion. Chunks, embeds, and persists. Idempotent on
 * (source_type, source_id): re-ingesting wipes prior chunks first.
 */

import { createClient } from '@/lib/supabase/server'

import { chunkText } from './chunker'
import { embedBatch } from './embeddings'
import type { IngestParams, IngestResult } from './types'

export async function ingestDocument(params: IngestParams): Promise<IngestResult> {
  const { businessId, sourceType, sourceId, title, content, metadata = {} } = params

  // Cast to `any` client — rag_documents / rag_chunks tables are added in
  // migration 016; generated Database types are regenerated in a later wave.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // Idempotency: if (source_type, source_id) already exists, delete the old
  // document (chunks cascade) before re-inserting.
  if (sourceId) {
    const { data: existing } = await supabase
      .from('rag_documents')
      .select('id')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)

    if (existing && existing.length > 0) {
      await supabase
        .from('rag_documents')
        .delete()
        .in(
          'id',
          (existing as Array<{ id: string }>).map((d) => d.id)
        )
    }
  }

  const { data: doc, error: docErr } = await supabase
    .from('rag_documents')
    .insert({
      business_id: businessId,
      source_type: sourceType,
      source_id: sourceId,
      title,
      content,
      metadata,
    })
    .select('id')
    .single()

  if (docErr || !doc) {
    throw new Error(`Failed to insert rag_document: ${docErr?.message ?? 'unknown'}`)
  }

  const chunks = chunkText(content)
  if (chunks.length === 0) {
    return { documentId: doc.id, chunkCount: 0 }
  }

  const vectors = await embedBatch(chunks.map((c) => c.content))

  const rows = chunks.map((c, i) => ({
    document_id: doc.id,
    chunk_index: c.index,
    content: c.content,
    // pgvector accepts stringified array via supabase-js:
    embedding: vectors[i] as unknown as string,
    token_count: c.tokenCount,
  }))

  const { error: chunkErr } = await supabase.from('rag_chunks').insert(rows)
  if (chunkErr) {
    throw new Error(`Failed to insert rag_chunks: ${chunkErr.message}`)
  }

  return { documentId: doc.id, chunkCount: chunks.length }
}
