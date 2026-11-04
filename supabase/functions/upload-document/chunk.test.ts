import { describe, expect, it } from 'vitest'
import { chunkSegments, normaliseText } from './chunk'

describe('normaliseText', () => {
  it('tidies whitespace and control characters', () => {
    expect(normaliseText('  a\t\tb\r\n\r\n\r\n\r\nc\u0007  ')).toBe('a b\n\nc')
  })
})

describe('chunkSegments', () => {
  it('keeps short text as one chunk', () => {
    expect(chunkSegments([{ page: null, text: 'Hello world.' }])).toEqual([{ index: 0, page: null, content: 'Hello world.' }])
  })

  it('returns no chunks for empty text', () => {
    expect(chunkSegments([{ page: 1, text: '  \n ' }])).toEqual([])
  })

  it('splits long text into bounded, overlapping chunks without losing words', () => {
    const paragraphs = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} explains step ${i} of the payment process in detail.`)
    const chunks = chunkSegments([{ page: null, text: paragraphs.join('\n\n') }], { maxChars: 300, overlapChars: 60 })
    expect(chunks.length).toBeGreaterThan(5)
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(300)
    const all = chunks.map((c) => c.content).join(' ')
    for (let i = 0; i < 30; i++) expect(all).toContain(`Paragraph ${i} explains`)
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i))
  })

  it('splits a single huge paragraph', () => {
    const chunks = chunkSegments([{ page: null, text: 'word '.repeat(2000) }], { maxChars: 500, overlapChars: 50 })
    expect(chunks.length).toBeGreaterThan(15)
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(500)
  })

  it('never mixes pages, so chunks can be cited by page', () => {
    const chunks = chunkSegments([
      { page: 1, text: 'First page text.' },
      { page: 2, text: 'Second page text.' },
    ])
    expect(chunks).toEqual([
      { index: 0, page: 1, content: 'First page text.' },
      { index: 1, page: 2, content: 'Second page text.' },
    ])
  })
})
