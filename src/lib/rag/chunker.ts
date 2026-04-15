/**
 * Recursive text chunker, ~500 tokens with 50-token overlap.
 *
 * We use a char-based token approximation (1 token ≈ 4 chars) to avoid pulling
 * in @anthropic-ai/tokenizer as a new dep. Good enough for chunk sizing; exact
 * token counts for billing come from the embedding provider's response.
 */

const CHARS_PER_TOKEN = 4
const DEFAULT_CHUNK_TOKENS = 500
const DEFAULT_OVERLAP_TOKENS = 50

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', '؟ ', '، ', ' ', '']

export interface Chunk {
  content: string
  index: number
  tokenCount: number
}

export interface ChunkOptions {
  chunkTokens?: number
  overlapTokens?: number
  separators?: string[]
}

export function approxTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Split text recursively by the first separator that yields pieces ≤ maxChars.
 * Mirrors langchain's RecursiveCharacterTextSplitter behavior minimally.
 */
function recursiveSplit(text: string, maxChars: number, separators: string[]): string[] {
  if (text.length <= maxChars) return [text]

  for (let i = 0; i < separators.length; i++) {
    const sep = separators[i]
    if (sep === '') {
      // Final fallback: hard slice.
      const pieces: string[] = []
      for (let j = 0; j < text.length; j += maxChars) {
        pieces.push(text.slice(j, j + maxChars))
      }
      return pieces
    }
    if (!text.includes(sep)) continue

    const parts = text.split(sep)
    const rest = separators.slice(i + 1)
    const out: string[] = []
    for (const part of parts) {
      if (part.length === 0) continue
      const piece = out.length === 0 ? part : sep + part
      if (piece.length <= maxChars) {
        out.push(piece)
      } else {
        out.push(...recursiveSplit(piece, maxChars, rest))
      }
    }
    return out.filter((p) => p.trim().length > 0)
  }
  return [text]
}

/**
 * Greedy-pack small pieces up to chunkTokens, then slide with `overlapTokens`.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): Chunk[] {
  const chunkTokens = opts.chunkTokens ?? DEFAULT_CHUNK_TOKENS
  const overlapTokens = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS
  const separators = opts.separators ?? DEFAULT_SEPARATORS

  const maxChars = chunkTokens * CHARS_PER_TOKEN
  const overlapChars = overlapTokens * CHARS_PER_TOKEN

  const trimmed = text.trim()
  if (!trimmed) return []

  const pieces = recursiveSplit(trimmed, maxChars, separators)

  const chunks: Chunk[] = []
  let buffer = ''
  let idx = 0

  const flush = () => {
    if (!buffer.trim()) return
    chunks.push({
      content: buffer.trim(),
      index: idx++,
      tokenCount: approxTokenCount(buffer),
    })
  }

  for (const piece of pieces) {
    if ((buffer + piece).length > maxChars && buffer.length > 0) {
      flush()
      // Start next buffer with trailing overlap from previous chunk.
      const prev = chunks[chunks.length - 1]?.content ?? ''
      const overlap = prev.slice(-overlapChars)
      buffer = overlap + piece
    } else {
      buffer += piece
    }
  }
  flush()

  return chunks
}
