import { describe, expect, it, vi } from 'vitest'
import { createOpenAiProvider } from './openai'
import { AiProviderError, EMBEDDING_DIMENSIONS } from './types'

const vector = (seed: number) => new Array(EMBEDDING_DIMENSIONS).fill(seed)
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('OpenAI adapter', () => {
  it('requests 1024-dimension embeddings and keeps input order', async () => {
    const fetchImpl = vi.fn(async () => reply({ data: [{ index: 1, embedding: vector(2) }, { index: 0, embedding: vector(1) }] }))
    const provider = createOpenAiProvider({ apiKey: 'test-key', chatModel: 'chat-x', embeddingModel: 'embed-x', fetchImpl })
    const result = await provider.embed(['a', 'b'], 'document')
    expect(result.map((v) => v[0])).toEqual([1, 2])
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/embeddings')
    expect(JSON.parse(init.body as string)).toEqual({ model: 'embed-x', input: ['a', 'b'], dimensions: EMBEDDING_DIMENSIONS })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
  })

  it('returns the answer text and token usage', async () => {
    const fetchImpl = vi.fn(async () => reply({ choices: [{ message: { content: 'Answer [1]' } }], usage: { prompt_tokens: 900, completion_tokens: 40 } }))
    const provider = createOpenAiProvider({ apiKey: 'k', chatModel: 'chat-x', embeddingModel: 'embed-x', fetchImpl })
    expect(await provider.generate([{ role: 'user', content: 'q' }])).toEqual({ text: 'Answer [1]', inputTokens: 900, outputTokens: 40 })
  })

  it('turns failures into friendly errors without leaking details', async () => {
    const quota = createOpenAiProvider({ apiKey: 'k', chatModel: 'c', embeddingModel: 'e', fetchImpl: vi.fn(async () => reply({ error: 'secret detail' }, 429)) })
    await expect(quota.embed(['a'], 'query')).rejects.toThrow('rate limit or quota reached')
    const down = createOpenAiProvider({ apiKey: 'k', chatModel: 'c', embeddingModel: 'e', fetchImpl: vi.fn(async () => { throw new Error('ECONNREFUSED') }) })
    await expect(down.generate([])).rejects.toBeInstanceOf(AiProviderError)
    const wrongSize = createOpenAiProvider({ apiKey: 'k', chatModel: 'c', embeddingModel: 'e', fetchImpl: vi.fn(async () => reply({ data: [{ index: 0, embedding: [1, 2] }] })) })
    await expect(wrongSize.embed(['a'], 'query')).rejects.toThrow('unexpected embeddings')
  })
})
