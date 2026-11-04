-- Phase 3: knowledge library — documents, versions, chunks, categories, department visibility,
-- full-text search and private file storage. All access is enforced with RLS.

create type public.document_status as enum ('uploaded', 'processing', 'indexed', 'failed');
create type public.document_visibility as enum ('organisation', 'departments');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (organisation_id, name),
  unique (id, organisation_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  category_id uuid,
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  visibility public.document_visibility not null default 'organisation',
  status public.document_status not null default 'uploaded',
  current_version integer not null default 0,
  processing_error text,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organisation_id),
  foreign key (category_id, organisation_id)
    references public.categories (id, organisation_id) on delete set null (category_id)
);
create index documents_organisation_idx on public.documents (organisation_id);

create table public.document_departments (
  document_id uuid not null,
  department_id uuid not null,
  organisation_id uuid not null,
  primary key (document_id, department_id),
  foreign key (document_id, organisation_id) references public.documents (id, organisation_id) on delete cascade,
  foreign key (department_id, organisation_id) references public.departments (id, organisation_id) on delete cascade
);
create index document_departments_department_idx on public.document_departments (department_id);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  organisation_id uuid not null,
  version integer not null check (version > 0),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  sha256 text not null,
  status public.document_status not null default 'uploaded',
  error text,
  char_count integer,
  chunk_count integer,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (document_id, version),
  unique (id, organisation_id),
  foreign key (document_id, organisation_id) references public.documents (id, organisation_id) on delete cascade
);
create index document_versions_uploaded_by_idx on public.document_versions (uploaded_by, created_at);

create table public.document_chunks (
  id bigint generated always as identity primary key,
  organisation_id uuid not null,
  document_id uuid not null,
  version_id uuid not null,
  chunk_index integer not null,
  page integer,
  content text not null,
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  unique (version_id, chunk_index),
  foreign key (document_id, organisation_id) references public.documents (id, organisation_id) on delete cascade,
  foreign key (version_id, organisation_id) references public.document_versions (id, organisation_id) on delete cascade
);
create index document_chunks_fts_idx on public.document_chunks using gin (fts);
create index document_chunks_document_idx on public.document_chunks (document_id);

-- ---------------------------------------------------------------------------
-- Access helpers (private schema, not exposed through the API)
-- ---------------------------------------------------------------------------

create function private.can_manage_documents(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.organisation_id = org
      and p.role in ('admin', 'knowledge_manager')
  )
$$;

-- Admins and knowledge managers see every document in their organisation.
-- Employees see indexed, non-archived documents shared with the whole organisation
-- or with their own department.
create function private.can_read_document(doc uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.documents d
    join public.profiles p on p.id = auth.uid() and p.is_active and p.organisation_id = d.organisation_id
    where d.id = doc
      and (
        p.role in ('admin', 'knowledge_manager')
        or (
          d.archived_at is null
          and d.status = 'indexed'
          and (
            d.visibility = 'organisation'
            or exists (
              select 1 from public.document_departments dd
              where dd.document_id = d.id and dd.department_id = p.department_id
            )
          )
        )
      )
  )
$$;

-- Storage paths look like <organisation_id>/<document_id>/<file>.
create function private.storage_document_id(object_name text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 2)::uuid
  end
$$;

revoke all on function private.can_manage_documents(uuid) from public;
revoke all on function private.can_read_document(uuid) from public;
revoke all on function private.storage_document_id(text) from public;
grant execute on function private.can_manage_documents(uuid) to authenticated;
grant execute on function private.can_read_document(uuid) to authenticated;
grant execute on function private.storage_document_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function private.set_updated_at();

create function private.normalise_document_tags()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.tags := coalesce(
    (select array_agg(distinct t order by t)
     from (select lower(btrim(x)) as t from unnest(new.tags) as x) s
     where t <> ''),
    '{}'
  );
  if exists (select 1 from unnest(new.tags) as t where char_length(t) > 40) then
    raise exception 'Tags must be 40 characters or fewer' using errcode = '22023';
  end if;
  return new;
end
$$;

create trigger documents_normalise_tags
  before insert or update of tags on public.documents
  for each row execute function private.normalise_document_tags();

create function private.audit_document_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  changed jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.write_audit(new.organisation_id, 'document.created', 'document', new.id::text,
      jsonb_build_object('title', new.title), coalesce(auth.uid(), new.created_by));
    return new;
  end if;

  if new.archived_at is distinct from old.archived_at then
    perform private.write_audit(new.organisation_id,
      case when new.archived_at is null then 'document.restored' else 'document.archived' end,
      'document', new.id::text, jsonb_build_object('title', new.title));
  end if;

  if new.title is distinct from old.title then changed := changed || jsonb_build_object('title', new.title); end if;
  if new.description is distinct from old.description then changed := changed || jsonb_build_object('description', true); end if;
  if new.category_id is distinct from old.category_id then changed := changed || jsonb_build_object('category_id', new.category_id); end if;
  if new.tags is distinct from old.tags then changed := changed || jsonb_build_object('tags', new.tags); end if;
  if new.visibility is distinct from old.visibility then changed := changed || jsonb_build_object('visibility', new.visibility); end if;
  if changed <> '{}'::jsonb then
    perform private.write_audit(new.organisation_id, 'document.updated', 'document', new.id::text, changed);
  end if;
  return new;
end
$$;

create trigger documents_audit_change
  after insert or update on public.documents
  for each row execute function private.audit_document_change();

create function private.audit_document_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.write_audit(new.organisation_id, 'document.version_uploaded', 'document', new.document_id::text,
    jsonb_build_object('version', new.version, 'file_name', new.file_name), coalesce(auth.uid(), new.uploaded_by));
  return new;
end
$$;

create trigger document_versions_audit_insert
  after insert on public.document_versions
  for each row execute function private.audit_document_version();

create function private.audit_document_departments()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  rec record := coalesce(new, old);
begin
  perform private.write_audit(rec.organisation_id,
    case when tg_op = 'INSERT' then 'document.department_added' else 'document.department_removed' end,
    'document', rec.document_id::text, jsonb_build_object('department_id', rec.department_id));
  return rec;
end
$$;

create trigger document_departments_audit
  after insert or delete on public.document_departments
  for each row execute function private.audit_document_departments();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.documents enable row level security;
alter table public.document_departments enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_chunks enable row level security;

revoke all on public.categories, public.documents, public.document_departments,
  public.document_versions, public.document_chunks from anon, authenticated;

grant select, insert, update, delete on public.categories to authenticated;
grant select on public.documents to authenticated;
grant update (title, description, category_id, tags, visibility, archived_at) on public.documents to authenticated;
grant select, insert, delete on public.document_departments to authenticated;
grant select on public.document_versions to authenticated;
grant select on public.document_chunks to authenticated;

create policy "Members read categories in their organisation"
  on public.categories for select to authenticated
  using (organisation_id = (select private.current_org_id()));
create policy "Document managers create categories"
  on public.categories for insert to authenticated
  with check ((select private.can_manage_documents(organisation_id)));
create policy "Document managers update categories"
  on public.categories for update to authenticated
  using ((select private.can_manage_documents(organisation_id)))
  with check ((select private.can_manage_documents(organisation_id)));
create policy "Document managers delete categories"
  on public.categories for delete to authenticated
  using ((select private.can_manage_documents(organisation_id)));

create policy "Permitted members read documents"
  on public.documents for select to authenticated
  using ((select private.can_read_document(id)));
create policy "Document managers update documents"
  on public.documents for update to authenticated
  using ((select private.can_manage_documents(organisation_id)))
  with check ((select private.can_manage_documents(organisation_id)));

create policy "Permitted members read document departments"
  on public.document_departments for select to authenticated
  using ((select private.can_read_document(document_id)));
create policy "Document managers share documents with departments"
  on public.document_departments for insert to authenticated
  with check ((select private.can_manage_documents(organisation_id)));
create policy "Document managers unshare documents from departments"
  on public.document_departments for delete to authenticated
  using ((select private.can_manage_documents(organisation_id)));

create policy "Permitted members read document versions"
  on public.document_versions for select to authenticated
  using ((select private.can_read_document(document_id)));

create policy "Permitted members read document chunks"
  on public.document_chunks for select to authenticated
  using ((select private.can_read_document(document_id)));

-- ---------------------------------------------------------------------------
-- Search (runs with the caller's permissions, so RLS filters the results)
-- ---------------------------------------------------------------------------

create function public.search_documents(search_query text, max_results integer default 20)
returns table (document_id uuid, title text, category_name text, snippet text, page integer, rank real)
language sql stable security invoker set search_path = ''
as $$
  with q as (
    select websearch_to_tsquery('english', left(coalesce(search_query, ''), 200)) as query
  ),
  hits as (
    select c.document_id, c.content, c.page, ts_rank(c.fts, q.query) as rank,
      row_number() over (partition by c.document_id order by ts_rank(c.fts, q.query) desc, c.chunk_index) as rn
    from public.document_chunks c, q
    where c.fts @@ q.query
  )
  select d.id, d.title, cat.name,
    ts_headline('english', h.content, q.query,
      'StartSel=⟦, StopSel=⟧, MaxWords=35, MinWords=12, MaxFragments=2, FragmentDelimiter= … '),
    h.page, h.rank
  from hits h
  join public.documents d on d.id = h.document_id
  left join public.categories cat on cat.id = d.category_id
  cross join q
  where h.rn = 1 and d.archived_at is null
  order by h.rank desc, d.title
  limit least(greatest(coalesce(max_results, 20), 1), 50)
$$;

revoke all on function public.search_documents(text, integer) from public, anon;
grant execute on function public.search_documents(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- File storage: private bucket. Uploads only happen through the upload-document
-- Edge Function (service role); members can download files they may read.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do nothing;

create policy "Permitted members download document files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (select private.can_read_document(private.storage_document_id(name)))
  );
