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

## D6 — Invite-only accounts

**Decision:** Public sign-up is disabled (`enable_signup = false`). An Organisation Admin invites a person by email and chooses their role and department; the person sets a password from the invitation link. A database trigger on `auth.users` also refuses any account without a pending, unexpired invitation, so sign-up stays closed even if the Auth setting is changed by mistake.

**Why:** This is an internal business tool. Invite-only means nobody can join an organisation or choose their own role.

## D7 — Where permissions are enforced

**Decision:** Every table has Row Level Security. Users only see rows from their own organisation, and deactivated users see nothing. Users may change only their own `full_name` (column-level grant); role, department, organisation and active status can't be changed from the browser. Creating invitations goes through the `invite-member` Edge Function, which checks the caller is an active admin, validates input, limits each admin to 20 invitations per hour and writes an audit log entry. The browser's role checks only hide buttons; they are not security.

**Why:** UI checks can be bypassed by calling the API directly; database rules can't.

## D8 — Audit log

**Decision:** Key identity events (`member.joined`, `profile.updated`, `department.created/updated/deleted`, `invitation.created`) are written to `audit_log` by triggers or the Edge Function. Only admins of the same organisation can read it, and nobody can edit it from the browser.

## D9 — Document upload and processing in one Edge Function

**Decision:** The browser sends the file to the `upload-document` Edge Function, which checks the caller is an active Admin or Knowledge Manager, validates the file (extension, magic bytes, UTF-8, 20 MB limit, 30 uploads per hour), stores it in the private `documents` bucket, extracts text (PDF via `unpdf`, Word via `fflate` + XML parsing, text/Markdown directly), splits it into ~1,200-character passages with overlap and saves them. Status moves `uploaded → processing → indexed` or `failed` with a readable reason. Archiving is a separate flag (`archived_at`), so an archived document keeps its last processing status.

**Why:** One trusted server step means the browser can never write documents, versions or passages directly. Processing is synchronous for now because files are capped at 20 MB; a background queue can replace it later without changing the tables.

## D10 — Document permissions and versions

**Decision:** A document is visible to the whole organisation or to selected departments. Admins and Knowledge Managers see every document in their organisation; employees see only indexed, non-archived documents they are allowed to access. The same rule (`private.can_read_document`) protects documents, versions, passages and the stored files. Each upload of a new version is kept; only the newest version's passages are searchable.

**Why:** The AI in Phase 4 will only ever search passages through these rules, so a restricted document can't leak into an answer.

## D11 — Keyword search first

**Decision:** Phase 3 uses Postgres full-text search (`search_documents`, run with the caller's permissions). Search by meaning (embeddings with pgvector) comes in Phase 4 once an AI provider is approved.

**Why:** Works locally at no cost, and gives a baseline to compare semantic search against.

## D12 — AI provider: OpenAI recommended, mock until approved

**Decision:** All AI calls go through one interface (`supabase/functions/_shared/ai/`). A free, offline mock provider is the default. An OpenAI adapter (`text-embedding-3-small` at 1024 dimensions + a low-cost chat model) is ready but is only used when `AI_PROVIDER=openai` and a key is set as a server-side secret.

**Why:** Compared in Phase 4 (prices from official pages, Nov 2026): OpenAI was cheapest per question, offers embeddings and chat on one account, doesn't train on API data by default and offers a GDPR DPA. Gemini's paid tier is similar; its free tier may use content to improve products, so it's unsuitable for company documents. Anthropic has no embedding model, so it would need a second provider. Adding another provider means one adapter file.

## D13 — Permission-aware hybrid retrieval

**Decision:** `match_chunks` combines meaning search (pgvector cosine similarity, HNSW index) with keyword search (any question word, ranked) using reciprocal rank fusion. It runs as the signed-in user (`security invoker`), so the same RLS rules as the library decide which passages are eligible; archived, failed and processing documents are excluded for everyone. The `ask-question` function calls it with the user's own token, not the service role. If nothing relevant is found, the AI isn't called and the assistant says it couldn't find the answer.

**Why:** Restricted text can't leak into an answer if it is never retrieved. Hybrid search catches exact terms (error codes, product names) that pure meaning search misses. Embeddings use 1024 dimensions, which OpenAI, Gemini and Voyage all support, so switching provider needs only a re-embed (`reindex-embeddings`), not a schema change.

## D14 — Prompt-injection defences and logging

**Decision:** Rules live only in a fixed system prompt. Document passages and the question are wrapped in `<source>` / `<question>` tags that document text can't close or forge; the prompt says text inside sources is data, never instructions. Citations to sources that weren't provided are removed. Every question is logged in `ai_queries` (answer, passages used, model, tokens, latency); members see their own, admins their organisation's. Members are limited to 60 questions per hour.

**Why:** Uploaded documents are untrusted. Logging supports auditing, cost tracking and the analytics planned for Phase 7.

