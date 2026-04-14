/**
 * scripts/ingest-rag-corpus.ts
 *
 * Walks `corpus/<source>/` directories and ingests every `.md` file into
 * the `rag_documents` pgvector table using a service-role Supabase client.
 *
 * Usage:
 *   npx tsx scripts/ingest-rag-corpus.ts          # live ingest
 *   npx tsx scripts/ingest-rag-corpus.ts --dry    # dry run (no API/DB calls)
 *
 * Required env for live runs:
 *   VOYAGE_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * README files (README.md) are skipped — they're meant for humans.
 */

import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { chunkText } from '../src/lib/rag/chunker'
import { embedBatch } from '../src/lib/rag/embeddings'
import type { RagSourceType } from '../src/lib/rag/types'

const DIR_TO_SOURCE_TYPE: Record<string, RagSourceType> = {
  zatca: 'zatca_reg',
  gosi: 'gosi_reg',
  socpa: 'socpa',
}

interface FileEntry {
  sourceType: RagSourceType
  sourceId: string
  absPath: string
  relPath: string
}

async function discoverFiles(corpusRoot: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = []
  let dirs: string[]
  try {
    dirs = await fs.readdir(corpusRoot)
  } catch {
    return entries
  }
  for (const dir of dirs) {
    const sourceType = DIR_TO_SOURCE_TYPE[dir]
    if (!sourceType) continue
    const subDir = path.join(corpusRoot, dir)
    const stat = await fs.stat(subDir).catch(() => null)
    if (!stat?.isDirectory()) continue
    const files = await fs.readdir(subDir)
    for (const f of files) {
      if (!f.toLowerCase().endsWith('.md')) continue
      if (f.toLowerCase() === 'readme.md') continue
      const abs = path.join(subDir, f)
      const sourceId = path.basename(f, path.extname(f))
      entries.push({
        sourceType,
        sourceId,
        absPath: abs,
        relPath: path.relative(corpusRoot, abs),
      })
    }
  }
  return entries.sort((a, b) => a.relPath.localeCompare(b.relPath))
}

async function ingestOne(
  client: any,
  f: FileEntry,
  dryRun: boolean,
): Promise<number> {
  const content = await fs.readFile(f.absPath, 'utf8')
  const chunks = chunkText(content)
  if (dryRun) return chunks.length

  // Extract a title from the first heading line, fallback to sourceId.
  const titleMatch = content.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : f.sourceId

  // Idempotency: delete prior doc rows for (source_type, source_id).
  await client
    .from('rag_documents')
    .delete()
    .eq('source_type', f.sourceType)
    .eq('source_id', f.sourceId)

  const { data: doc, error: docErr } = await client
    .from('rag_documents')
    .insert({
      business_id: null,
      source_type: f.sourceType,
      source_id: f.sourceId,
      title,
      content,
      metadata: { path: f.relPath, ingested_at: new Date().toISOString() },
    })
    .select('id')
    .single()
  if (docErr || !doc) throw new Error(`insert document failed: ${docErr?.message}`)

  const vectors = await embedBatch(chunks.map((c) => c.content))
  const rows = chunks.map((c, i) => ({
    document_id: (doc as { id: string }).id,
    chunk_index: i,
    content: c.content,
    embedding: vectors[i],
    token_count: c.tokenCount,
  }))
  const { error: chunkErr } = await client.from('rag_chunks').insert(rows)
  if (chunkErr) throw new Error(`insert chunks failed: ${chunkErr.message}`)
  return chunks.length
}

async function main() {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry') || argv.includes('--dry-run')
  const here = path.dirname(fileURLToPath(import.meta.url))
  const corpusRoot = path.resolve(here, '..', 'corpus')

  console.log(`[rag-ingest] corpus root: ${corpusRoot}`)
  console.log(`[rag-ingest] mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)

  const files = await discoverFiles(corpusRoot)
  if (files.length === 0) {
    console.log('[rag-ingest] no markdown files found — nothing to do.')
    return
  }
  console.log(`[rag-ingest] discovered ${files.length} file(s):`)
  for (const f of files) {
    console.log(`  - [${f.sourceType}] ${f.relPath} (source_id=${f.sourceId})`)
  }

  let client: ReturnType<typeof createClient> | null = null
  if (!dryRun) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('[rag-ingest] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      process.exit(1)
    }
    client = createClient(url, key, { auth: { persistSession: false } })
  }

  let ok = 0, failed = 0, totalChunks = 0
  for (const f of files) {
    try {
      const n = await ingestOne(client!, f, dryRun)
      totalChunks += n
      ok += 1
      console.log(`[rag-ingest] ${dryRun ? 'planned' : 'ingested'} ${f.relPath}: ${n} chunk(s)`)
    } catch (err) {
      failed += 1
      console.error(`[rag-ingest] FAILED ${f.relPath}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  console.log(`[rag-ingest] done. files: ${ok} ok / ${failed} failed, total chunks: ${totalChunks}`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('[rag-ingest] fatal:', err)
  process.exit(1)
})
