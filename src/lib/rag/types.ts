/**
 * Shared types for the RAG + multi-agent orchestration layer.
 */

export type RagSourceType =
  | 'bill'
  | 'vendor'
  | 'transaction'
  | 'zatca_reg'
  | 'gosi_reg'
  | 'socpa'
  | 'product_doc'

export interface RagChunk {
  content: string
  metadata: Record<string, unknown>
  score: number
  source_type: RagSourceType
  document_id?: string
  chunk_id?: string
}

export interface RetrieveParams {
  query: string
  businessId?: string | null
  sourceTypes?: RagSourceType[]
  k?: number
}

export interface RetrieveResult {
  chunks: RagChunk[]
}

export interface IngestParams {
  businessId: string | null
  sourceType: RagSourceType
  sourceId: string | null
  title: string
  content: string
  metadata?: Record<string, unknown>
}

export interface IngestResult {
  documentId: string
  chunkCount: number
}

export interface OrchestratorSource {
  kind: 'rag' | 'db'
  title?: string
  sourceType?: RagSourceType | string
  excerpt?: string
  score?: number
  ref?: string
}

export interface OrchestratorResult {
  answer: string
  sources: OrchestratorSource[]
  /** Which sub-agents were invoked, in order. */
  trace: string[]
}

export interface SubAgentResult {
  answer: string
  sources: OrchestratorSource[]
}

export interface OrchestrateParams {
  userQuery: string
  businessId: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}
