import { requireSupabase } from '../lib/supabase'
import { functionErrorMessage } from './errors'

export const MAX_QUESTION_CHARS = 1000

export interface Citation {
  n: number
  documentId: string
  title: string
  version: number
  page: number | null
  excerpt: string
}

export interface AskResult {
  queryId: string | null
  status: 'answered' | 'no_answer'
  answer: string
  citations: Citation[]
  sourcesConsidered: number
  provider: string
  model: string
}

export async function askQuestion(question: string): Promise<{ ok: true; value: AskResult } | { ok: false; error: string }> {
  const { data, error } = await requireSupabase().functions.invoke<AskResult>('ask-question', { body: { question } })
  if (error || !data) return { ok: false, error: await functionErrorMessage(error) }
  return { ok: true, value: data }
}

/** Splits an answer into text and [n] citation markers so they can be rendered safely as React nodes. */
export function answerParts(answer: string): { text: string; cite?: number }[] {
  const parts: { text: string; cite?: number }[] = []
  let last = 0
  for (const match of answer.matchAll(/\[(\d{1,3})\]/g)) {
    if (match.index > last) parts.push({ text: answer.slice(last, match.index) })
    parts.push({ text: match[0], cite: Number(match[1]) })
    last = match.index + match[0].length
  }
  if (last < answer.length) parts.push({ text: answer.slice(last) })
  return parts
}
