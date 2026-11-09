import { describe, expect, it, vi } from 'vitest'
import { createOllamaProvider } from './ollama'
import { AiProviderError, EMBEDDING_DIMENSIONS } from './types'

const vector = (seed: number) => new Array(EMBEDDING_DIMENSIONS).fill(seed)
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const options = { baseUrl: 'http://ollama:11434/', chatModel: 'qwen2.5:3b', embeddingModel: 'mxbai-embed-large' }

describe('Ollama adapter', () => {
  it('embeds documents as-is and prefixes questions for mxbai', async () => {
    const fetchImpl = vi.fn(async () => reply({ embeddings: [vector(1)] }))
    const provider = createOllamaProvider({ ...options, fetchImpl })
    await provider.embed(['passage'], 'document')
    await provider.embed(['question?'], 'query')
    const bodies = fetchImpl.mock.calls.map((call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string))
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('http://ollama:11434/api/embed')
    expect(bodies[0]).toEqual({ model: 'mxbai-embed-large', input: ['passage'] })
    expect(bodies[1].input[0]).toMatch(/^Represent this sentence for searching relevant passages: question\?$/)
  })

  it('returns the answer and token counts without streaming', async () => {
    const fetchImpl = vi.fn(async () => reply({ message: { content: ' Answer [1] ' }, prompt_eval_count: 800, eval_count: 30 }))
    const provider = createOllamaProvider({ ...options, fetchImpl })
    expect(await provider.generate([{ role: 'user', content: 'q' }])).toEqual({ text: 'Answer [1]', inputTokens: 800, outputTokens: 30 })
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body).toMatchObject({ model: 'qwen2.5:3b', stream: false })
  })

  it('reports missing models, wrong embedding sizes and outages as friendly errors', async () => {
    const missing = createOllamaProvider({ ...options, fetchImpl: vi.fn(async () => reply({ error: 'model not found' }, 404)) })
    await expect(missing.generate([])).rejects.toThrow('model not installed')
    const wrongSize = createOllamaProvider({ ...options, fetchImpl: vi.fn(async () => reply({ embeddings: [[1, 2]] })) })
    await expect(wrongSize.embed(['a'], 'document')).rejects.toThrow('unexpected embeddings')
    const down = createOllamaProvider({ ...options, fetchImpl: vi.fn(async () => { throw new Error('ECONNREFUSED') }) })
    await expect(down.embed(['a'], 'document')).rejects.toBeInstanceOf(AiProviderError)
  })

  it('caps answer length when asked and reports timeouts separately', async () => {
    const fetchImpl = vi.fn(async () => reply({ message: { content: 'ok' } }))
    await createOllamaProvider({ ...options, fetchImpl }).generate([], { maxTokens: 400 })
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.options).toEqual({ temperature: 0.1, num_predict: 400 })
    const slow = createOllamaProvider({ ...options, fetchImpl: vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError') }) })
    await expect(slow.generate([])).rejects.toThrow('took too long')
  })
})

