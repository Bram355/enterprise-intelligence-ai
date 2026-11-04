import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { parseInviteInput } from './validate.ts'

const MAX_INVITES_PER_HOUR = 20

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'Server is not configured' })

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Not signed in' })

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json(401, { error: 'Not signed in' })
  const callerId = userData.user.id

  const { data: caller } = await admin
    .from('profiles')
    .select('organisation_id, role, is_active')
    .eq('id', callerId)
    .maybeSingle()
  if (!caller || !caller.is_active || caller.role !== 'admin') {
    return json(403, { error: 'Only organisation admins can invite members' })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Request body must be valid JSON' })
  }
  const parsed = parseInviteInput(body)
  if (!parsed.ok) return json(400, { error: parsed.error })
  const input = parsed.value

  if (input.departmentId) {
    const { data: dept } = await admin
      .from('departments')
      .select('id')
      .eq('id', input.departmentId)
      .eq('organisation_id', caller.organisation_id)
      .maybeSingle()
    if (!dept) return json(400, { error: 'Choose a valid department' })
  }

  // Invited people get a profile as soon as the invitation is sent, so check pending invitations first.
  const { data: pending } = await admin
    .from('invitations')
    .select('id, expires_at')
    .eq('email', input.email)
    .eq('status', 'pending')
    .maybeSingle()
  if (pending) {
    return new Date(pending.expires_at) > new Date()
      ? json(409, { error: 'An invitation for this email is already pending' })
      : json(409, { error: 'The earlier invitation for this email has expired. Resending invitations is planned for Phase 7.' })
  }

  const { data: existingMember } = await admin.from('profiles').select('id').eq('email', input.email).maybeSingle()
  if (existingMember) return json(409, { error: 'This person already has an account' })

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('invited_by', callerId)
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_INVITES_PER_HOUR) {
    return json(429, { error: `Invitation limit reached (${MAX_INVITES_PER_HOUR} per hour). Try again later.` })
  }


  const { data: invitation, error: insertError } = await admin
    .from('invitations')
    .insert({
      organisation_id: caller.organisation_id,
      email: input.email,
      role: input.role,
      department_id: input.departmentId,
      invited_by: callerId,
    })
    .select('id, email, role, department_id, status, expires_at, created_at')
    .single()
  if (insertError || !invitation) return json(500, { error: 'Could not create the invitation' })

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: input.redirectTo ?? undefined,
    data: input.fullName ? { full_name: input.fullName } : undefined,
  })
  if (inviteError) {
    await admin.from('invitations').delete().eq('id', invitation.id)
    return json(502, { error: 'Could not send the invitation email' })
  }

  await admin.from('audit_log').insert({
    organisation_id: caller.organisation_id,
    actor_id: callerId,
    action: 'invitation.created',
    target_type: 'invitation',
    target_id: invitation.id,
    details: { email: input.email, role: input.role, department_id: input.departmentId },
  })

  return json(201, { invitation })
})
