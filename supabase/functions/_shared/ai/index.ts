import { createMockProvider } from './mock.ts'
import { createOllamaProvider } from './ollama.ts'
import { createOpenAiProvider } from './openai.ts'
import { AiProviderError, type AiProvider } from './types.ts'

export type { AiProvider } from './types.ts'
export { AiProviderError } from './types.ts'

type EnvReader = (name: string) => string | undefined

/** Chooses the provider from server-side settings. Defaults to the free mock. */
export function getProvider(env: EnvReader = (name) => Deno.env.get(name)): AiProvider {
  const provider = (env('AI_PROVIDER') ?? 'mock').trim().toLowerCase()
  const minSimilarity = env('AI_MIN_SIMILARITY') ? Number(env('AI_MIN_SIMILARITY')) : undefined
  switch (provider) {
    case 'mock':
      return createMockProvider()
    case 'openai': {
      const apiKey = env('OPENAI_API_KEY')
      if (!apiKey) throw new AiProviderError('The AI provider is not configured.')
      return createOpenAiProvider({
        apiKey,
        chatModel: env('AI_CHAT_MODEL') ?? 'gpt-5.6-luna',
        embeddingModel: env('AI_EMBEDDING_MODEL') ?? 'text-embedding-3-small',
        minSimilarity: Number.isFinite(minSimilarity) ? minSimilarity : undefined,
      })
    }
    case 'ollama':
      return createOllamaProvider({
        baseUrl: env('OLLAMA_URL') ?? 'http://host.docker.internal:11434',
        chatModel: env('AI_CHAT_MODEL') ?? 'qwen2.5:7b',
        embeddingModel: env('AI_EMBEDDING_MODEL') ?? 'mxbai-embed-large',
        minSimilarity: Number.isFinite(minSimilarity) ? minSimilarity : undefined,
      })
    default:
      throw new AiProviderError(`Unknown AI provider "${provider}".`)
  }
}
