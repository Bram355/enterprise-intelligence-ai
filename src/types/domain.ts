import type { Database } from './database'

export type Role = Database['public']['Enums']['app_role']
export const ROLES: readonly Role[] = ['admin', 'knowledge_manager', 'employee']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Organisation Admin',
  knowledge_manager: 'Knowledge Manager',
  employee: 'Employee',
}

export type InvitationStatus = Database['public']['Enums']['invitation_status']

export const DOCUMENT_STATUSES = ['uploaded', 'processing', 'indexed', 'failed', 'archived'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export interface Profile {
  id: string
  email: string
  fullName: string
  role: Role
  isActive: boolean
  organisationId: string
  organisationName: string
  departmentId: string | null
  departmentName: string | null
}

export interface Department {
  id: string
  name: string
}

export interface Invitation {
  id: string
  email: string
  role: Role
  status: InvitationStatus
  departmentName: string | null
  expiresAt: string
  createdAt: string
}
