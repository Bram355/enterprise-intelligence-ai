import { requireSupabase } from '../lib/supabase'
import { functionErrorMessage } from './errors'

export const MAX_QUESTION_CHARS = 1000

export type AnswerStatus = 'answered' | 'no_answer' | 'needs_clarification' | 'failed'
export type FeedbackRating = 'helpful' | 'not_helpful'

export interface Citation {
  n: number
  documentId: string
  title: string
  version: number
  page: number | null
  section?: string | null
  /** Only present on fresh answers; history keeps references, not document text. */
  excerpt?: string
}

export interface AskResult {
  queryId: string | null
  conversationId: string
  status: Exclude<AnswerStatus, 'failed'>
  answer: string
  citations: Citation[]
  sourcesConsidered: number
  provider: string
  model: string
}

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
}

export interface Message {
  id: string
  question: string
  answer: string | null
  status: AnswerStatus
  citations: Citation[]
  provider: string
  model: string
  sourcesConsidered?: number
  feedback: { rating: FeedbackRating; comment: string | null } | null
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export async function askQuestion(question: string, conversationId?: string | null): Promise<Result<AskResult>> {
  const body = conversationId ? { question, conversationId } : { question }
  const { data, error } = await requireSupabase().functions.invoke<AskResult>('ask-question', { body })
  if (error || !data) return { ok: false, error: await functionErrorMessage(error) }
  return { ok: true, value: data }
}

export async function listConversations(): Promise<Result<ConversationSummary[]>> {
  const { data, error } = await requireSupabase()
    .from('conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) return { ok: false, error: 'Could not load your conversations.' }
  return { ok: true, value: data.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at })) }
}

export async function getConversationMessages(conversationId: string): Promise<Result<Message[]>> {
  const { data, error } = await requireSupabase()
    .from('ai_queries')
    .select('id, question, answer, status, citations, provider, model, answer_feedback(rating, comment)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) return { ok: false, error: 'Could not load this conversation.' }
  return {
    ok: true,
    value: data.map((row) => {
      const feedback = Array.isArray(row.answer_feedback) ? row.answer_feedback[0] : row.answer_feedback
      return {
        id: row.id,
        question: row.question,
        answer: row.answer,
        status: row.status,
        citations: Array.isArray(row.citations) ? (row.citations as unknown as Citation[]) : [],
        provider: row.provider,
        model: row.model,
        feedback: feedback ? { rating: feedback.rating, comment: feedback.comment } : null,
      }
    }),
  }
}

export async function deleteConversation(conversationId: string): Promise<Result<null>> {
  const { error } = await requireSupabase().from('conversations').delete().eq('id', conversationId)
  if (error) return { ok: false, error: 'Could not delete the conversation.' }
  return { ok: true, value: null }
}

export async function submitFeedback(queryId: string, rating: FeedbackRating, comment?: string): Promise<Result<null>> {
  const supabase = requireSupabase()
  const values = { rating, comment: comment?.trim() || null }
  const { error } = await supabase.from('answer_feedback').insert({ query_id: queryId, ...values })
  if (!error) return { ok: true, value: null }
  if (error.code !== '23505') return { ok: false, error: 'Could not save your feedback.' }
  const { error: updateError } = await supabase
    .from('answer_feedback')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('query_id', queryId)
  if (updateError) return { ok: false, error: 'Could not save your feedback.' }
  return { ok: true, value: null }
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
