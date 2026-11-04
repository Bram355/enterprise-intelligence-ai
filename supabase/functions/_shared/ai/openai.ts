// OpenAI adapter (recommended provider). Only used when AI_PROVIDER=openai and an
// OPENAI_API_KEY secret is set. Not yet exercised against the live API.
import { AiProviderError, EMBEDDING_DIMENSIONS, type AiProvider, type Generation } from './types.ts'

interface OpenAiOptions {
  apiKey: string
  chatModel: string
  embeddingModel: string
  minSimilarity?: number
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export function createOpenAiProvider(options: OpenAiOptions): AiProvider {
  const { apiKey, chatModel, embeddingModel, baseUrl = 'https://api.openai.com/v1', timeoutMs = 30_000 } = options
  const doFetch = options.fetchImpl ?? fetch

  async function post<T>(path: string, body: unknown): Promise<T> {
    let response: Response
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new AiProviderError('The AI service could not be reached.')
    }
    if (!response.ok) {
      const reason = response.status === 429 ? 'rate limit or quota reached' : `status ${response.status}`
      throw new AiProviderError(`The AI service rejected the request (${reason}).`)
    }
    return (await response.json()) as T
  }

  return {
    name: 'openai',
    chatModel,
    embeddingModel,
    minSimilarity: options.minSimilarity ?? 0.25,
    async embed(texts) {
      if (texts.length === 0) return []
      const result = await post<{ data: { index: number; embedding: number[] }[] }>('/embeddings', {
        model: embeddingModel,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS,
      })
      const vectors = [...result.data].sort((a, b) => a.index - b.index).map((d) => d.embedding)
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
        throw new AiProviderError('The AI service returned unexpected embeddings.')
      }
      return vectors
    },
    async generate(messages): Promise<Generation> {
      const result = await post<{
        choices: { message: { content: string | null } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }>('/chat/completions', { model: chatModel, messages })
      const text = result.choices?.[0]?.message?.content
      if (!text) throw new AiProviderError('The AI service returned an empty answer.')
      return { text, inputTokens: result.usage?.prompt_tokens ?? null, outputTokens: result.usage?.completion_tokens ?? null }
    },
  }
}
