# Architecture

## Overview

```
Browser (React SPA)
   │  Supabase JS client (publishable key + user session)
   ▼
Supabase
   ├─ Auth            — email/password login, password reset, sessions
   ├─ Postgres        — organisations, departments, users, documents, chunks, chats, feedback, audit log
   │    ├─ RLS        — every table protected; permissions enforced in the database
   │    └─ pgvector   — embeddings for semantic search (Phase 3–4)
   ├─ Storage         — uploaded files in private buckets, access via RLS policies
   └─ Edge Functions  — document processing, AI calls, rate limiting (secrets stay server-side)
           │
           ▼
      AI provider (Phase 4, needs approval) — behind a provider-independent adapter
```

## Principles

- **Permissions live in the database.** The UI hides what a user cannot do, but RLS policies are the real enforcement.
- **Secrets never reach the browser.** The frontend only holds the Supabase URL and publishable key. AI keys and the Supabase secret key are used only inside Edge Functions.
- **Uploaded content is data, not instructions.** Document text is passed to the AI as quoted context with a fixed system prompt; it can never change the assistant's rules.
- **Provider independence.** AI and embedding calls go through one adapter interface so the provider can be swapped.

## Identity and access (Phase 2)

| Table | Purpose | Who can read | Who can change (from the browser) |
|---|---|---|---|
| `organisations` | Tenant | Members of that organisation | Nobody |
| `departments` | Teams inside an organisation | Members of that organisation | Organisation admins |
| `profiles` | One per user: organisation, role, department, active flag | Members of the same organisation | The user, own `full_name` only |
| `invitations` | Pending/accepted invites | Organisation admins | Nobody (Edge Function only) |
| `audit_log` | Security-relevant events | Organisation admins | Nobody (triggers/Edge Function only) |

Invitation flow: admin submits the form → `invite-member` Edge Function (checks admin, validates, rate-limits, writes invitation + audit entry) → Supabase Auth sends the email → database trigger creates the profile from the invitation → user sets a password on `/accept-invite` → invitation marked accepted.

Helper functions live in a non-exposed `private` schema (`current_org_id`, `is_org_admin`) and are used by RLS policies. Department foreign keys include `organisation_id`, so a profile can't point at another organisation's department. Security tests: `supabase/tests/rls.test.sql`.

## Knowledge library (Phase 3)

| Table | Purpose | Who can read | Who can change (from the browser) |
|---|---|---|---|
| `categories` | Document categories | Members of the organisation | Admins and Knowledge Managers |
| `documents` | Title, description, category, tags, visibility, status, archived flag | Permitted members (see below) | Admins and Knowledge Managers, metadata only |
| `document_departments` | Departments a restricted document is shared with | Permitted members | Admins and Knowledge Managers |
| `document_versions` | Every uploaded file: path, size, SHA-256, status, error | Permitted members | Nobody (Edge Function only) |
| `document_chunks` | Extracted passages with page numbers and a full-text index | Permitted members | Nobody (Edge Function only) |

"Permitted" = `private.can_read_document`: Admins and Knowledge Managers see all documents of their organisation; employees see indexed, non-archived documents shared with everyone or with their department. Storage objects in the private `documents` bucket (`<org>/<document>/v<n>-<file>`) use the same rule.

Upload flow: form → `upload-document` Edge Function (role check, file validation, rate limit) → private storage → text extraction → chunking → passages saved → status `indexed` or `failed` + audit entry. Security tests: `supabase/tests/documents.test.sql`; processing unit tests live next to the function.

## Frontend layout

```
src/
  app/            routes
  components/
    layout/       AppShell, Sidebar, Topbar
    ui/           shared building blocks (Card, Badge, PageHeader, PlannedFeature)
  config/         environment parsing, navigation
  features/       one folder per area: dashboard, assistant, library, support, admin
  lib/            Supabase client, health check
  types/          shared domain types (roles, document statuses)
  test/           test setup
supabase/
  config.toml     local Supabase configuration
  migrations/     database schema and security policies (from Phase 2)
  functions/      Edge Functions: invite-member, upload-document
  tests/          pgTAP database security tests
samples/          synthetic documents for local testing
scripts/          sample generation and seeding
docs/             brief, decisions, architecture
```

## Planned external services

| Service | Needed? | Purpose | Status |
|---|---|---|---|
| Supabase | Essential | Database, auth, storage, vector search, server functions | Local only (no account yet) |
| AI provider (e.g. OpenAI, Google Gemini, Anthropic) | Essential for the assistant | Answers and embeddings | Not connected; mock adapter until approved |
| Email provider (e.g. Resend) | Optional | Reliable auth emails in production (Supabase's built-in email is rate-limited) | Not connected |
| Error monitoring (e.g. Sentry) | Optional | Production error tracking | Not connected |
| Hosting (e.g. Vercel, Netlify, Cloudflare Pages) | Needed at deploy time | Serve the frontend | Not connected |
