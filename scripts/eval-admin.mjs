// Checks Phase 7 administration and analytics against the local backend as different demo users:
// analytics are admin-only and organisation-scoped, member changes have server-side safeguards,
// and feedback reasons are saved. Local development only. Changes are reverted at the end.
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SEED_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8').catch(() => '')
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)?.[1]?.trim()
if (!key) throw new Error('Set VITE_SUPABASE_PUBLISHABLE_KEY (see .env.local)')
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error('Refusing to run against a non-local backend')

async function signIn(email) {
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password: 'Password123!' })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return { client, id: data.user.id }
}

const results = []
const check = (name, pass, detail = '') => {
  results.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const admin = await signIn('admin@northwind.test')
const employee = await signIn('employee@northwind.test')
const finance = await signIn('finance@northwind.test')
const contoso = await signIn('admin@contoso.test')

const { data: stats, error: statsError } = await admin.client.rpc('org_analytics', { p_days: 30 })
check('Northwind admin can read analytics', !statsError && stats?.users?.total === 4, `members=${stats?.users?.total} questions=${stats?.questions?.total} docs=${stats?.documents?.total}`)
const { data: contosoStats } = await contoso.client.rpc('org_analytics', { p_days: 30 })
check('Contoso admin sees only Contoso figures', contosoStats?.users?.total === 1, `members=${contosoStats?.users?.total} docs=${contosoStats?.documents?.total}`)
const titles = (contosoStats?.topDocuments ?? []).map((d) => d.title).concat((contosoStats?.failedDocuments ?? []).map((d) => d.title))
check('Contoso analytics never name Northwind documents', !titles.some((t) => /webhook|expense|payments api|pos terminal/i.test(t)), titles.join(', ') || 'none')
const { error: employeeStats } = await employee.client.rpc('org_analytics', { p_days: 30 })
check('Employees cannot read analytics', Boolean(employeeStats), employeeStats?.message)

const { error: selfDemote } = await admin.client.rpc('admin_update_member', { p_member: admin.id, p_role: 'employee', p_department_id: null, p_is_active: true })
check('Admin cannot demote themselves', /own admin access/.test(selfDemote?.message ?? ''), selfDemote?.message)
const { error: crossOrg } = await admin.client.rpc('admin_update_member', { p_member: contoso.id, p_role: 'employee', p_department_id: null, p_is_active: true })
check('Admin cannot change another organisation\'s member', /not found/i.test(crossOrg?.message ?? ''), crossOrg?.message)
const { error: promote } = await employee.client.rpc('admin_update_member', { p_member: employee.id, p_role: 'admin', p_department_id: null, p_is_active: true })
check('Employee cannot promote themselves', /Only organisation admins/.test(promote?.message ?? ''), promote?.message)
const { error: directWrite } = await employee.client.from('profiles').update({ role: 'admin' }).eq('id', employee.id)
check('Direct browser role change is refused', Boolean(directWrite), directWrite?.message)

const { data: before } = await admin.client.from('profiles').select('role, department_id, is_active').eq('id', finance.id).single()
const { error: deactivate } = await admin.client.rpc('admin_update_member', { p_member: finance.id, p_role: before.role, p_department_id: before.department_id, p_is_active: false })
const { data: financeView } = await finance.client.from('documents').select('id')
check('Deactivated member loses access to documents', !deactivate && (financeView ?? []).length === 0, `documents visible=${(financeView ?? []).length}`)
await admin.client.rpc('admin_update_member', { p_member: finance.id, p_role: before.role, p_department_id: before.department_id, p_is_active: true })
const { data: restored } = await finance.client.from('documents').select('id')
check('Reactivated member regains access', (restored ?? []).length > 0, `documents visible=${(restored ?? []).length}`)
const { data: audit } = await admin.client.from('audit_log').select('action, details').eq('target_id', finance.id).eq('action', 'member.updated').order('id', { ascending: false }).limit(2)
check('Member changes appear in the audit log', (audit ?? []).length === 2)

const { data: query } = await employee.client.from('ai_queries').select('id').neq('status', 'failed').order('created_at', { ascending: false }).limit(1).maybeSingle()
if (query) {
  const { data: existing } = await employee.client.from('answer_feedback').select('rating, comment, reason').eq('query_id', query.id).maybeSingle()
  const values = { rating: 'not_helpful', comment: 'eval-admin check', reason: 'missing_docs' }
  const { error: fbError } = existing
    ? await employee.client.from('answer_feedback').update(values).eq('query_id', query.id)
    : await employee.client.from('answer_feedback').insert({ query_id: query.id, ...values })
  const { data: after } = await admin.client.rpc('org_analytics', { p_days: 30 })
  check('Feedback reasons are saved and counted', !fbError && after?.feedback?.missingDocs >= 1, fbError?.message ?? `missingDocs=${after?.feedback?.missingDocs}`)
  if (existing) await employee.client.from('answer_feedback').update(existing).eq('query_id', query.id)
  else await employee.client.from('answer_feedback').delete().eq('query_id', query.id)
} else {
  check('Feedback reasons are saved and counted', false, 'no employee questions found; run npm run eval:questions first')
}

const passed = results.filter(Boolean).length
console.log(`\n${passed}/${results.length} administration checks passed`)
process.exit(passed === results.length ? 0 : 1)
