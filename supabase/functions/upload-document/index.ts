import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getProvider } from '../_shared/ai/index.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { chunkSegments } from './chunk.ts'
import { extractSegments } from './extract.ts'
import { detectFileKind, MIME_TYPES, safeFileName } from './file-type.ts'
import { parseMetadata } from './metadata.ts'

const MAX_UPLOADS_PER_HOUR = 30
const MAX_TEXT_CHARS = 2_000_000
const CHUNK_INSERT_BATCH = 500
const EMBED_BATCH = 64

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function processVersion(
  admin: SupabaseClient,
  ctx: { organisationId: string; documentId: string; versionId: string; version: number; isNew: boolean },
  kind: Parameters<typeof extractSegments>[0],
  bytes: Uint8Array,
): Promise<{ ok: true; chunkCount: number; embedded: boolean } | { ok: false; error: string }> {
  try {
    const segments = await extractSegments(kind, bytes)
    const charCount = segments.reduce((n, s) => n + s.text.length, 0)
    if (charCount > MAX_TEXT_CHARS) throw new Error('The document contains too much text (limit 2 million characters).')
    const chunks = chunkSegments(segments)
    if (chunks.length === 0) {
      throw new Error('No readable text was found. Scanned documents need text recognition (OCR), which is not supported yet.')
    }

    // Embeddings power search by meaning. If the AI service fails, the document is
    // still indexed for keyword search and can be re-embedded later.
    let embeddings: (number[] | null)[] = chunks.map(() => null)
    let embeddingModel: string | null = null
    try {
      const provider = getProvider()
      const { data: doc } = await admin.from('documents').select('title').eq('id', ctx.documentId).single()
      const vectors: number[][] = []
      for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const batch = chunks.slice(i, i + EMBED_BATCH).map((c) => `${doc?.title ?? ''}\n\n${c.content}`)
        vectors.push(...(await provider.embed(batch, 'document')))
      }
      embeddings = vectors
      embeddingModel = provider.embeddingModel
    } catch (err) {
      await admin.from('audit_log').insert({
        organisation_id: ctx.organisationId,
        action: 'document.embedding_failed',
        target_type: 'document',
        target_id: ctx.documentId,
        details: { version: ctx.version, error: err instanceof Error ? err.message : 'unknown error' },
      })
    }

    for (let i = 0; i < chunks.length; i += CHUNK_INSERT_BATCH) {
      const rows = chunks.slice(i, i + CHUNK_INSERT_BATCH).map((c, j) => ({
        organisation_id: ctx.organisationId,
        document_id: ctx.documentId,
        version_id: ctx.versionId,
        chunk_index: c.index,
        page: c.page,
        content: c.content,
        embedding: embeddings[i + j] ? JSON.stringify(embeddings[i + j]) : null,
        embedding_model: embeddings[i + j] ? embeddingModel : null,
      }))
      const { error } = await admin.from('document_chunks').insert(rows)
      if (error) throw new Error('Could not save the extracted text.')
    }

    await admin.from('document_chunks').delete().eq('document_id', ctx.documentId).neq('version_id', ctx.versionId)
    await admin
      .from('document_versions')
      .update({ status: 'indexed', char_count: charCount, chunk_count: chunks.length, processed_at: new Date().toISOString(), error: null })
      .eq('id', ctx.versionId)
    await admin
      .from('documents')
      .update({ status: 'indexed', current_version: ctx.version, processing_error: null })
      .eq('id', ctx.documentId)
    return { ok: true, chunkCount: chunks.length, embedded: embeddingModel !== null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed.'
    await admin.from('document_chunks').delete().eq('version_id', ctx.versionId)
    await admin
      .from('document_versions')
      .update({ status: 'failed', error: message, processed_at: new Date().toISOString() })
      .eq('id', ctx.versionId)
    await admin
      .from('documents')
      .update(
        ctx.isNew
          ? { status: 'failed', current_version: ctx.version, processing_error: message }
          : { processing_error: `Version ${ctx.version} could not be processed: ${message}` },
      )
      .eq('id', ctx.documentId)
    await admin.from('audit_log').insert({
      organisation_id: ctx.organisationId,
      action: 'document.processing_failed',
      target_type: 'document',
      target_id: ctx.documentId,
      details: { version: ctx.version, error: message },
    })
    return { ok: false, error: message }
  }
}

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
  const callerId = userData.user.id

  const { data: caller } = await admin
    .from('profiles')
    .select('organisation_id, role, is_active')
    .eq('id', callerId)
    .maybeSingle()
  if (!caller || !caller.is_active || !['admin', 'knowledge_manager'].includes(caller.role)) {
    return json(403, { error: 'Only admins and knowledge managers can upload documents' })
  }
  const organisationId: string = caller.organisation_id

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json(400, { error: 'Send the document as a file upload' })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return json(400, { error: 'Choose a file to upload' })

  const fields: Record<string, string> = {}
  for (const key of ['documentId', 'title', 'description', 'categoryId', 'tags', 'visibility', 'departmentIds']) {
    const value = form.get(key)
    if (typeof value === 'string') fields[key] = value
  }
  const parsed = parseMetadata(fields, file.name)
  if (!parsed.ok) return json(400, { error: parsed.error })
  const meta = parsed.value

  const bytes = new Uint8Array(await file.arrayBuffer())
  const detected = detectFileKind(file.name, bytes)
  if (!detected.ok) return json(400, { error: detected.error })

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('document_versions')
    .select('id', { count: 'exact', head: true })
    .eq('uploaded_by', callerId)
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_UPLOADS_PER_HOUR) {
    return json(429, { error: `Upload limit reached (${MAX_UPLOADS_PER_HOUR} per hour). Try again later.` })
  }

  let documentId: string
  let version: number
  const isNew = !meta.documentId

  if (meta.documentId) {
    const { data: existing } = await admin
      .from('documents')
      .select('id, organisation_id, archived_at')
      .eq('id', meta.documentId)
      .maybeSingle()
    if (!existing || existing.organisation_id !== organisationId) return json(404, { error: 'Document not found' })
    if (existing.archived_at) return json(409, { error: 'Restore this document before uploading a new version' })
    const { data: latest } = await admin
      .from('document_versions')
      .select('version')
      .eq('document_id', existing.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    documentId = existing.id
    version = (latest?.version ?? 0) + 1
  } else {
    if (meta.categoryId) {
      const { data: category } = await admin
        .from('categories')
        .select('id')
        .eq('id', meta.categoryId)
        .eq('organisation_id', organisationId)
        .maybeSingle()
      if (!category) return json(400, { error: 'Choose a valid category' })
    }
    if (meta.departmentIds.length) {
      const { data: depts } = await admin
        .from('departments')
        .select('id')
        .eq('organisation_id', organisationId)
        .in('id', meta.departmentIds)
      if ((depts?.length ?? 0) !== meta.departmentIds.length) return json(400, { error: 'Choose valid departments' })
    }
    const { data: created, error: createError } = await admin
      .from('documents')
      .insert({
        organisation_id: organisationId,
        title: meta.title,
        description: meta.description,
        category_id: meta.categoryId,
        tags: meta.tags,
        visibility: meta.visibility,
        status: 'uploaded',
        created_by: callerId,
      })
      .select('id')
      .single()
    if (createError || !created) return json(500, { error: 'Could not create the document' })
    documentId = created.id
    version = 1
    if (meta.departmentIds.length) {
      const { error } = await admin.from('document_departments').insert(
        meta.departmentIds.map((department_id) => ({ document_id: documentId, department_id, organisation_id: organisationId })),
      )
      if (error) {
        await admin.from('documents').delete().eq('id', documentId)
        return json(500, { error: 'Could not save who can see the document' })
      }
    }
  }

  const fileName = safeFileName(file.name)
  const storagePath = `${organisationId}/${documentId}/v${version}-${fileName}`
  const mimeType = MIME_TYPES[detected.kind]
  const { error: storageError } = await admin.storage.from('documents').upload(storagePath, bytes, {
    contentType: mimeType,
    upsert: false,
  })
  if (storageError) {
    if (isNew) await admin.from('documents').delete().eq('id', documentId)
    return json(502, { error: 'Could not store the file. Please try again.' })
  }

  const { data: versionRow, error: versionError } = await admin
    .from('document_versions')
    .insert({
      document_id: documentId,
      organisation_id: organisationId,
      version,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: bytes.length,
      sha256: await sha256(bytes),
      status: 'processing',
      uploaded_by: callerId,
    })
    .select('id')
    .single()
  if (versionError || !versionRow) {
    await admin.storage.from('documents').remove([storagePath])
    if (isNew) await admin.from('documents').delete().eq('id', documentId)
    return json(500, { error: 'Could not save the document version' })
  }
  if (isNew) await admin.from('documents').update({ status: 'processing' }).eq('id', documentId)

  const result = await processVersion(
    admin,
    { organisationId, documentId, versionId: versionRow.id, version, isNew },
    detected.kind,
    bytes,
  )

  return json(201, {
    documentId,
    version,
    status: result.ok ? 'indexed' : 'failed',
    chunkCount: result.ok ? result.chunkCount : 0,
    searchByMeaning: result.ok ? result.embedded : false,
    error: result.ok ? null : result.error,
  })
})
