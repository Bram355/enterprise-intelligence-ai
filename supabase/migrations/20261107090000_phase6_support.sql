-- Phase 6: technical support cases. The troubleshoot function (service role) creates a case
-- with its diagnosis and steps; owners record step outcomes and close or escalate the case.

create type public.support_category as enum ('api_auth', 'http_errors', 'payments', 'pos_terminal', 'webhooks', 'sdk_plugins', 'other');
create type public.support_case_status as enum ('open', 'resolved', 'escalated');
create type public.step_outcome as enum ('pending', 'fixed', 'not_fixed', 'skipped');

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  query_id uuid references public.ai_queries (id) on delete set null,
  category public.support_category not null,
  title text not null check (char_length(title) between 1 and 120),
  problem text not null check (char_length(problem) between 10 and 2000),
  error_code text check (char_length(error_code) <= 40),
  environment text not null default 'unknown' check (environment in ('sandbox', 'live', 'unknown')),
  status public.support_case_status not null default 'open',
  summary text,
  causes jsonb not null default '[]'::jsonb,
  escalation jsonb,
  sources jsonb not null default '[]'::jsonb,
  provider text not null,
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index support_cases_user_updated_idx on public.support_cases (user_id, updated_at desc);
create index support_cases_org_updated_idx on public.support_cases (organisation_id, updated_at desc);

create table public.support_case_steps (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.support_cases (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  action text not null check (char_length(action) between 1 and 1000),
  expected text check (char_length(expected) <= 1000),
  citations smallint[] not null default '{}',
  outcome public.step_outcome not null default 'pending',
  updated_at timestamptz not null default now(),
  unique (case_id, position)
);

create trigger support_cases_updated_at before update on public.support_cases
  for each row execute function private.set_updated_at();
create trigger support_case_steps_updated_at before update on public.support_case_steps
  for each row execute function private.set_updated_at();

-- Closing a case stamps closed_at; reopening clears it.
create function private.stamp_support_case_closed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.closed_at := case when new.status = 'open' then null else now() end;
  end if;
  return new;
end $$;

create trigger support_cases_closed_at before update of status on public.support_cases
  for each row execute function private.stamp_support_case_closed();

-- Step outcomes bump the case so recently worked cases sort first.
create function private.touch_support_case() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.support_cases set updated_at = now() where id = new.case_id;
  return new;
end $$;

create trigger support_case_steps_touch_case after update of outcome on public.support_case_steps
  for each row execute function private.touch_support_case();

alter table public.support_cases enable row level security;
alter table public.support_case_steps enable row level security;
revoke all on public.support_cases, public.support_case_steps from anon, authenticated;
grant select on public.support_cases, public.support_case_steps to authenticated;
grant update (status) on public.support_cases to authenticated;
grant update (outcome) on public.support_case_steps to authenticated;

create policy "Members read their own cases; admins read their organisation's"
  on public.support_cases for select to authenticated
  using (
    (user_id = (select auth.uid()) and organisation_id = (select private.current_org_id()))
    or (select private.is_org_admin(organisation_id))
  );

create policy "Members update their own cases"
  on public.support_cases for update to authenticated
  using (user_id = (select auth.uid()) and organisation_id = (select private.current_org_id()))
  with check (user_id = (select auth.uid()) and organisation_id = (select private.current_org_id()));

create policy "Steps follow their case"
  on public.support_case_steps for select to authenticated
  using (exists (select 1 from public.support_cases c where c.id = case_id));

create policy "Members record outcomes on their own cases"
  on public.support_case_steps for update to authenticated
  using (exists (
    select 1 from public.support_cases c
    where c.id = case_id and c.user_id = (select auth.uid()) and c.organisation_id = (select private.current_org_id())
  ))
  with check (exists (
    select 1 from public.support_cases c
    where c.id = case_id and c.user_id = (select auth.uid()) and c.organisation_id = (select private.current_org_id())
  ));
