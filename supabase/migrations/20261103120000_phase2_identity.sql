-- Phase 2: organisations, departments, member profiles, invitations, audit log.
-- Every table has Row Level Security; permissions are enforced here, not in the UI.

create type public.app_role as enum ('admin', 'knowledge_manager', 'employee');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (organisation_id, name),
  -- Target for composite foreign keys that guarantee same-organisation references.
  unique (id, organisation_id)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.app_role not null default 'employee',
  department_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (department_id, organisation_id)
    references public.departments (id, organisation_id) on delete set null (department_id)
);
create index profiles_organisation_idx on public.profiles (organisation_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.app_role not null default 'employee',
  department_id uuid,
  invited_by uuid references auth.users (id) on delete set null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  foreign key (department_id, organisation_id)
    references public.departments (id, organisation_id) on delete set null (department_id)
);
create unique index invitations_one_pending_per_email on public.invitations (email) where status = 'pending';
create index invitations_organisation_idx on public.invitations (organisation_id, created_at desc);
create index invitations_invited_by_idx on public.invitations (invited_by, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organisation_id uuid references public.organisations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_organisation_idx on public.audit_log (organisation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Private helpers (not exposed through the API)
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Organisation of the signed-in user; null when signed out or deactivated.
create function private.current_org_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.organisation_id from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create function private.is_org_admin(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin' and p.organisation_id = org
  )
$$;

revoke all on function private.current_org_id() from public;
revoke all on function private.is_org_admin(uuid) from public;
grant execute on function private.current_org_id() to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;

create function private.write_audit(
  p_organisation_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_details jsonb default '{}'::jsonb,
  p_actor_id uuid default auth.uid()
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (organisation_id, actor_id, action, target_type, target_id, details)
  values (p_organisation_id, p_actor_id, p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb))
$$;
revoke all on function private.write_audit(uuid, text, text, text, jsonb, uuid) from public;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Invite-only: an auth user can only be created for an email with a pending,
-- unexpired invitation. The invitation decides organisation, role and department.
create function private.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invitations;
begin
  select * into inv
  from public.invitations i
  where i.email = lower(new.email) and i.status = 'pending' and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  if not found then
    raise exception 'Sign-up is by invitation only' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, organisation_id, email, full_name, role, department_id)
  values (
    new.id,
    inv.organisation_id,
    lower(new.email),
    left(coalesce(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    inv.role,
    inv.department_id
  );

  if new.email_confirmed_at is not null then
    update public.invitations set status = 'accepted', accepted_at = now() where id = inv.id;
    perform private.write_audit(inv.organisation_id, 'member.joined', 'profile', new.id::text,
      jsonb_build_object('email', lower(new.email)), new.id);
  end if;

  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Accepting an invitation link confirms the email; mark the invitation accepted.
create function private.handle_auth_user_confirmed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  update public.invitations
  set status = 'accepted', accepted_at = now()
  where email = lower(new.email) and status = 'pending'
  returning organisation_id into v_org;

  if v_org is not null then
    perform private.write_audit(v_org, 'member.joined', 'profile', new.id::text,
      jsonb_build_object('email', lower(new.email)), new.id);
  end if;
  return new;
end
$$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.handle_auth_user_confirmed();

create function private.audit_profile_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     or new.department_id is distinct from old.department_id
     or new.is_active is distinct from old.is_active then
    perform private.write_audit(new.organisation_id, 'member.updated', 'profile', new.id::text,
      jsonb_build_object(
        'role', jsonb_build_object('from', old.role, 'to', new.role),
        'department_id', jsonb_build_object('from', old.department_id, 'to', new.department_id),
        'is_active', jsonb_build_object('from', old.is_active, 'to', new.is_active)
      ));
  end if;
  return new;
end
$$;

create trigger profiles_audit_change
  after update on public.profiles
  for each row execute function private.audit_profile_change();

create function private.audit_department_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.write_audit(old.organisation_id, 'department.deleted', 'department', old.id::text,
      jsonb_build_object('name', old.name));
    return old;
  end if;
  perform private.write_audit(new.organisation_id,
    case tg_op when 'INSERT' then 'department.created' else 'department.updated' end,
    'department', new.id::text, jsonb_build_object('name', new.name));
  return new;
end
$$;

create trigger departments_audit_change
  after insert or update or delete on public.departments
  for each row execute function private.audit_department_change();

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.organisations, public.departments, public.profiles, public.invitations, public.audit_log
  from anon, authenticated;

grant select on public.organisations to authenticated;
grant select, insert, update, delete on public.departments to authenticated;
grant select on public.profiles to authenticated;
-- Members may only edit their own display name; role, department and status change via admin tools.
grant update (full_name) on public.profiles to authenticated;
grant select on public.invitations to authenticated;
grant select on public.audit_log to authenticated;

create policy "Members read their organisation"
  on public.organisations for select to authenticated
  using (id = (select private.current_org_id()));

create policy "Members read departments in their organisation"
  on public.departments for select to authenticated
  using (organisation_id = (select private.current_org_id()));

create policy "Admins create departments"
  on public.departments for insert to authenticated
  with check ((select private.is_org_admin(organisation_id)));

create policy "Admins update departments"
  on public.departments for update to authenticated
  using ((select private.is_org_admin(organisation_id)))
  with check ((select private.is_org_admin(organisation_id)));

create policy "Admins delete departments"
  on public.departments for delete to authenticated
  using ((select private.is_org_admin(organisation_id)));

create policy "Members read profiles in their organisation"
  on public.profiles for select to authenticated
  using (organisation_id = (select private.current_org_id()));

create policy "Members update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and organisation_id = (select private.current_org_id()))
  with check (id = (select auth.uid()));

create policy "Admins read invitations"
  on public.invitations for select to authenticated
  using ((select private.is_org_admin(organisation_id)));

create policy "Admins read the audit log"
  on public.audit_log for select to authenticated
  using ((select private.is_org_admin(organisation_id)));
