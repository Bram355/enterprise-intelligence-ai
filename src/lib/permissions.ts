import type { Role } from '../types/domain'

// UI-level permissions only: they decide what to show. The database (RLS) and
// Edge Functions enforce the same rules independently.
const PERMISSIONS = {
  'admin.view': ['admin'],
  'members.invite': ['admin'],
  'departments.manage': ['admin'],
  'documents.manage': ['admin', 'knowledge_manager'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return (PERMISSIONS[permission] as readonly Role[]).includes(role)
}
