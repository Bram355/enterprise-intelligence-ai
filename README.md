# Enterprise Intelligence AI

Organisation-wide AI knowledge platform: upload internal documents, then ask an assistant questions and get answers with citations, only from documents you are allowed to see.

> Development build. Uses synthetic data and a local backend only. See [docs/BRIEF.md](docs/BRIEF.md) for the full brief, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DECISIONS.md](docs/DECISIONS.md).

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Project foundation, app shell, local backend | Done |
| 2 | Database schema, invite-only auth, roles, security policies | Done |
| 3 | Knowledge library: upload, processing, versions, archiving, keyword search, document permissions | Done |
| 4 | AI retrieval: embeddings (pgvector), permission-aware hybrid search, provider adapter (mock, Ollama, OpenAI), answers with citations | Done |
| 5 | AI assistant: saved conversations, follow-up questions, clarifying questions, helpful/not helpful feedback, section references | In review |
| 6–9 | Technical support module, admin and analytics, QA and security review, deployment prep | Planned |

## Prerequisites

- Node.js 20+ and npm
- Docker Desktop (for the local Supabase backend)

## Getting started

```bash
npm install
npm run db:start          # starts local Supabase in Docker (first run downloads images)
cp .env.example .env.local
# paste the PUBLISHABLE_KEY printed by db:start into .env.local
npm run dev               # http://127.0.0.1:5173
```

`npm run db:start` also applies the migrations and loads the synthetic demo data from `supabase/seed.sql`.

### Demo accounts (local only)

All use the password `Password123!`. They exist only in the local database and must never be created in a hosted project.

| Email | Organisation | Role |
|---|---|---|
| admin@northwind.test | Northwind Payments | Organisation Admin |
| km@northwind.test | Northwind Payments | Knowledge Manager |
| employee@northwind.test | Northwind Payments | Employee (Technical Support) |
| finance@northwind.test | Northwind Payments | Employee (Finance) |
| admin@contoso.test | Contoso Retail | Organisation Admin (second organisation, for isolation tests) |

Accounts are invite-only: sign in as an admin, open **Administration**, and invite someone. Locally the invitation email lands in Mailpit (link below). The link opens the app's "set up your account" page. Run `npx supabase functions serve` in a second terminal so the Edge Functions (`invite-member`, `upload-document`, `ask-question`, `reindex-embeddings`) are available.

### Knowledge Library (local only)

Admins and Knowledge Managers can upload PDF, Word (.docx), text and Markdown files (max 20 MB). The `upload-document` function checks the file, stores it in a private bucket, extracts the text, splits it into passages and indexes them for keyword search. Employees only see indexed, non-archived documents shared with the whole organisation or with their department.

Load the synthetic sample documents from `samples/` (needs the functions running, see above):

```bash
npm run seed:documents
```

`samples/` is regenerated with `python3 scripts/make_samples.py` (needs `fpdf2` and `python-docx`). All sample content is fictional.

### AI providers (local)

The Edge Functions pick an AI provider from server-side settings in `supabase/functions/.env` (git-ignored; restart Supabase after changing it):

| `AI_PROVIDER` | Cost | Notes |
|---|---|---|
| `mock` (default) | Free | Hashed word embeddings; quotes the best-matching passages. No setup. |
| `ollama` | Free, self-hosted | Real AI on your own hardware; documents never leave it. Install [Ollama](https://ollama.com), run `ollama pull mxbai-embed-large` and `ollama pull qwen2.5:3b`, and make it listen on all interfaces (`OLLAMA_HOST=0.0.0.0`) so the Supabase containers can reach it at `http://host.docker.internal:11434` (override with `OLLAMA_URL`). |
| `openai` | Paid per use | Needs `OPENAI_API_KEY` with credit. Best answer quality. |

Example `supabase/functions/.env` for Ollama:

```bash
AI_PROVIDER=ollama
# optional: AI_CHAT_MODEL=llama3.2:3b  AI_EMBEDDING_MODEL=mxbai-embed-large  OLLAMA_URL=http://host.docker.internal:11434
```

After switching provider, call the `reindex-embeddings` function as an admin or knowledge manager (once per organisation) until `remaining` is 0, so existing passages get the new provider's embeddings. The **AI Assistant** page calls the `ask-question` function, which searches only passages the signed-in user may read (RLS) and logs every question in `ai_queries`.

Conversations (Phase 5): each chat is saved under **AI Assistant** and can be reopened or deleted. Follow-ups like "and bank transfers?" are rewritten into a standalone search using the last 3 questions, vague questions get a "Could you clarify…" reply, and every answer has helpful / not helpful buttons (admins can read their organisation's feedback). Sources show the document, section, page and version.

Check the sample questions and conversation rules (right documents cited, restricted ones never leaked, nobody can read, continue or rate someone else's conversation) after seeding:

```bash
npm run eval:questions
```

Keys belong only in server-side settings, never in `.env.local` or the browser. Optional for every provider: `AI_CHAT_MODEL`, `AI_EMBEDDING_MODEL`, `AI_MIN_SIMILARITY`.

On Windows (PowerShell) use `Copy-Item .env.example .env.local` instead of `cp`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with Oxlint |
| `npm run typecheck` | TypeScript checks |
| `npm test` | Run unit and component tests (Vitest) |
| `npm run check` | Lint + typecheck + tests |
| `npm run test:db` | Database security tests (pgTAP, needs local Supabase running) |
| `npm run seed:documents` | Upload the synthetic sample documents through the real upload function (local only) |
| `npm run eval:questions` | Ask sample questions as different demo users and check citations and permissions (local only) |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local database |
| `npm run db:start` / `db:stop` / `db:status` / `db:reset` | Manage the local Supabase stack |

Local Supabase Studio (database UI): http://127.0.0.1:54323. Local email inbox (Mailpit): http://127.0.0.1:54324.
