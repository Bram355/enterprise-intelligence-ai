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
