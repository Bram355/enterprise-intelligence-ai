export const VISIBILITIES = ['organisation', 'departments'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export interface DocumentMetadata {
  documentId: string | null
  title: string
  description: string
  categoryId: string | null
  tags: string[]
  visibility: Visibility
  departmentIds: string[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Fields = Record<string, string | undefined>

function parseList(raw: string | undefined): string[] | null {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : null
  } catch {
    return null
  }
}

export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return (base || 'Untitled document').slice(0, 200)
}

export function parseMetadata(
  fields: Fields,
  fileName: string,
): { ok: true; value: DocumentMetadata } | { ok: false; error: string } {
  const documentId = fields.documentId?.trim() || null
  if (documentId && !UUID_RE.test(documentId)) return { ok: false, error: 'Invalid document' }

  const title = (fields.title ?? '').trim() || titleFromFileName(fileName)
  if (title.length > 200) return { ok: false, error: 'Title must be 200 characters or fewer' }

  const description = (fields.description ?? '').trim()
  if (description.length > 2000) return { ok: false, error: 'Description must be 2000 characters or fewer' }

  const categoryId = fields.categoryId?.trim() || null
  if (categoryId && !UUID_RE.test(categoryId)) return { ok: false, error: 'Choose a valid category' }

  const rawTags = parseList(fields.tags)
  if (!rawTags) return { ok: false, error: 'Tags must be a list' }
  const tags = [...new Set(rawTags.map((t) => t.trim().toLowerCase()).filter(Boolean))]
  if (tags.length > 20) return { ok: false, error: 'Use at most 20 tags' }
  if (tags.some((t) => t.length > 40)) return { ok: false, error: 'Tags must be 40 characters or fewer' }

  const visibility = (fields.visibility ?? 'organisation') as Visibility
  if (!VISIBILITIES.includes(visibility)) return { ok: false, error: 'Choose who can see this document' }

  const departmentIds = parseList(fields.departmentIds)
  if (!departmentIds || departmentIds.some((id) => !UUID_RE.test(id)) || departmentIds.length > 50) {
    return { ok: false, error: 'Choose valid departments' }
  }
  if (visibility === 'departments' && departmentIds.length === 0) {
    return { ok: false, error: 'Choose at least one department' }
  }

  return {
    ok: true,
    value: {
      documentId,
      title,
      description,
      categoryId,
      tags,
      visibility,
      departmentIds: visibility === 'departments' ? [...new Set(departmentIds)] : [],
    },
  }
}
