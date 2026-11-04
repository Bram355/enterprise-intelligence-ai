-- Phase 4: semantic retrieval (pgvector), permission-aware hybrid search and an AI query log.
-- Retrieval runs with the caller's permissions (security invoker), so RLS decides which
-- passages can ever reach the AI.

create extension if not exists vector with schema extensions;

-- 1024 dimensions works with every provider we evaluated (OpenAI, Gemini, Voyage) and the mock.
alter table public.document_chunks
  add column embedding extensions.vector(1024),
  add column embedding_model text;

create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Hybrid search: meaning (cosine similarity) and keywords (full-text), merged with
-- reciprocal rank fusion. Only indexed, non-archived documents the caller may read.
create function public.match_chunks(
  query_embedding extensions.vector(1024),
  query_text text,
  match_count integer default 8,
  min_similarity real default 0
)
returns table (
  chunk_id bigint, document_id uuid, title text, category_name text, version integer,
  page integer, content text, similarity real, keyword_rank real, score double precision
)
language sql stable security invoker set search_path = ''
as $$
  -- Questions are natural language, so keywords are OR-ed (any word can match) and
  -- ranked by how many match, instead of requiring every word.
  with q as (
    select coalesce(
      (select to_tsquery('english', string_agg(quote_literal(lexeme), ' | '))
       from unnest(tsvector_to_array(to_tsvector('english', left(coalesce(query_text, ''), 500)))) as lexeme),
      ''::tsquery
    ) as query
  ),
  eligible as (
    select c.id, c.embedding, c.fts
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where d.archived_at is null and d.status = 'indexed'
  ),
  semantic as (
    select e.id,
      (1 - (e.embedding operator(extensions.<=>) query_embedding))::real as similarity,
      row_number() over (order by e.embedding operator(extensions.<=>) query_embedding) as r
    from eligible e
    where query_embedding is not null
      and e.embedding is not null
      and 1 - (e.embedding operator(extensions.<=>) query_embedding) >= coalesce(min_similarity, 0)
    order by e.embedding operator(extensions.<=>) query_embedding
    limit 50
  ),
  keyword as (
    select e.id, ts_rank(e.fts, q.query) as keyword_rank,
      row_number() over (order by ts_rank(e.fts, q.query) desc) as r
    from eligible e, q
    where e.fts @@ q.query
    order by 2 desc
    limit 50
  ),
  fused as (
    select coalesce(s.id, k.id) as id, s.similarity, k.keyword_rank,
      coalesce(1.0 / (60 + s.r), 0) + coalesce(1.0 / (60 + k.r), 0) as score
    from semantic s
    full join keyword k on k.id = s.id
  )
  select c.id, c.document_id, d.title, cat.name, v.version, c.page, c.content,
    f.similarity, f.keyword_rank, f.score::double precision
  from fused f
  join public.document_chunks c on c.id = f.id
  join public.documents d on d.id = c.document_id
  join public.document_versions v on v.id = c.version_id
  left join public.categories cat on cat.id = d.category_id
  order by f.score desc, c.chunk_index
  limit least(greatest(coalesce(match_count, 8), 1), 20)
$$;

revoke all on function public.match_chunks(extensions.vector, text, integer, real) from public, anon;
grant execute on function public.match_chunks(extensions.vector, text, integer, real) to authenticated;

-- ---------------------------------------------------------------------------
-- AI query log: every question, the passages used, the answer, model and cost
-- inputs. Written only by the ask-question Edge Function.
-- ---------------------------------------------------------------------------

create type public.ai_query_status as enum ('answered', 'no_answer', 'failed');

create table public.ai_queries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  question text not null check (char_length(question) between 1 and 1000),
  answer text,
  status public.ai_query_status not null,
  citations jsonb not null default '[]',
  chunk_ids bigint[] not null default '{}',
  provider text not null,
  model text not null,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  error text,
  created_at timestamptz not null default now()
);

create index ai_queries_user_created_idx on public.ai_queries (user_id, created_at desc);
create index ai_queries_org_created_idx on public.ai_queries (organisation_id, created_at desc);

alter table public.ai_queries enable row level security;
revoke all on public.ai_queries from anon, authenticated;
grant select on public.ai_queries to authenticated;

create policy "Members read their own questions; admins read their organisation's"
  on public.ai_queries for select to authenticated
  using (
    (user_id = (select auth.uid()) and organisation_id = (select private.current_org_id()))
    or (select private.is_org_admin(organisation_id))
  );
