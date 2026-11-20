import { requireSupabase } from '../lib/supabase'
import type { Department, Invitation, Role } from '../types/domain'
import { functionErrorMessage } from './errors'

export interface Member {
  id: string
  email: string
  fullName: string
  role: Role
  isActive: boolean
  departmentId: string | null
  departmentName: string | null
}

type Result = { ok: true } | { ok: false; error: string }

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, email, full_name, role, is_active, department_id, departments(name)')
    .order('full_name')
  if (error) throw new Error('Could not load members.')
  return data.map((m) => ({
    id: m.id,
    email: m.email,
    fullName: m.full_name,
    role: m.role,
    isActive: m.is_active,
    departmentId: m.department_id,
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

export interface MemberUpdate {
  role: Role
  departmentId: string | null
  isActive: boolean
}

/** Database messages from the admin functions are written for people, so show them as they are. */
const dbError = (message: string | undefined, fallback: string) =>
  message && /admin|member|department|invitation/i.test(message) && message.length < 120 ? message : fallback

export async function updateMember(memberId: string, update: MemberUpdate): Promise<Result> {
  const { error } = await requireSupabase().rpc('admin_update_member', {
    p_member: memberId,
    p_role: update.role,
    // The generated type omits null, but the function accepts it to clear the department.
    p_department_id: update.departmentId as string,
    p_is_active: update.isActive,
  })
  return error ? { ok: false, error: dbError(error.message, 'Could not update this member.') } : { ok: true }
}

export async function revokeInvitation(invitationId: string): Promise<Result> {
  const { error } = await requireSupabase().rpc('admin_revoke_invitation', { p_invitation: invitationId })
  return error ? { ok: false, error: dbError(error.message, 'Could not revoke this invitation.') } : { ok: true }
}

export async function saveDepartment(name: string, organisationId: string, id?: string): Promise<Result> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Enter a department name.' }
  const supabase = requireSupabase()
  const { error } = id
    ? await supabase.from('departments').update({ name: trimmed }).eq('id', id)
    : await supabase.from('departments').insert({ name: trimmed, organisation_id: organisationId })
  if (error?.code === '23505') return { ok: false, error: 'A department with that name already exists.' }
  return error ? { ok: false, error: 'Could not save the department.' } : { ok: true }
}

export async function deleteDepartment(id: string): Promise<Result> {
  const { error } = await requireSupabase().from('departments').delete().eq('id', id)
  return error ? { ok: false, error: 'Could not delete the department.' } : { ok: true }
}
