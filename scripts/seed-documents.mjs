// Uploads the synthetic documents in samples/ through the upload-document Edge Function.
// Local development only: uses the seeded demo accounts. Run after `npm run db:reset`.
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SEED_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8').catch(() => '')
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)?.[1]?.trim()
if (!key) throw new Error('Set VITE_SUPABASE_PUBLISHABLE_KEY (see .env.local)')
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error('Refusing to seed a non-local backend')

const NORTHWIND = {
  techDocs: '00000000-0000-4000-d000-000000000001',
  policies: '00000000-0000-4000-d000-000000000002',
  onboarding: '00000000-0000-4000-d000-000000000003',
  finance: '00000000-0000-4000-b000-000000000004',
  support: '00000000-0000-4000-b000-000000000001',
  integrations: '00000000-0000-4000-b000-000000000002',
  operations: '00000000-0000-4000-b000-000000000003',
}

const uploads = [
  {
    as: 'km@northwind.test',
    file: 'northwind-payments-api-troubleshooting.pdf',
    title: 'Payments API troubleshooting guide',
    categoryId: NORTHWIND.techDocs,
    tags: ['api', 'errors', 'webhooks'],
    visibility: 'departments',
    departmentIds: [NORTHWIND.support, NORTHWIND.integrations],
  },
  { as: 'km@northwind.test', file: 'northwind-refund-policy.docx', title: 'Refund and chargeback policy', categoryId: NORTHWIND.policies, tags: ['refunds', 'chargebacks'] },
  { as: 'admin@northwind.test', file: 'northwind-expense-policy.md', title: 'Expense policy', categoryId: NORTHWIND.policies, tags: ['finance', 'expenses'], visibility: 'departments', departmentIds: [NORTHWIND.finance] },
  { as: 'km@northwind.test', file: 'northwind-onboarding-checklist.txt', title: 'New starter onboarding checklist', categoryId: NORTHWIND.onboarding, tags: ['onboarding'] },
  { as: 'km@northwind.test', file: 'northwind-pos-terminal-troubleshooting.md', title: 'POS terminal troubleshooting', categoryId: NORTHWIND.techDocs, tags: ['pos', 'terminals'], visibility: 'departments', departmentIds: [NORTHWIND.support, NORTHWIND.operations] },
  { as: 'km@northwind.test', file: 'northwind-http-error-reference.md', title: 'API HTTP error reference', categoryId: NORTHWIND.techDocs, tags: ['api', 'http'], visibility: 'departments', departmentIds: [NORTHWIND.support, NORTHWIND.integrations] },
  { as: 'km@northwind.test', file: 'northwind-sdk-plugin-guide.md', title: 'SDK and plugin troubleshooting', categoryId: NORTHWIND.techDocs, tags: ['sdk', 'plugins', 'webhooks'], visibility: 'departments', departmentIds: [NORTHWIND.support, NORTHWIND.integrations] },
  { as: 'admin@contoso.test', file: 'contoso-store-opening-procedure.md', title: 'Store opening procedure', categoryId: '00000000-0000-4000-d000-000000000004', tags: ['stores'] },
]

// Optional arguments upload only the matching files, e.g. `npm run seed:documents -- pos http`.
const only = process.argv.slice(2)
for (const u of uploads.filter((u) => only.length === 0 || only.some((o) => u.file.includes(o)))) {
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { error: signInError } = await client.auth.signInWithPassword({ email: u.as, password: 'Password123!' })
  if (signInError) throw new Error(`Sign-in failed for ${u.as}: ${signInError.message}`)
  const form = new FormData()
  form.append('file', new Blob([await readFile(new URL(`../samples/${u.file}`, import.meta.url))]), u.file)
  form.append('title', u.title)
  form.append('categoryId', u.categoryId)
  form.append('tags', JSON.stringify(u.tags))
  form.append('visibility', u.visibility ?? 'organisation')
  form.append('departmentIds', JSON.stringify(u.departmentIds ?? []))
  const { data, error } = await client.functions.invoke('upload-document', { body: form })
  if (error) {
    const body = error.context ? await error.context.text() : error.message
    throw new Error(`Upload of ${u.file} failed: ${body}`)
  }
  console.log(`${u.file}: ${data.status} (${data.chunkCount} chunks)${data.error ? ` — ${data.error}` : ''}`)
}
