// Ollama adapter: free, self-hosted models, so documents never leave your own hardware.
// Used when AI_PROVIDER=ollama. Needs a 1024-dimension embedding model (default mxbai-embed-large).
import { AiProviderError, EMBEDDING_DIMENSIONS, type AiProvider, type Generation } from './types.ts'

interface OllamaOptions {
  baseUrl: string
  chatModel: string
  embeddingModel: string
  minSimilarity?: number
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

// mxbai-embed-large is trained to match questions to passages when questions carry this prefix.
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: '

export function createOllamaProvider(options: OllamaOptions): AiProvider {
  const { chatModel, embeddingModel, timeoutMs = 180_000 } = options
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetchImpl ?? fetch

  async function post<T>(path: string, body: unknown): Promise<T> {
    let response: Response
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new AiProviderError('The AI service could not be reached.')
    }
    if (!response.ok) {
      const reason = response.status === 404 ? 'model not installed' : `status ${response.status}`
      throw new AiProviderError(`The AI service rejected the request (${reason}).`)
    }
    return (await response.json()) as T
  }

  return {
    name: 'ollama',
    chatModel,
    embeddingModel,
    minSimilarity: options.minSimilarity ?? 0.5,
    async embed(texts, purpose) {
      if (texts.length === 0) return []
      const input = purpose === 'query' && embeddingModel.startsWith('mxbai') ? texts.map((t) => QUERY_PREFIX + t) : texts
      const result = await post<{ embeddings?: number[][] }>('/api/embed', { model: embeddingModel, input })
      const vectors = result.embeddings ?? []
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
        throw new AiProviderError('The AI service returned unexpected embeddings.')
      }
      return vectors
    },
    async generate(messages): Promise<Generation> {
      const result = await post<{ message?: { content?: string }; prompt_eval_count?: number; eval_count?: number }>('/api/chat', {
        model: chatModel,
        messages,
        stream: false,
        options: { temperature: 0.1 },
      })
      const text = result.message?.content?.trim()
      if (!text) throw new AiProviderError('The AI service returned an empty answer.')
      return { text, inputTokens: result.prompt_eval_count ?? null, outputTokens: result.eval_count ?? null }
    },
  }
}
