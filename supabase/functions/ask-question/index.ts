// Answers a question from documents the caller is allowed to read, with citations.
// Retrieval runs as the caller (RLS), so restricted passages never reach the AI.
import { createClient } from '@supabase/supabase-js'
import { getProvider, type AiProvider } from '../_shared/ai/index.ts'
import { buildSearchQuery, MAX_EARLIER_QUESTIONS } from '../_shared/ai/conversation.ts'
import { bestSection, buildMessages, isClarification, isNoAnswer, NO_ANSWER, parseCitations, isExtractionAttempt, REFUSAL, type Source, vagueQuestionReply } from '../_shared/ai/prompt.ts'
import { corsHeaders, json } from '../_shared/cors.ts'

const MAX_QUESTIONS_PER_HOUR = 60
const MAX_SOURCES = 6
const MAX_QUESTION_CHARS = 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface MatchRow {
  chunk_id: number
  document_id: string
  title: string
  version: number
  page: number | null
  content: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return json(500, { error: 'Server is not configured' })

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not signed in' })

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json(401, { error: 'Not signed in' })
  const callerId = userData.user.id

  const { data: caller } = await admin.from('profiles').select('organisation_id, is_active').eq('id', callerId).maybeSingle()
  if (!caller?.is_active) return json(403, { error: 'Your account is not active' })

  let question: string
  let conversationId: string | null
  try {
    const body = await req.json()
    question = typeof body?.question === 'string' ? body.question.trim() : ''
    conversationId = typeof body?.conversationId === 'string' ? body.conversationId : null
  } catch {
    return json(400, { error: 'Send a JSON body with a question' })
  }
  if (conversationId !== null && !UUID.test(conversationId)) return json(400, { error: 'Invalid conversation' })
  if (question.length < 3) return json(400, { error: 'Type a question of at least 3 characters' })
  if (question.length > MAX_QUESTION_CHARS) return json(400, { error: `Questions can be up to ${MAX_QUESTION_CHARS} characters` })

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('ai_queries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', callerId)
    .gte('created_at', hourAgo)
  if ((count ?? 0) >= MAX_QUESTIONS_PER_HOUR) return json(429, { error: 'You have asked a lot of questions this hour. Please try again later.' })

  let provider: AiProvider
  try {
    provider = getProvider()
  } catch {
    return json(503, { error: 'The AI service is not configured yet' })
  }

  // Follow-ups continue the caller's own conversation; a first question starts a new one.
  let earlier: string[] = []
  if (conversationId) {
    const { data: conversation } = await admin
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', callerId)
      .maybeSingle()
    if (!conversation) return json(404, { error: 'Conversation not found' })
    const { data: previous } = await admin
      .from('ai_queries')
      .select('question')
      .eq('conversation_id', conversationId)
      .neq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(MAX_EARLIER_QUESTIONS)
    earlier = (previous ?? []).map((p) => p.question).reverse()
  } else {
    const { data: created, error: createError } = await admin
      .from('conversations')
      .insert({ organisation_id: caller.organisation_id, user_id: callerId, title: question.slice(0, 80) })
      .select('id')
      .single()
    if (createError || !created) return json(500, { error: 'Could not start a conversation' })
    conversationId = created.id
  }

  const started = Date.now()
  const log = (entry: Record<string, unknown>) =>
    admin
      .from('ai_queries')
      .insert({
        organisation_id: caller.organisation_id,
        user_id: callerId,
        question,
        conversation_id: conversationId,
        provider: provider.name,
        model: provider.chatModel,
        latency_ms: Date.now() - started,
        ...entry,
      })
      .select('id')
      .single()

  const touchConversation = () => admin.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

  if (isExtractionAttempt(question)) {
    const { data: logged } = await log({ status: 'no_answer', answer: REFUSAL, citations: [], chunk_ids: [], error: 'refused: extraction attempt' })
    await touchConversation()
    return json(200, {
      queryId: logged?.id ?? null,
      conversationId,
      status: 'no_answer',
      answer: REFUSAL,
      citations: [],
      sourcesConsidered: 0,
      provider: provider.name,
      model: provider.chatModel,
    })
  }

  const vague = vagueQuestionReply(question, earlier)
  if (vague) {
    const { data: logged } = await log({ status: 'needs_clarification', answer: vague, citations: [], chunk_ids: [] })
    await touchConversation()
    return json(200, {
      queryId: logged?.id ?? null,
      conversationId,
      status: 'needs_clarification',
      answer: vague,
      citations: [],
      sourcesConsidered: 0,
      provider: provider.name,
      model: provider.chatModel,
    })
  }

  try {
    const searchQuery = await buildSearchQuery(provider, earlier, question)
    const [queryEmbedding] = await provider.embed([searchQuery], 'query')
    const asCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: matches, error: matchError } = await asCaller.rpc('match_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      query_text: searchQuery,
      match_count: MAX_SOURCES,
      min_similarity: provider.minSimilarity,
    })
    if (matchError) throw new Error('Search failed')

    const sources: Source[] = ((matches ?? []) as MatchRow[]).map((m, i) => ({
      n: i + 1,
      chunkId: m.chunk_id,
      documentId: m.document_id,
      title: m.title,
      version: m.version,
      page: m.page,
      content: m.content,
    }))

    let answer = NO_ANSWER
    let cited: Source[] = []
    let usage = { inputTokens: null as number | null, outputTokens: null as number | null }
    if (sources.length > 0) {
      const generation = await provider.generate(buildMessages(question, sources, earlier))
      usage = { inputTokens: generation.inputTokens, outputTokens: generation.outputTokens }
      ;({ answer, cited } = parseCitations(generation.text, sources))
    }
    const status = isNoAnswer(answer) ? 'no_answer' : isClarification(answer) && cited.length === 0 ? 'needs_clarification' : 'answered'
    if (status === 'no_answer') {
      cited = []
      answer = NO_ANSWER
    }

    const citations = cited.map((s) => ({
      n: s.n,
      documentId: s.documentId,
      title: s.title,
      version: s.version,
      page: s.page,
      section: bestSection(s.content, answer),
      excerpt: s.content.length > 400 ? `${s.content.slice(0, 400)}…` : s.content,
    }))
    const { data: logged } = await log({
      status,
      answer,
      citations: citations.map(({ excerpt: _excerpt, ...c }) => c),
      chunk_ids: sources.map((s) => s.chunkId),
      search_query: searchQuery === question ? null : searchQuery.slice(0, 1000),
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    })

    await touchConversation()

    return json(200, {
      queryId: logged?.id ?? null,
      conversationId,
      status,
      answer,
      citations,
      sourcesConsidered: sources.length,
      provider: provider.name,
      model: provider.chatModel,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    await log({ status: 'failed', error: message })
    return json(502, { error: 'The assistant could not answer right now. Please try again.' })
  }
})
