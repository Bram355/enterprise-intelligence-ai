-- Permission-aware retrieval and AI query log tests. Run with: npm run test:db
begin;
select plan(14);

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.vec(x real) returns extensions.vector language sql as $$
  select array_fill(x, array[1024])::extensions.vector
$$;

-- Same fixtures as documents.test.sql, plus embeddings. Users: northwind admin c001, KM c002,
-- support employee c003, finance employee c004; contoso admin c005.
delete from public.documents;
delete from public.ai_queries;
insert into public.documents (id, organisation_id, title, visibility, status, current_version) values
  ('10000000-0000-4000-e000-000000000001', '00000000-0000-4000-a000-000000000001', 'Org-wide handbook', 'organisation', 'indexed', 1),
  ('10000000-0000-4000-e000-000000000002', '00000000-0000-4000-a000-000000000001', 'Finance only', 'departments', 'indexed', 1),
  ('10000000-0000-4000-e000-000000000003', '00000000-0000-4000-a000-000000000001', 'Failed upload', 'organisation', 'failed', 1),
  ('10000000-0000-4000-e000-000000000004', '00000000-0000-4000-a000-000000000001', 'Archived guide', 'organisation', 'indexed', 1),
  ('10000000-0000-4000-e000-000000000005', '00000000-0000-4000-a000-000000000002', 'Contoso secret', 'organisation', 'indexed', 1);
update public.documents set archived_at = now() where id = '10000000-0000-4000-e000-000000000004';
insert into public.document_departments (document_id, department_id, organisation_id) values
  ('10000000-0000-4000-e000-000000000002', '00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000001');
insert into public.document_versions (id, document_id, organisation_id, version, storage_path, file_name, mime_type, size_bytes, sha256, status)
select ('20000000-0000-4000-e000-00000000000' || n)::uuid, ('10000000-0000-4000-e000-00000000000' || n)::uuid,
  case when n = 5 then '00000000-0000-4000-a000-000000000002'::uuid else '00000000-0000-4000-a000-000000000001'::uuid end,
  1, 'x/' || n, 'f.txt', 'text/plain', 10, 'x', 'indexed'
from generate_series(1, 5) n;
insert into public.document_chunks (organisation_id, document_id, version_id, chunk_index, content, embedding, embedding_model)
select v.organisation_id, v.document_id, v.id, 0, 'Quokkaflux procedure for ' || d.title, pg_temp.vec(0.1), 'test'
from public.document_versions v join public.documents d on d.id = v.document_id;
-- A passage without an embedding is still found by keywords.
insert into public.document_chunks (organisation_id, document_id, version_id, chunk_index, content)
values ('00000000-0000-4000-a000-000000000001', '10000000-0000-4000-e000-000000000001', '20000000-0000-4000-e000-000000000001', 1, 'Platypus escalation rota');

select pg_temp.login('00000000-0000-4000-c000-000000000003');
select results_eq($$ select distinct title from public.match_chunks(pg_temp.vec(0.1), 'quokkaflux', 20) order by 1 $$,
  $$ values ('Org-wide handbook') $$, 'support employee retrieves only org-wide passages, never Finance-only');
select is((select count(*) from public.match_chunks(pg_temp.vec(0.1), '', 20) where document_id = '10000000-0000-4000-e000-000000000002'), 0::bigint,
  'meaning-only search also excludes the Finance-only document');
select results_eq($$ select title from public.match_chunks(null, 'platypus escalation', 5) $$,
  $$ values ('Org-wide handbook') $$, 'keyword-only match works without embeddings');
select is((select count(*) from public.match_chunks(pg_temp.vec(-0.1), 'nothing relevant', 5, 0.5)), 0::bigint,
  'min_similarity filters out unrelated passages');

select pg_temp.login('00000000-0000-4000-c000-000000000004');
select results_eq($$ select distinct title from public.match_chunks(pg_temp.vec(0.1), 'quokkaflux', 20) order by 1 $$,
  $$ values ('Finance only'), ('Org-wide handbook') $$, 'finance employee also retrieves the Finance-only passage');

select pg_temp.login('00000000-0000-4000-c000-000000000002');
select results_eq($$ select distinct title from public.match_chunks(pg_temp.vec(0.1), 'quokkaflux', 20) order by 1 $$,
  $$ values ('Finance only'), ('Org-wide handbook') $$, 'knowledge manager retrieval skips archived and failed documents');

select pg_temp.login('00000000-0000-4000-c000-000000000005');
select results_eq($$ select distinct title from public.match_chunks(pg_temp.vec(0.1), 'quokkaflux', 20) $$,
  $$ values ('Contoso secret') $$, 'contoso admin retrieves only Contoso passages');

select pg_temp.logout();
set local role anon;
select throws_ok($$ select * from public.match_chunks(null, 'quokkaflux') $$, '42501', null, 'anonymous users cannot run retrieval');
select pg_temp.logout();

-- AI query log
insert into public.ai_queries (organisation_id, user_id, question, status, provider, model) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000003', 'support question', 'answered', 'mock', 'm'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000004', 'finance question', 'no_answer', 'mock', 'm'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-c000-000000000005', 'contoso question', 'answered', 'mock', 'm');

select pg_temp.login('00000000-0000-4000-c000-000000000003');
select results_eq($$ select question from public.ai_queries $$, $$ values ('support question') $$, 'members see only their own questions');
select throws_ok($$ insert into public.ai_queries (organisation_id, user_id, question, status, provider, model)
  values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000003', 'forged', 'answered', 'x', 'x') $$,
  '42501', null, 'members cannot write to the AI query log');
select throws_ok($$ update public.ai_queries set answer = 'tampered' $$, '42501', null, 'members cannot edit the AI query log');

select pg_temp.login('00000000-0000-4000-c000-000000000002');
select is((select count(*) from public.ai_queries), 0::bigint, 'knowledge managers do not see other people''s questions');

select pg_temp.login('00000000-0000-4000-c000-000000000001');
select results_eq($$ select question from public.ai_queries order by 1 $$, $$ values ('finance question'), ('support question') $$,
  'admins see their organisation''s questions only');

select pg_temp.login('00000000-0000-4000-c000-000000000005');
select results_eq($$ select question from public.ai_queries $$, $$ values ('contoso question') $$, 'other organisation sees only its own log');

select * from finish();
rollback;
