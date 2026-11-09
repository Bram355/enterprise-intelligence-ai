// Diagnoses a technical problem from documents the caller may read and saves it as a support case.
// Retrieval runs as the caller (RLS); every cause and step must cite a permitted source.
import { createClient } from '@supabase/supabase-js'
import { getProvider, type AiProvider } from '../_shared/ai/index.ts'
import { bestSection, isExtractionAttempt, type Source } from '../_shared/ai/prompt.ts'
import {
  buildSupportMessages,
  escalationFromSources,
  parseDiagnosis,
  SUPPORT_CATEGORIES,
  supportSearchQuery,
  type SupportCategory,
  type SupportRequest,
} from '../_shared/ai/support.ts'
import { corsHeaders, json } from '../_shared/cors.ts'

const MAX_QUESTIONS_PER_HOUR = 60
// Fewer passages than the assistant keeps the longer structured prompt fast on CPU-only machines.
const MAX_SOURCES = 4
const ERROR_CODE = /^[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,39}$/

interface MatchRow {
  chunk_id: number
  document_id: string
  title: string
  version: number
  page: number | null
  content: string
}

function readRequest(body: unknown): SupportRequest | string {
  const b = (body ?? {}) as Record<string, unknown>
  const category = typeof b.category === 'string' && b.category in SUPPORT_CATEGORIES ? (b.category as SupportCategory) : null
  if (!category) return 'Choose a category'
  const problem = typeof b.problem === 'string' ? b.problem.trim() : ''
  if (problem.length < 10) return 'Describe the problem in at least 10 characters'
  if (problem.length > 2000) return 'The description can be up to 2000 characters'
  const errorCode = typeof b.errorCode === 'string' && b.errorCode.trim() ? b.errorCode.trim() : null
  if (errorCode && !ERROR_CODE.test(errorCode)) return 'Error codes can only contain letters, numbers and - . _ : /'
  const environment = b.environment === 'sandbox' || b.environment === 'live' ? b.environment : 'unknown'
  return { category, problem, errorCode, environment }
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

  let request: SupportRequest | string
  try {
    request = readRequest(await req.json())
  } catch {
    return json(400, { error: 'Send a JSON body describing the problem' })
  }
  if (typeof request === 'string') return json(400, { error: request })
  if (isExtractionAttempt(request.problem)) {
    return json(400, { error: 'Describe a technical problem. Requests to change the assistant\'s rules or reveal documents are not allowed.' })
  }

  // Troubleshooting shares the assistant's hourly question limit.
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
  const searchQuery = supportSearchQuery(request)
  const log = (entry: Record<string, unknown>) =>
    admin
      .from('ai_queries')
      .insert({
        organisation_id: caller.organisation_id,
        user_id: callerId,
        question: request.problem.slice(0, 1000),
        search_query: searchQuery,
        provider: provider.name,
        model: provider.chatModel,
        latency_ms: Date.now() - started,
        ...entry,
      })
      .select('id')
      .single()

  try {
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

    let diagnosis = parseDiagnosis('', sources)
    let usage = { inputTokens: null as number | null, outputTokens: null as number | null }
    if (sources.length > 0) {
      const generation = await provider.generate(buildSupportMessages(request, sources))
      usage = { inputTokens: generation.inputTokens, outputTokens: generation.outputTokens }
      diagnosis = parseDiagnosis(generation.text, sources)
    }
    const diagnosed = diagnosis.steps.length > 0
    const stepCitations = diagnosis.steps.flatMap((s) => s.citations)
    if (diagnosed && !diagnosis.escalation) diagnosis.escalation = escalationFromSources(sources, stepCitations)
    if (!diagnosed) diagnosis = { summary: null, causes: [], steps: [], escalation: null }

    const usedNumbers = new Set([
      ...diagnosis.causes.flatMap((c) => c.citations),
      ...stepCitations,
      ...(diagnosis.escalation?.citations ?? []),
    ])
    const allText = [...diagnosis.causes.map((c) => c.text), ...diagnosis.steps.map((s) => `${s.action} ${s.expected ?? ''}`)].join(' ')
    const citations = sources
      .filter((s) => usedNumbers.has(s.n))
      .map((s) => ({ n: s.n, documentId: s.documentId, title: s.title, version: s.version, page: s.page, section: bestSection(s.content, allText) }))

    const { data: logged } = await log({
      status: diagnosed ? 'answered' : 'no_answer',
      answer: diagnosed ? [diagnosis.summary, ...diagnosis.steps.map((s, i) => `${i + 1}. ${s.action}`)].filter(Boolean).join('\n') : null,
      citations,
      chunk_ids: sources.map((s) => s.chunkId),
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
    })

    const title = (request.errorCode ? `${request.errorCode}: ${request.problem}` : request.problem).replace(/\s+/g, ' ').slice(0, 80)
    const { data: created, error: caseError } = await admin
      .from('support_cases')
      .insert({
        organisation_id: caller.organisation_id,
        user_id: callerId,
        query_id: logged?.id ?? null,
        category: request.category,
        title,
        problem: request.problem,
        error_code: request.errorCode,
        environment: request.environment,
        summary: diagnosis.summary,
        causes: diagnosis.causes,
        escalation: diagnosis.escalation,
        sources: citations,
        provider: provider.name,
        model: provider.chatModel,
      })
      .select('id')
      .single()
    if (caseError || !created) throw new Error('Could not save the case')
    if (diagnosis.steps.length) {
      const { error: stepsError } = await admin.from('support_case_steps').insert(
        diagnosis.steps.map((s, i) => ({ case_id: created.id, position: i + 1, action: s.action, expected: s.expected, citations: s.citations })),
      )
      if (stepsError) throw new Error('Could not save the steps')
    }

    return json(200, { caseId: created.id, status: diagnosed ? 'diagnosed' : 'no_answer' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    await log({ status: 'failed', error: message })
    return json(502, { error: 'The assistant could not diagnose this right now. Please try again.' })
  }
})
