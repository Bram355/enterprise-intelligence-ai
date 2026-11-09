-- Phase 5: conversations, follow-up questions, clarifying questions and answer feedback.

alter type public.ai_query_status add value if not exists 'needs_clarification';

-- Conversations are private to the person who asked. They are created by the
-- ask-question function; members can list, rename and delete their own.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;
grant select, delete on public.conversations to authenticated;
grant update (title) on public.conversations to authenticated;

create policy "Members manage their own conversations"
  on public.conversations for all to authenticated
  using (user_id = (select auth.uid()) and organisation_id = (select private.current_org_id()))
  with check (user_id = (select auth.uid()) and organisation_id = (select private.current_org_id()));

-- Deleting a conversation keeps the audit log of questions; it only unlinks them.
alter table public.ai_queries
  add column conversation_id uuid references public.conversations (id) on delete set null,
  add column search_query text check (char_length(search_query) <= 1000);

create index ai_queries_conversation_idx on public.ai_queries (conversation_id, created_at);

create type public.feedback_rating as enum ('helpful', 'not_helpful');

create table public.answer_feedback (
  query_id uuid primary key references public.ai_queries (id) on delete cascade,
  organisation_id uuid not null default private.current_org_id() references public.organisations (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating public.feedback_rating not null,
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index answer_feedback_org_created_idx on public.answer_feedback (organisation_id, created_at desc);

alter table public.answer_feedback enable row level security;
revoke all on public.answer_feedback from anon, authenticated;
grant select, insert on public.answer_feedback to authenticated;
grant update (rating, comment, updated_at) on public.answer_feedback to authenticated;

create policy "Members read their own feedback; admins read their organisation's"
  on public.answer_feedback for select to authenticated
  using (
    (user_id = (select auth.uid()) and organisation_id = (select private.current_org_id()))
    or (select private.is_org_admin(organisation_id))
  );

-- Feedback only on your own answered (not failed) questions.
create policy "Members rate their own answers"
  on public.answer_feedback for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and organisation_id = (select private.current_org_id())
    and exists (
      select 1 from public.ai_queries q
      where q.id = query_id and q.user_id = (select auth.uid()) and q.status <> 'failed'
    )
  );

create policy "Members change their own feedback"
  on public.answer_feedback for update to authenticated
  using (user_id = (select auth.uid()) and organisation_id = (select private.current_org_id()))
  with check (user_id = (select auth.uid()) and organisation_id = (select private.current_org_id()));
