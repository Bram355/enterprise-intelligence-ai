// Turns a follow-up ("what about bank transfers?") into a standalone search query,
// so retrieval finds the right passages without the earlier messages.
import type { AiProvider } from './types.ts'

const REWRITE_PROMPT = `You rewrite a follow-up question into one standalone search question.
Use the earlier questions only to fill in what the follow-up refers to.
Reply with the rewritten question only: no explanation, no quotes, no answer.`

export const MAX_EARLIER_QUESTIONS = 3

export async function buildSearchQuery(provider: AiProvider, earlier: string[], question: string): Promise<string> {
  const context = earlier.slice(-MAX_EARLIER_QUESTIONS)
  if (context.length === 0) return question
  const fallback = `${context[context.length - 1]} ${question}`
  if (provider.name === 'mock') return fallback
  try {
    const { text } = await provider.generate([
      { role: 'system', content: REWRITE_PROMPT },
      { role: 'user', content: `Earlier questions:\n${context.map((q) => `- ${q}`).join('\n')}\n\nFollow-up: ${question}` },
    ])
    const rewritten = text.split('\n').map((l) => l.trim()).find(Boolean)?.replace(/^["'“]|["'”]$/g, '') ?? ''
    return rewritten.length >= 3 && rewritten.length <= 300 ? rewritten : fallback
  } catch {
    return fallback
  }
}
