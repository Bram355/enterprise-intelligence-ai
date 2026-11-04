# Enterprise Intelligence AI

Organisation-wide AI knowledge platform: upload internal documents, then ask an assistant questions and get answers with citations, only from documents you are allowed to see.

> Development build. Uses synthetic data and a local backend only. See [docs/BRIEF.md](docs/BRIEF.md) for the full brief, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DECISIONS.md](docs/DECISIONS.md).

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Project foundation, app shell, local backend | Done |
| 2 | Database schema, invite-only auth, roles, security policies | Done |
| 3 | Knowledge library: upload, processing, versions, archiving, keyword search, document permissions | In review |
| 4–9 | AI retrieval, assistant, support module, admin, QA, deployment prep | Planned |

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

Accounts are invite-only: sign in as an admin, open **Administration**, and invite someone. Locally the invitation email lands in Mailpit (link below). The link opens the app's "set up your account" page. Run `npx supabase functions serve` in a second terminal so the `invite-member` and `upload-document` functions are available.

### Knowledge Library (local only)

Admins and Knowledge Managers can upload PDF, Word (.docx), text and Markdown files (max 20 MB). The `upload-document` function checks the file, stores it in a private bucket, extracts the text, splits it into passages and indexes them for keyword search. Employees only see indexed, non-archived documents shared with the whole organisation or with their department.

Load the synthetic sample documents from `samples/` (needs the functions running, see above):

```bash
npm run seed:documents
```

`samples/` is regenerated with `python3 scripts/make_samples.py` (needs `fpdf2` and `python-docx`). All sample content is fictional.

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
| `npm run db:types` | Regenerate `src/types/database.ts` from the local database |
| `npm run db:start` / `db:stop` / `db:status` / `db:reset` | Manage the local Supabase stack |

Local Supabase Studio (database UI): http://127.0.0.1:54323. Local email inbox (Mailpit): http://127.0.0.1:54324.
