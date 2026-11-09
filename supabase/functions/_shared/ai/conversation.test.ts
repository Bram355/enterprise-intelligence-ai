import { describe, expect, it, vi } from 'vitest'
import { buildSearchQuery } from './conversation'
import { createMockProvider } from './mock'
import type { AiProvider } from './types'

const llm = (generate: AiProvider['generate']): AiProvider => ({
  name: 'llm', chatModel: 'c', embeddingModel: 'e', minSimilarity: 0.5, embed: vi.fn(), generate,
})

describe('buildSearchQuery', () => {
  it('uses the question as-is when there is no earlier conversation', async () => {
    const generate = vi.fn()
    expect(await buildSearchQuery(llm(generate), [], 'How long do refunds take?')).toBe('How long do refunds take?')
    expect(generate).not.toHaveBeenCalled()
  })

  it('combines with the previous question for the mock', async () => {
    expect(await buildSearchQuery(createMockProvider(), ['How do card payments settle?'], 'What about bank transfers?')).toBe(
      'How do card payments settle? What about bank transfers?',
    )
  })

  it('asks the model to rewrite follow-ups, using only the last three questions', async () => {
    const generate = vi.fn(async () => ({ text: '"When do bank transfers settle?"\nextra', inputTokens: 1, outputTokens: 1 }))
    const result = await buildSearchQuery(llm(generate), ['q1', 'q2', 'q3', 'How do card payments settle?'], 'And bank transfers?')
    expect(result).toBe('When do bank transfers settle?')
    const [, user] = generate.mock.calls[0][0]
    expect(user.content).not.toContain('q1')
    expect(user.content).toContain('Follow-up: And bank transfers?')
  })

  it('falls back to combining questions when the model fails or rambles', async () => {
    const failing = llm(vi.fn(async () => { throw new Error('down') }))
    expect(await buildSearchQuery(failing, ['Card settlement?'], 'Bank transfers?')).toBe('Card settlement? Bank transfers?')
    const rambling = llm(vi.fn(async () => ({ text: 'x'.repeat(400), inputTokens: null, outputTokens: null })))
    expect(await buildSearchQuery(rambling, ['Card settlement?'], 'Bank transfers?')).toBe('Card settlement? Bank transfers?')
  })
})
