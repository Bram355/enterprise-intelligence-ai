// Answers a question from documents the caller is allowed to read, with citations.
// Retrieval runs as the caller (RLS), so restricted passages never reach the AI.
import { createClient } from '@supabase/supabase-js'
import { getProvider, type AiProvider } from '../_shared/ai/index.ts'
import { buildMessages, isNoAnswer, NO_ANSWER, parseCitations, type Source } from '../_shared/ai/prompt.ts'
import { corsHeaders, json } from '../_shared/cors.ts'

const MAX_QUESTIONS_PER_HOUR = 60
const MAX_SOURCES = 6
const MAX_QUESTION_CHARS = 1000

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
  try {
    const body = await req.json()
    question = typeof body?.question === 'string' ? body.question.trim() : ''
  } catch {
    return json(400, { error: 'Send a JSON body with a question' })
  }
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

  const started = Date.now()
  const log = (entry: Record<string, unknown>) =>
    admin
      .from('ai_queries')
      .insert({
        organisation_id: caller.organisation_id,
        user_id: callerId,
        question,
        provider: provider.name,
        model: provider.chatModel,
        latency_ms: Date.now() - started,
        ...entry,
      })
      .select('id')
      .single()

  try {
    const [queryEmbedding] = await provider.embed([question], 'query')
    const asCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: matches, error: matchError } = await asCaller.rpc('match_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      query_text: question,
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
      const generation = await provider.generate(buildMessages(question, sources))
      usage = { inputTokens: generation.inputTokens, outputTokens: generation.outputTokens }
      ;({ answer, cited } = parseCitations(generation.text, sources))
    }
    const status = isNoAnswer(answer) ? 'no_answer' : 'answered'
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
      excerpt: s.content.length > 400 ? `${s.content.slice(0, 400)}…` : s.content,
    }))
    const { data: logged } = await log({
      status,
      answer,
      citations: citations.map(({ excerpt: _excerpt, ...c }) => c),
      chunk_ids: sources.map((s) => s.chunkId),
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    })

    return json(200, {
      queryId: logged?.id ?? null,
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
