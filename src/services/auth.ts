import type { Session } from '@supabase/supabase-js'
import { requireSupabase } from '../lib/supabase'
import type { Profile } from '../types/domain'
import { authErrorMessage } from './errors'

export type Result = { ok: true } | { ok: false; error: string }

export async function signIn(email: string, password: string): Promise<Result> {
  const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password })
  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true }
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut()
}

export async function sendPasswordReset(email: string): Promise<Result> {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  // Same response whether or not the account exists, except for rate limiting.
  if (error && error.status === 429) return { ok: false, error: authErrorMessage(error) }
  return { ok: true }
}

export async function updatePassword(password: string): Promise<Result> {
  const { error } = await requireSupabase().auth.updateUser({ password })
  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true }
}

export async function getSession(): Promise<Session | null> {
  const { data } = await requireSupabase().auth.getSession()
  return data.session
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, email, full_name, role, is_active, organisation_id, department_id, organisations(name), departments(name)')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error('Could not load your profile.')
  if (!data || !data.is_active) return null
  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role,
    isActive: data.is_active,
    organisationId: data.organisation_id,
    organisationName: data.organisations?.name ?? '',
    departmentId: data.department_id,
    departmentName: data.departments?.name ?? null,
  }
}

export async function updateOwnName(userId: string, fullName: string): Promise<Result> {
  const { error } = await requireSupabase().from('profiles').update({ full_name: fullName.trim() }).eq('id', userId)
  return error ? { ok: false, error: 'Could not save your name.' } : { ok: true }
}
