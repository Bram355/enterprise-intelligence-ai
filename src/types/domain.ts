export const ROLES = ['admin', 'knowledge_manager', 'employee'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Organisation Admin',
  knowledge_manager: 'Knowledge Manager',
  employee: 'Employee',
}

export const DOCUMENT_STATUSES = ['uploaded', 'processing', 'indexed', 'failed', 'archived'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]
