# Decision log

Short record of important technical decisions, newest last. Each entry explains what was decided and why, in plain language.

## D1 — Backend: Supabase instead of Firebase

**Decision:** Use Supabase (Postgres + pgvector + Row Level Security + Auth + Storage + Edge Functions) as the backend.

**Why:** The most important rule of the platform is that an employee must never get an answer from a document they cannot access. With Supabase, the permission check and the "find relevant passages" search can run in a single database query, and Postgres Row Level Security (RLS) enforces access inside the database itself, so a bug in application code cannot leak restricted documents. Firestore supports vector search too, but permission filtering is more limited and more of the enforcement would live in application code. Supabase's free tier also does not require a credit card, whereas Firebase Cloud Functions and Storage need the pay-as-you-go Blaze plan.

**Trade-off:** The brief listed Firebase as the preferred backend. The owner approved switching to Supabase.

## D2 — Version 1 scope: one organisation, three roles, department access

**Decision:** The data model is designed for many organisations (every record carries an `organisation_id`), but version 1 targets one fictional organisation with three roles: Organisation Admin, Knowledge Manager and Employee, plus department-level document access. Super Admin and Department Admin can be added later without redesigning the database.

**Why:** Keeps the first version smaller and easier to test thoroughly, without blocking future expansion.

## D3 — Frontend stack

**Decision:** React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router. Vitest and Testing Library for tests. Oxlint for linting (Vite template default). `lucide-react` for icons.

**Why:** Widely used, fast, well documented, and matches the brief.

## D4 — Local-first development

**Decision:** Develop against a local Supabase stack (Supabase CLI running in Docker). No cloud accounts, credentials or costs are needed until a hosted project is approved.

**Why:** Free, safe, reproducible, and lets database migrations and security rules be tested before anything is deployed.

## D5 — Honest placeholders

**Decision:** Features that are not built yet show a clear "Planned for Phase N" label. Dashboard metrics are not shown until they come from real data; any seed data added later will be visibly labelled as sample data.

**Why:** The brief forbids presenting fake functionality as complete.
