// Provider-independent AI interface. Edge Functions only talk to this; swapping
// providers means adding one adapter file and changing the AI_PROVIDER setting.

export const EMBEDDING_DIMENSIONS = 1024

export type EmbeddingPurpose = 'document' | 'query'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface Generation {
  text: string
  inputTokens: number | null
  outputTokens: number | null
}

export interface GenerateOptions {
  /** Upper bound on answer length, to keep slow local models within the request time limit. */
  maxTokens?: number
}

export interface AiProvider {
  readonly name: string
  readonly chatModel: string
  readonly embeddingModel: string
  /** Minimum cosine similarity for a passage to count as relevant to a question. */
  readonly minSimilarity: number
  embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]>
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<Generation>
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiProviderError'
  }
}
