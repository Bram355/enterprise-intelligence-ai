import { requireSupabase } from '../lib/supabase'

export interface Analytics {
  since: string
  documents: { total: number; indexed: number; failed: number; processing: number; archived: number; added: number }
  failedDocuments: { id: string; title: string; error: string | null; updatedAt: string }[]
  questions: { total: number; answered: number; unanswered: number; clarifications: number; failed: number; medianLatencyMs: number | null }
  perDay: { day: string; total: number; unanswered: number }[]
  topUnanswered: { question: string; count: number; lastAsked: string }[]
  topDocuments: { documentId: string; title: string; count: number }[]
  feedback: { helpful: number; notHelpful: number; incorrect: number; missingDocs: number }
  recentNegativeFeedback: { question: string; comment: string | null; reason: 'incorrect' | 'missing_docs' | 'other' | null; createdAt: string }[]
  support: { total: number; open: number; resolved: number; escalated: number; byCategory: Record<string, number> }
  users: { total: number; active: number; askedQuestions: number }
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export async function getAnalytics(days = 30): Promise<Result<Analytics>> {
  const { data, error } = await requireSupabase().rpc('org_analytics', { p_days: days })
  if (error || !data) return { ok: false, error: 'Could not load analytics.' }
  return { ok: true, value: data as unknown as Analytics }
}

export interface AuditEntry {
  id: number
  action: string
  actorName: string | null
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown>
  createdAt: string
}

export const PAGE_SIZE = 25

export async function listAuditLog(options: { action?: string; before?: number } = {}): Promise<Result<AuditEntry[]>> {
  const supabase = requireSupabase()
  let query = supabase.from('audit_log').select('id, action, actor_id, target_type, target_id, details, created_at').order('id', { ascending: false }).limit(PAGE_SIZE)
  if (options.action) query = query.like('action', `${options.action}%`)
  if (options.before) query = query.lt('id', options.before)
  const { data, error } = await query
  if (error) return { ok: false, error: 'Could not load the audit log.' }
  const actorIds = [...new Set(data.map((e) => e.actor_id).filter((id): id is string => Boolean(id)))]
  const names = new Map<string, string>()
  if (actorIds.length) {
    const { data: people } = await supabase.from('profiles').select('id, full_name, email').in('id', actorIds)
    for (const p of people ?? []) names.set(p.id, p.full_name || p.email)
  }
  return {
    ok: true,
    value: data.map((e) => ({
      id: e.id,
      action: e.action,
      actorName: e.actor_id ? (names.get(e.actor_id) ?? 'Former member') : null,
      targetType: e.target_type,
      targetId: e.target_id,
      details: (e.details ?? {}) as Record<string, unknown>,
      createdAt: e.created_at,
    })),
  }
}

/** Plain-English description of an audit entry for the log viewer. */
export function describeAudit(entry: AuditEntry): string {
  const d = entry.details
  const name = (key: string) => (typeof d[key] === 'string' ? `"${d[key] as string}"` : '')
  const change = (key: string) => {
    const c = d[key] as { from?: unknown; to?: unknown } | undefined
    return c && c.from !== c.to ? `${key.replace('_id', '').replace('is_active', 'active')}: ${String(c.from ?? 'none')} → ${String(c.to ?? 'none')}` : null
  }
  switch (entry.action) {
    case 'member.updated':
      return `Member changed (${[change('role'), change('department_id'), change('is_active')].filter(Boolean).join(', ') || 'no change'})`
    case 'member.joined':
      return 'Member joined'
    case 'invitation.created':
      return `Invited ${name('email')}`.trim()
    case 'invitation.revoked':
      return `Revoked invitation for ${name('email')}`.trim()
    default: {
      const [area, verb] = entry.action.split('.')
      const label = name('title') || name('name')
      return `${area.replace('_', ' ')} ${(verb ?? '').replace(/_/g, ' ')} ${label}`.trim().replace(/^./, (c) => c.toUpperCase())
    }
  }
}
