// Free, offline stand-in for a real AI provider, used until one is approved.
// Embeddings: hashed bag of words (similar wording => similar vectors).
// Answers: extractive - quotes the best-matching source sentences with citations.
import { NO_ANSWER } from './prompt.ts'
import { EMBEDDING_DIMENSIONS, type AiProvider, type ChatMessage, type Generation } from './types.ts'

const STOP_WORDS = new Set(
  'a an and are as at be but by can do does for from has have how i if in is it its me my of on or our should so than that the their then there these this to us was we what when where which who why will with you your'.split(' '),
)

export function tokenize(text: string): string[] {
  const words = text.toLowerCase().normalize('NFKD').match(/[a-z0-9]+/g) ?? []
  return words
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ing|ed)$/, '').replace(/(?<!s)s$/, '') : w))
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

export function mockEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
  const tokens = tokenize(text)
  const features = [...tokens, ...tokens.slice(1).map((t, i) => `${tokens[i]}_${t}`)]
  for (const feature of features) {
    const hash = fnv1a(feature)
    vector[hash % EMBEDDING_DIMENSIONS] += hash & 0x80000000 ? -1 : 1
  }
  const norm = Math.hypot(...vector)
  if (norm === 0) {
    vector[0] = 1
    return vector
  }
  return vector.map((v) => v / norm)
}

function parsePrompt(messages: ChatMessage[]): { question: string; sources: { n: number; text: string }[] } {
  const user = messages.findLast((m) => m.role === 'user')?.content ?? ''
  const question = user.match(/<question>\n([\s\S]*?)\n<\/question>/)?.[1] ?? ''
  const sources = [...user.matchAll(/<source id="(\d+)"[^>]*>\n([\s\S]*?)\n<\/source>/g)].map((m) => ({ n: Number(m[1]), text: m[2] }))
  return { question, sources }
}

export function mockAnswer(messages: ChatMessage[]): string {
  const { question, sources } = parsePrompt(messages)
  const wanted = [...new Set(tokenize(question))]
  // Loose match so "fail" finds "failure" and "nightly" finds "night".
  const matches = (word: string, want: string) =>
    word === want || (Math.min(word.length, want.length) >= 4 && (word.startsWith(want) || want.startsWith(word)))
  const scored = sources.flatMap((source) =>
    source.text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20)
      .map((sentence) => {
        const words = tokenize(sentence)
        return { n: source.n, sentence, score: wanted.filter((w) => words.some((t) => matches(t, w))).length }
      }),
  )
  // Require two matching words for multi-word questions, so a single shared word isn't treated as an answer.
  const minScore = wanted.length > 1 ? 2 : 1
  const best = scored.filter((s) => s.score >= minScore).sort((a, b) => b.score - a.score || a.n - b.n).slice(0, 3)
  if (best.length === 0) return NO_ANSWER
  return best.map((b) => `${b.sentence} [${b.n}]`).join('\n\n')
}

export function createMockProvider(): AiProvider {
  return {
    name: 'mock',
    chatModel: 'mock-extractive',
    embeddingModel: 'mock-hash-1024',
    minSimilarity: 0.05,
    async embed(texts) {
      return texts.map(mockEmbedding)
    },
    async generate(messages): Promise<Generation> {
      return { text: mockAnswer(messages), inputTokens: null, outputTokens: null }
    },
  }
}
