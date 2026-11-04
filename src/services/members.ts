import { requireSupabase } from '../lib/supabase'
import type { Department, Invitation, Role } from '../types/domain'
import { functionErrorMessage } from './errors'

export interface Member {
  id: string
  email: string
  fullName: string
  role: Role
  isActive: boolean
  departmentName: string | null
}

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, email, full_name, role, is_active, departments(name)')
    .order('full_name')
  if (error) throw new Error('Could not load members.')
  return data.map((m) => ({
    id: m.id,
    email: m.email,
    fullName: m.full_name,
    role: m.role,
    isActive: m.is_active,
    departmentName: m.departments?.name ?? null,
  }))
}

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await requireSupabase().from('departments').select('id, name').order('name')
  if (error) throw new Error('Could not load departments.')
  return data
}

export async function listInvitations(): Promise<Invitation[]> {
  const { data, error } = await requireSupabase()
    .from('invitations')
    .select('id, email, role, status, expires_at, created_at, departments(name)')
    .order('created_at', { ascending: false })
  if (error) throw new Error('Could not load invitations.')
  return data.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    departmentName: i.departments?.name ?? null,
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }))
}

export interface InviteRequest {
  email: string
  fullName: string
  role: Role
  departmentId: string | null
}

export async function inviteMember(request: InviteRequest): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await requireSupabase().functions.invoke('invite-member', {
    body: { ...request, redirectTo: `${window.location.origin}/accept-invite` },
  })
  return error ? { ok: false, error: await functionErrorMessage(error) } : { ok: true }
}
