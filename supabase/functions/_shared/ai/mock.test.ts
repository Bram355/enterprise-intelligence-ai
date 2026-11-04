import { describe, expect, it } from 'vitest'
import { createMockProvider, mockAnswer, mockEmbedding, tokenize } from './mock'
import { buildMessages, NO_ANSWER, type Source } from './prompt'
import { EMBEDDING_DIMENSIONS } from './types'

const cosine = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0)
const source = (n: number, content: string): Source => ({ n, chunkId: n, documentId: `d${n}`, title: `Doc ${n}`, version: 1, page: null, content })

describe('mock embeddings', () => {
  it('are deterministic, normalised and the right size', () => {
    const a = mockEmbedding('Webhook signature failures')
    expect(a).toHaveLength(EMBEDDING_DIMENSIONS)
    expect(mockEmbedding('Webhook signature failures')).toEqual(a)
    expect(Math.hypot(...a)).toBeCloseTo(1, 6)
    expect(Math.hypot(...mockEmbedding('the and of'))).toBeCloseTo(1, 6)
  })

  it('place related text closer than unrelated text', () => {
    const query = mockEmbedding('Why do webhook signatures fail?')
    const related = mockEmbedding('Webhook signature failure: check the signing secret and the clock.')
    const unrelated = mockEmbedding('Hotel expenses must be approved by a line manager.')
    expect(cosine(query, related)).toBeGreaterThan(cosine(query, unrelated))
  })

  it('tokenises with simple stemming and stop words', () => {
    expect(tokenize('The refunds are processing')).toEqual(['refund', 'process'])
  })
})

describe('mock answers', () => {
  it('quote the best matching sentences with citations', () => {
    const messages = buildMessages('How long do refunds take?', [
      source(1, 'Customers can request a refund within 45 days. Refunds take five working days to process.'),
      source(2, 'Hotel expenses need approval.'),
    ])
    const answer = mockAnswer(messages)
    expect(answer).toContain('[1]')
    expect(answer).not.toContain('[2]')
  })

  it('skip headings and quote the matching steps instead', () => {
    const doc = '# Store Opening Procedure (SAMPLE)\n\n## Morning steps\n1. Open the store shutters at 07:45 and disable the alarm.\n2. Count the till float before opening.'
    const answer = mockAnswer(buildMessages('What are the steps to open a store in the morning?', [source(1, doc)]))
    expect(answer).not.toContain('#')
    expect(answer).toContain('Open the store shutters at 07:45 and disable the alarm. [1]')
  })

  it('say so when nothing matches', () => {
    expect(mockAnswer(buildMessages('Office parking rules?', [source(1, 'Refunds take five working days to process.')]))).toBe(NO_ANSWER)
  })

  it('implement the provider interface', async () => {
    const provider = createMockProvider()
    const [vector] = await provider.embed(['hello world'], 'query')
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS)
    const result = await provider.generate(buildMessages('hello world?', [source(1, 'Hello world is a classic first program.')]))
    expect(result.text).toContain('[1]')
  })
})
