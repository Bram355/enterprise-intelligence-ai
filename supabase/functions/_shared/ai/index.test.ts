import { describe, expect, it } from 'vitest'
import { getProvider } from './index'

const env = (values: Record<string, string>) => (name: string) => values[name]

describe('getProvider', () => {
  it('defaults to the free mock provider', () => {
    expect(getProvider(env({})).name).toBe('mock')
  })

  it('needs an API key before using OpenAI', () => {
    expect(() => getProvider(env({ AI_PROVIDER: 'openai' }))).toThrow('not configured')
    const provider = getProvider(env({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k', AI_MIN_SIMILARITY: '0.3' }))
    expect(provider.name).toBe('openai')
    expect(provider.embeddingModel).toBe('text-embedding-3-small')
    expect(provider.minSimilarity).toBe(0.3)
  })

  it('uses free self-hosted Ollama models when selected', () => {
    const provider = getProvider(env({ AI_PROVIDER: 'ollama' }))
    expect(provider.name).toBe('ollama')
    expect(provider.embeddingModel).toBe('mxbai-embed-large')
    expect(getProvider(env({ AI_PROVIDER: 'ollama', AI_CHAT_MODEL: 'llama3.2:3b' })).chatModel).toBe('llama3.2:3b')
  })

  it('rejects unknown providers', () => {
    expect(() => getProvider(env({ AI_PROVIDER: 'other' }))).toThrow('Unknown AI provider')
  })
})
