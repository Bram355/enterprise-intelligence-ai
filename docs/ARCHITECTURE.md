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
      AI provider (mock | Ollama self-hosted | OpenAI) — behind a provider-independent adapter
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

## AI retrieval (Phase 4)

```
Question (AI Assistant page)
  → ask-question Edge Function: checks user, validates, rate-limits (60/hour)
  → embed question (provider adapter: mock | ollama | openai)
  → match_chunks RPC as the user (RLS): meaning + keyword search, top 6 permitted passages
  → none relevant? reply "couldn't find this" without calling the AI
  → fixed system prompt + fenced sources + question → provider.generate
  → keep only valid [n] citations → log in ai_queries → answer + sources
```

Uploads embed each passage (title + text) via the same adapter; if the AI service fails the document stays keyword-searchable and `reindex-embeddings` fills the gaps later. Tests: `supabase/tests/retrieval.test.sql`, unit tests in `supabase/functions/_shared/ai/`, and `npm run eval:questions` against the running stack.

## AI assistant conversations (Phase 5)

```
Assistant page (/assistant/:conversationId?)
  → ask-question { question, conversationId? }
      new: creates a conversation owned by the caller
      follow-up: checks the conversation is the caller's, loads its last 3 questions,
                 rewrites the follow-up into a standalone search query (model, with fallback)
      → match_chunks with the search query, as the user (same RLS as Phase 4)
      → provider answer (earlier questions fenced as context) → answered | no_answer | needs_clarification
      → logs ai_queries (conversation_id, search_query), returns citations with section
  → browser reads conversations / ai_queries / answer_feedback directly, under RLS
```

## Technical support (Phase 6)

```
Support page (/support/:caseId?)
  → troubleshoot { category, problem, errorCode?, environment }
      validates input, refuses instruction-override text, shares the 60/hour question limit
      → match_chunks with "category + error code + problem", as the user (same RLS), top 4
      → provider with a structured prompt: SUMMARY / CAUSE [n] / STEP action => expected [n] / ESCALATE [n]
      → parser keeps only lines citing supplied sources (max 4 causes, 6 steps);
        escalation falls back to a cited "escalate…" sentence from the sources
      → logs ai_queries, then (service role) inserts support_cases + support_case_steps
  → browser reads cases/steps under RLS; owner may update only cases.status and steps.outcome
```

`support_cases` belong to one user; organisation admins can read their organisation's cases. Browsers can't insert or delete cases or edit the diagnosis (column-level grants plus RLS). Setting a case to resolved/escalated stamps `closed_at`; changing a step outcome touches the case's `updated_at`.

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
  functions/      Edge Functions: invite-member, upload-document, ask-question, reindex-embeddings; _shared/ai provider adapter
  tests/          pgTAP database security tests
samples/          synthetic documents for local testing
scripts/          sample generation and seeding
docs/             brief, decisions, architecture
```

## Planned external services

| Service | Needed? | Purpose | Status |
|---|---|---|---|
| Supabase | Essential | Database, auth, storage, vector search, server functions | Local only (no account yet) |
| AI provider: Ollama (free, self-hosted) or OpenAI (paid) | Essential for the assistant | Answers and embeddings | Ollama in local development; mock default; OpenAI adapter ready (needs credit) |
| Email provider (e.g. Resend) | Optional | Reliable auth emails in production (Supabase's built-in email is rate-limited) | Not connected |
| Error monitoring (e.g. Sentry) | Optional | Production error tracking | Not connected |
| Hosting (e.g. Vercel, Netlify, Cloudflare Pages) | Needed at deploy time | Serve the frontend | Not connected |
