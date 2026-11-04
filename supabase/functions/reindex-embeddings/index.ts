// Fills in missing or outdated embeddings for the caller's organisation, e.g. after
// switching AI provider or when the AI service was down during an upload.
// Admins and knowledge managers only. Processes one batch per call.
import { createClient } from '@supabase/supabase-js'
import { getProvider, type AiProvider } from '../_shared/ai/index.ts'
import { corsHeaders, json } from '../_shared/cors.ts'

const BATCH = 200
const EMBED_BATCH = 64

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'Server is not configured' })
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not signed in' })

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json(401, { error: 'Not signed in' })
  const { data: caller } = await admin.from('profiles').select('organisation_id, role, is_active').eq('id', userData.user.id).maybeSingle()
  if (!caller?.is_active || !['admin', 'knowledge_manager'].includes(caller.role)) {
    return json(403, { error: 'Only admins and knowledge managers can rebuild the search index' })
  }

  let provider: AiProvider
  try {
    provider = getProvider()
  } catch {
    return json(503, { error: 'The AI service is not configured yet' })
  }

  const stale = `embedding.is.null,embedding_model.neq.${provider.embeddingModel}`
  const { data: rows, error } = await admin
    .from('document_chunks')
    .select('id, content, documents!inner(title)')
    .eq('organisation_id', caller.organisation_id)
    .or(stale)
    .limit(BATCH)
  if (error) return json(500, { error: 'Could not read passages' })

  let updated = 0
  try {
    for (let i = 0; i < (rows ?? []).length; i += EMBED_BATCH) {
      const batch = rows!.slice(i, i + EMBED_BATCH)
      const vectors = await provider.embed(
        batch.map((r) => `${(r.documents as unknown as { title: string }).title}\n\n${r.content}`),
        'document',
      )
      for (let j = 0; j < batch.length; j++) {
        const { error: updateError } = await admin
          .from('document_chunks')
          .update({ embedding: JSON.stringify(vectors[j]), embedding_model: provider.embeddingModel })
          .eq('id', batch[j].id)
        if (!updateError) updated++
      }
    }
  } catch {
    return json(502, { error: 'The AI service could not create embeddings', updated })
  }

  const { count } = await admin
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('organisation_id', caller.organisation_id)
    .or(stale)
  return json(200, { updated, remaining: count ?? 0, model: provider.embeddingModel })
})
