export const ROLES = ['admin', 'knowledge_manager', 'employee'] as const
export type Role = (typeof ROLES)[number]

export interface InviteInput {
  email: string
  role: Role
  departmentId: string | null
  fullName: string
  redirectTo: string | null
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseInviteInput(body: unknown): { ok: true; value: InviteInput } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Request body must be a JSON object' }
  const b = body as Record<string, unknown>

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address' }

  const role = b.role
  if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: 'Choose a valid role' }
  }

  let departmentId: string | null = null
  if (b.departmentId !== undefined && b.departmentId !== null && b.departmentId !== '') {
    if (typeof b.departmentId !== 'string' || !UUID_RE.test(b.departmentId)) {
      return { ok: false, error: 'Choose a valid department' }
    }
    departmentId = b.departmentId
  }

  const fullName = typeof b.fullName === 'string' ? b.fullName.trim() : ''
  if (fullName.length > 120) return { ok: false, error: 'Name must be 120 characters or fewer' }

  let redirectTo: string | null = null
  if (typeof b.redirectTo === 'string' && b.redirectTo) {
    try {
      const url = new URL(b.redirectTo)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad protocol')
      redirectTo = url.toString()
    } catch {
      return { ok: false, error: 'Invalid redirect URL' }
    }
  }

  return { ok: true, value: { email, role: role as Role, departmentId, fullName, redirectTo } }
}
