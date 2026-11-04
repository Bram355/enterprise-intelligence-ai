import { requireSupabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { functionErrorMessage } from './errors'

export type DocumentStatus = Database['public']['Enums']['document_status']
export type Visibility = Database['public']['Enums']['document_visibility']

export interface Category {
  id: string
  name: string
}

export interface DocumentSummary {
  id: string
  title: string
  description: string
  status: DocumentStatus
  visibility: Visibility
  tags: string[]
  categoryId: string | null
  categoryName: string | null
  currentVersion: number
  archivedAt: string | null
  processingError: string | null
  updatedAt: string
  departments: { id: string; name: string }[]
}

export interface DocumentVersion {
  id: string
  version: number
  fileName: string
  mimeType: string
  sizeBytes: number
  status: DocumentStatus
  error: string | null
  chunkCount: number | null
  storagePath: string
  createdAt: string
  uploadedBy: string | null
}

export interface DocumentDetail extends DocumentSummary {
  createdAt: string
  versions: DocumentVersion[]
  preview: { page: number | null; content: string }[]
}

export interface SearchResult {
  documentId: string
  title: string
  categoryName: string | null
  snippet: string
  page: number | null
}

const SUMMARY_COLUMNS =
  'id, title, description, status, visibility, tags, category_id, current_version, archived_at, processing_error, updated_at, created_at, categories(name), document_departments(department_id, departments(name))'

type SummaryRow = {
  id: string
  title: string
  description: string
  status: DocumentStatus
  visibility: Visibility
  tags: string[]
  category_id: string | null
  current_version: number
  archived_at: string | null
  processing_error: string | null
  updated_at: string
  created_at: string
  categories: { name: string } | null
  document_departments: { department_id: string; departments: { name: string } | null }[]
}

function toSummary(row: SummaryRow): DocumentSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    tags: row.tags,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? null,
    currentVersion: row.current_version,
    archivedAt: row.archived_at,
    processingError: row.processing_error,
    updatedAt: row.updated_at,
    departments: row.document_departments.map((d) => ({ id: d.department_id, name: d.departments?.name ?? '' })),
  }
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const { data, error } = await requireSupabase()
    .from('documents')
    .select(SUMMARY_COLUMNS)
    .order('updated_at', { ascending: false })
  if (error) throw new Error('Could not load documents.')
  return (data as unknown as SummaryRow[]).map(toSummary)
}

export async function getDocument(id: string): Promise<DocumentDetail | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('documents').select(SUMMARY_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error('Could not load the document.')
  if (!data) return null
  const row = data as unknown as SummaryRow
  const [versions, chunks] = await Promise.all([
    client
      .from('document_versions')
      .select('id, version, file_name, mime_type, size_bytes, status, error, chunk_count, storage_path, created_at, profiles(full_name, email)')
      .eq('document_id', id)
      .order('version', { ascending: false }),
    client.from('document_chunks').select('page, content').eq('document_id', id).order('chunk_index').limit(3),
  ])
  if (versions.error || chunks.error) throw new Error('Could not load the document.')
  return {
    ...toSummary(row),
    createdAt: row.created_at,
    versions: versions.data.map((v) => ({
      id: v.id,
      version: v.version,
      fileName: v.file_name,
      mimeType: v.mime_type,
      sizeBytes: v.size_bytes,
      status: v.status,
      error: v.error,
      chunkCount: v.chunk_count,
      storagePath: v.storage_path,
      createdAt: v.created_at,
      uploadedBy: v.profiles ? v.profiles.full_name || v.profiles.email : null,
    })),
    preview: chunks.data,
  }
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await requireSupabase().from('categories').select('id, name').order('name')
  if (error) throw new Error('Could not load categories.')
  return data
}

export async function createCategory(organisationId: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await requireSupabase().from('categories').insert({ organisation_id: organisationId, name: name.trim() })
  if (!error) return { ok: true }
  return { ok: false, error: error.code === '23505' ? 'That category already exists.' : 'Could not create the category.' }
}

export async function searchDocuments(query: string): Promise<SearchResult[]> {
  const { data, error } = await requireSupabase().rpc('search_documents', { search_query: query, max_results: 20 })
  if (error) throw new Error('Search failed. Please try again.')
  return data.map((r) => ({ documentId: r.document_id, title: r.title, categoryName: r.category_name, snippet: r.snippet, page: r.page }))
}

export interface UploadRequest {
  file: File
  documentId?: string
  title?: string
  description?: string
  categoryId?: string | null
  tags?: string[]
  visibility?: Visibility
  departmentIds?: string[]
}

export interface UploadResult {
  documentId: string
  version: number
  status: DocumentStatus
  chunkCount: number
  error: string | null
}

export async function uploadDocument(request: UploadRequest): Promise<{ ok: true; value: UploadResult } | { ok: false; error: string }> {
  const form = new FormData()
  form.append('file', request.file)
  if (request.documentId) form.append('documentId', request.documentId)
  if (request.title) form.append('title', request.title)
  if (request.description) form.append('description', request.description)
  if (request.categoryId) form.append('categoryId', request.categoryId)
  form.append('tags', JSON.stringify(request.tags ?? []))
  form.append('visibility', request.visibility ?? 'organisation')
  form.append('departmentIds', JSON.stringify(request.departmentIds ?? []))
  const { data, error } = await requireSupabase().functions.invoke<UploadResult>('upload-document', { body: form })
  if (error || !data) return { ok: false, error: await functionErrorMessage(error) }
  return { ok: true, value: data }
}

export interface DocumentUpdate {
  title: string
  description: string
  categoryId: string | null
  tags: string[]
  visibility: Visibility
  departmentIds: string[]
}

export async function updateDocument(
  doc: DocumentSummary,
  organisationId: string,
  update: DocumentUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = requireSupabase()
  const departmentIds = update.visibility === 'departments' ? update.departmentIds : []
  const current = new Set(doc.departments.map((d) => d.id))
  const wanted = new Set(departmentIds)
  const toAdd = departmentIds.filter((id) => !current.has(id))
  const toRemove = [...current].filter((id) => !wanted.has(id))

  // Add new departments before narrowing visibility, so nobody briefly loses access unexpectedly.
  if (toAdd.length) {
    const { error } = await client
      .from('document_departments')
      .insert(toAdd.map((department_id) => ({ document_id: doc.id, department_id, organisation_id: organisationId })))
    if (error) return { ok: false, error: 'Could not update who can see this document.' }
  }
  const { error } = await client
    .from('documents')
    .update({
      title: update.title.trim(),
      description: update.description.trim(),
      category_id: update.categoryId,
      tags: update.tags,
      visibility: update.visibility,
    })
    .eq('id', doc.id)
  if (error) return { ok: false, error: error.code === '22023' ? error.message : 'Could not save the document details.' }
  if (toRemove.length) {
    const { error: removeError } = await client
      .from('document_departments')
      .delete()
      .eq('document_id', doc.id)
      .in('department_id', toRemove)
    if (removeError) return { ok: false, error: 'Could not update who can see this document.' }
  }
  return { ok: true }
}

export async function setArchived(id: string, archived: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await requireSupabase()
    .from('documents')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  return error ? { ok: false, error: 'Could not update the document.' } : { ok: true }
}

export async function downloadVersion(version: DocumentVersion): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await requireSupabase().storage.from('documents').download(version.storagePath)
  if (error || !data) return { ok: false, error: 'Could not download the file.' }
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = version.fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { ok: true }
}

export function parseTags(input: string): string[] {
  return [...new Set(input.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Splits a search snippet marked with ⟦ ⟧ into plain and highlighted parts (rendered as text, never HTML). */
export function snippetParts(snippet: string): { text: string; highlight: boolean }[] {
  return snippet
    .split(/(⟦[^⟧]*⟧)/)
    .filter(Boolean)
    .map((part) => (part.startsWith('⟦') ? { text: part.slice(1, -1), highlight: true } : { text: part, highlight: false }))
}

export const ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt,.md,.markdown'
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export function checkFile(file: File | null): string | null {
  if (!file) return 'Choose a file to upload.'
  if (!/\.(pdf|docx|txt|md|markdown)$/i.test(file.name)) return 'Only PDF, Word (.docx), text (.txt) and Markdown (.md) files are supported.'
  if (file.size === 0) return 'The file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) return 'Files must be 20 MB or smaller.'
  return null
}
