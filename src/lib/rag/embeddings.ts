/**
 * Embedding provider. Uses Voyage AI (voyage-large-2) for 1024-dim embeddings.
 *
 * Why Voyage (vs OpenAI text-embedding-3-small/large, Cohere, Anthropic):
 *   - Anthropic does not ship an embeddings API; they officially recommend Voyage.
 *   - voyage-large-2 is 1024-dim (matches our pgvector schema) and benchmarks
 *     strongly on retrieval MTEB.
 *   - OpenAI text-embedding-3-small is 1536-dim (mismatch) and requires an
 *     additional dependency we don't want to pull in for one feature.
 *   - Cohere embed-multilingual-v3 is 1024-dim and a reasonable alt for Arabic;
 *     we can swap it in behind the same `embed()` contract if Voyage Arabic
 *     quality is insufficient for ZATCA/GOSI docs.
 */

export const EMBEDDING_DIM = 1024
const VOYAGE_MODEL = 'voyage-large-2'
const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings'

export class EmbeddingConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmbeddingConfigError'
  }
}

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>
  model: string
  usage?: { total_tokens: number }
}

/**
 * Embed a single text into a 1024-dim vector.
 * Throws EmbeddingConfigError if VOYAGE_API_KEY is not configured.
 */
export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new EmbeddingConfigError('configure VOYAGE_API_KEY')
  }

  const res = await fetch(VOYAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text],
      model: VOYAGE_MODEL,
      input_type: 'query',
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Voyage embedding failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as VoyageEmbeddingResponse
  const vec = json.data?.[0]?.embedding
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `Voyage returned unexpected embedding shape: got ${vec?.length}, expected ${EMBEDDING_DIM}`
    )
  }
  return vec
}

/**
 * Batch embed — used by ingest for efficiency. `input_type: 'document'` is the
 * recommended setting for corpus indexing (vs 'query' at search time).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new EmbeddingConfigError('configure VOYAGE_API_KEY')
  }
  if (texts.length === 0) return []

  const res = await fetch(VOYAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: 'document',
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Voyage batch embedding failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as VoyageEmbeddingResponse
  // Ensure ordered by index.
  const sorted = [...json.data].sort((a, b) => a.index - b.index)
  return sorted.map((d) => d.embedding)
}
