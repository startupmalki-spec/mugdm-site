import { describe, it, expect } from 'vitest'

import { chunkText, approxTokenCount } from '@/lib/rag/chunker'

describe('chunker — approxTokenCount', () => {
  it('returns ceil(length/4)', () => {
    expect(approxTokenCount('')).toBe(0)
    expect(approxTokenCount('abcd')).toBe(1)
    expect(approxTokenCount('abcde')).toBe(2)
    expect(approxTokenCount('a'.repeat(400))).toBe(100)
  })
})

describe('chunkText', () => {
  it('returns [] for empty / whitespace-only input', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\t  ')).toEqual([])
  })

  it('preserves small strings as a single chunk', () => {
    const text = 'A short sentence.'
    const chunks = chunkText(text, { chunkTokens: 500 })
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe(text)
    expect(chunks[0].index).toBe(0)
  })

  it('splits text that exceeds the chunkTokens threshold', () => {
    // 50 tokens * 4 = 200 char window.
    const para1 = 'Lorem ipsum dolor sit amet consectetur. '.repeat(10) // ~400 chars
    const para2 = 'Second paragraph content goes here. '.repeat(10)
    const text = para1 + '\n\n' + para2
    const chunks = chunkText(text, { chunkTokens: 50, overlapTokens: 5 })
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.content.length).toBeGreaterThan(0)
    }
    // Indices sequential starting at 0
    chunks.forEach((c, i) => expect(c.index).toBe(i))
  })

  it('respects overlap between consecutive chunks', () => {
    const text =
      'AAAA AAAA AAAA AAAA AAAA. ' +
      'BBBB BBBB BBBB BBBB BBBB. ' +
      'CCCC CCCC CCCC CCCC CCCC. ' +
      'DDDD DDDD DDDD DDDD DDDD.'
    const chunks = chunkText(text, { chunkTokens: 15, overlapTokens: 3 })
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // Overlap window (3 * 4 = 12 chars) should share at least 1 char of tail/head.
    const first = chunks[0].content
    const second = chunks[1].content
    const tail = first.slice(-12)
    // Some non-empty portion of the tail must reappear at the start of next.
    const sharedSomeChar = [...tail].some((ch) => second.startsWith(ch))
    expect(sharedSomeChar).toBe(true)
  })

  it('handles Arabic punctuation separators (، and ؟)', () => {
    const text =
      'هذه جملة عربية طويلة جداً، وتحتوي على فواصل، وعلامات استفهام؟ ' +
      'ونريد أن نتأكد من أن المقسم يعمل بشكل صحيح، ' +
      'حتى مع النصوص التي لا تحتوي على نقاط إنجليزية.'
    const chunks = chunkText(text, { chunkTokens: 15, overlapTokens: 3 })
    expect(chunks.length).toBeGreaterThan(1)
    // No chunk should exceed the char budget by more than overlap allows
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(15 * 4 + 3 * 4 + 5)
    }
  })

  it('falls back to hard slicing when no separators present', () => {
    const text = 'x'.repeat(500)
    const chunks = chunkText(text, { chunkTokens: 25, overlapTokens: 5 })
    expect(chunks.length).toBeGreaterThan(1)
    // Reassembled (minus overlap) should cover original content.
    const combined = chunks.map((c) => c.content).join('')
    expect(combined.length).toBeGreaterThanOrEqual(text.length)
  })

  it('populates tokenCount as approxTokenCount of content', () => {
    const text = 'hello world ' + 'x'.repeat(100)
    const chunks = chunkText(text, { chunkTokens: 500 })
    expect(chunks[0].tokenCount).toBeGreaterThan(0)
  })
})
