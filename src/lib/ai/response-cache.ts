import { createHash } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import type { TaskType } from './model-router'

/**
 * AI response cache (PRD_AI_OPTIMIZATION §4).
 * - Content-addressed: identical task+model+input returns a stored response.
 * - Platform-level table — accessed only via the service-role client.
 * - Silent-fail everywhere: cache must never break a live request.
 */

const DEFAULT_TTL_SECONDS: Record<string, number> = {
  receipt_analysis: 60 * 60 * 24 * 30, // 30d (content-addressed, immutable)
  document_analysis: 60 * 60 * 24 * 30,
  document_analysis_complex: 60 * 60 * 24 * 30,
  statement_parsing: 60 * 60 * 24 * 30,
  statement_parsing_csv: 60 * 60 * 24 * 30,
  statement_parsing_pdf: 60 * 60 * 24 * 30,
  cr_extraction: 60 * 60 * 24 * 7, // 7d (CR data evolves)
  chat: 60 * 5, // 5m (business context ages fast)
  chat_advisory: 60 * 5,
  chat_simple: 60 * 5,
  classification: 60 * 60 * 24,
  intelligence_classification: 60 * 60 * 24,
}

const FALLBACK_TTL_SECONDS = 60 * 60 * 24

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function computeCacheKey(input: {
  task: TaskType
  model: string
  payload: string | Buffer | object
}): string {
  const payloadStr =
    typeof input.payload === 'string'
      ? input.payload
      : Buffer.isBuffer(input.payload)
        ? input.payload.toString('base64')
        : JSON.stringify(input.payload)
  return createHash('sha256')
    .update(`${input.task}::${input.model}::${payloadStr}`)
    .digest('hex')
}

export interface CachedResponse<T = unknown> {
  response: T
  model: string
  hit_count: number
}

/**
 * Look up a cached response. Returns null on miss, expired entry, or any error.
 * On hit, increments hit_count asynchronously (fire-and-forget).
 */
export async function getCached<T = unknown>(
  cacheKey: string
): Promise<CachedResponse<T> | null> {
  const client = serviceClient()
  if (!client) return null

  try {
    const { data, error } = await (client
      .from('ai_response_cache')
      .select('response, model, hit_count, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle() as unknown as Promise<{
        data: { response: unknown; model: string; hit_count: number; expires_at: string } | null
        error: unknown
      }>)

    if (error || !data) return null
    if (new Date(data.expires_at).getTime() <= Date.now()) return null

    // Fire-and-forget hit_count increment.
    void (client
      .from('ai_response_cache')
      .update({ hit_count: (data.hit_count ?? 0) + 1 } as never)
      .eq('cache_key', cacheKey) as unknown as Promise<unknown>)
      .then(
        () => undefined,
        () => undefined
      )

    return {
      response: data.response as T,
      model: data.model,
      hit_count: data.hit_count ?? 0,
    }
  } catch {
    return null
  }
}

export async function setCached(params: {
  cacheKey: string
  task: TaskType
  model: string
  response: unknown
  tokensSavedIn?: number
  tokensSavedOut?: number
  ttlSeconds?: number
}): Promise<void> {
  const client = serviceClient()
  if (!client) return

  const ttl =
    params.ttlSeconds ?? DEFAULT_TTL_SECONDS[params.task] ?? FALLBACK_TTL_SECONDS
  const expires = new Date(Date.now() + ttl * 1000).toISOString()

  try {
    await client
      .from('ai_response_cache')
      .upsert(
        {
          cache_key: params.cacheKey,
          task_type: params.task,
          model: params.model,
          response: params.response as never,
          tokens_saved_in: params.tokensSavedIn ?? 0,
          tokens_saved_out: params.tokensSavedOut ?? 0,
          expires_at: expires,
          hit_count: 1,
        } as never,
        { onConflict: 'cache_key' }
      )
  } catch {
    // silent — cache is best-effort
  }
}
