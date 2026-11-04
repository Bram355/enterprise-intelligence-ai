-- Knowledge library permission tests. Run with: npm run test:db
begin;
select plan(22);

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

-- Users: northwind admin c001, knowledge manager c002, employee c003 (Technical Support),
-- finance employee c004 (Finance); contoso admin c005.
-- Start from an empty library (rolled back at the end) so documents loaded by `npm run seed:documents` don't affect results.
delete from public.documents;
-- Fixture documents (created as postgres, like the upload function does with the service role).
insert into public.documents (id, organisation_id, title, visibility, status, current_version, tags) values
  ('10000000-0000-4000-e000-000000000001', '00000000-0000-4000-a000-000000000001', 'Org-wide handbook', 'organisation', 'indexed', 1, '{}'),
  ('10000000-0000-4000-e000-000000000002', '00000000-0000-4000-a000-000000000001', 'Finance only', 'departments', 'indexed', 1, '{}'),
  ('10000000-0000-4000-e000-000000000003', '00000000-0000-4000-a000-000000000001', 'Still processing', 'organisation', 'processing', 0, '{}'),
  ('10000000-0000-4000-e000-000000000004', '00000000-0000-4000-a000-000000000001', 'Archived guide', 'organisation', 'indexed', 1, '{}'),
  ('10000000-0000-4000-e000-000000000005', '00000000-0000-4000-a000-000000000002', 'Contoso secret', 'organisation', 'indexed', 1, '{}');
update public.documents set archived_at = now() where id = '10000000-0000-4000-e000-000000000004';
insert into public.document_departments (document_id, department_id, organisation_id) values
  ('10000000-0000-4000-e000-000000000002', '00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000001');
insert into public.document_versions (id, document_id, organisation_id, version, storage_path, file_name, mime_type, size_bytes, sha256, status) values
  ('20000000-0000-4000-e000-000000000001', '10000000-0000-4000-e000-000000000001', '00000000-0000-4000-a000-000000000001', 1, 'nw/1/v1-a.txt', 'a.txt', 'text/plain', 10, 'x', 'indexed'),
  ('20000000-0000-4000-e000-000000000002', '10000000-0000-4000-e000-000000000002', '00000000-0000-4000-a000-000000000001', 1, 'nw/2/v1-b.txt', 'b.txt', 'text/plain', 10, 'x', 'indexed'),
  ('20000000-0000-4000-e000-000000000005', '10000000-0000-4000-e000-000000000005', '00000000-0000-4000-a000-000000000002', 1, 'co/5/v1-c.txt', 'c.txt', 'text/plain', 10, 'x', 'indexed');
insert into public.document_chunks (organisation_id, document_id, version_id, chunk_index, content) values
  ('00000000-0000-4000-a000-000000000001', '10000000-0000-4000-e000-000000000001', '20000000-0000-4000-e000-000000000001', 0, 'Zebracorn onboarding steps for every employee'),
  ('00000000-0000-4000-a000-000000000001', '10000000-0000-4000-e000-000000000002', '20000000-0000-4000-e000-000000000002', 0, 'Zebracorn payroll budget figures'),
  ('00000000-0000-4000-a000-000000000002', '10000000-0000-4000-e000-000000000005', '20000000-0000-4000-e000-000000000005', 0, 'Zebracorn contoso confidential plans');

-- Employee in Technical Support
select pg_temp.login('00000000-0000-4000-c000-000000000003');
select results_eq($$ select title from public.documents order by title $$, array['Org-wide handbook'],
  'support employee sees only indexed, non-archived, org-wide documents');
select is((select count(*) from public.document_chunks where document_id = '10000000-0000-4000-e000-000000000002'), 0::bigint,
  'support employee cannot read chunks of a Finance-only document');
select is((select count(*) from public.document_versions where document_id = '10000000-0000-4000-e000-000000000002'), 0::bigint,
  'support employee cannot read versions of a Finance-only document');
select results_eq($$ select title from public.search_documents('zebracorn') $$, array['Org-wide handbook'],
  'search only returns documents the employee may read');
select throws_ok($$ insert into public.documents (organisation_id, title) values ('00000000-0000-4000-a000-000000000001', 'Rogue') $$,
  '42501', null, 'employees cannot create documents directly');
update public.documents set title = 'Hacked' where id = '10000000-0000-4000-e000-000000000001';
select throws_ok($$ insert into public.categories (organisation_id, name) values ('00000000-0000-4000-a000-000000000001', 'Rogue') $$,
  '42501', null, 'employees cannot create categories');
select throws_ok($$ insert into public.document_departments (document_id, department_id, organisation_id)
  values ('10000000-0000-4000-e000-000000000002', '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001') $$,
  '42501', null, 'employees cannot share a restricted document with their own department');
select throws_ok($$ insert into public.document_chunks (organisation_id, document_id, version_id, chunk_index, content)
  values ('00000000-0000-4000-a000-000000000001', '10000000-0000-4000-e000-000000000001', '20000000-0000-4000-e000-000000000001', 9, 'injected') $$,
  '42501', null, 'nobody can write chunks from the browser');
select pg_temp.logout();
select is((select title from public.documents where id = '10000000-0000-4000-e000-000000000001'), 'Org-wide handbook',
  'employee update of a document has no effect');

-- Finance employee
select pg_temp.login('00000000-0000-4000-c000-000000000004');
select results_eq($$ select title from public.documents order by title $$, array['Finance only', 'Org-wide handbook'],
  'finance employee also sees the Finance-only document');
select is((select count(*) from public.search_documents('payroll')), 1::bigint, 'finance employee can search the Finance document');

-- Knowledge manager
select pg_temp.login('00000000-0000-4000-c000-000000000002');
select is((select count(*) from public.documents), 4::bigint, 'knowledge manager sees every Northwind document, including archived and processing');
select lives_ok($$ update public.documents set title = 'Org-wide handbook v2', tags = array[' HR ', 'hr', 'Policies'] where id = '10000000-0000-4000-e000-000000000001' $$,
  'knowledge manager can edit document details');
select is((select tags from public.documents where id = '10000000-0000-4000-e000-000000000001'), array['hr', 'policies'],
  'tags are trimmed, lower-cased and de-duplicated');
select throws_ok($$ update public.documents set status = 'indexed' where id = '10000000-0000-4000-e000-000000000003' $$,
  '42501', null, 'processing status cannot be changed from the browser');
select throws_ok($$ update public.documents set organisation_id = '00000000-0000-4000-a000-000000000002' where id = '10000000-0000-4000-e000-000000000001' $$,
  '42501', null, 'documents cannot be moved to another organisation');
select lives_ok($$ update public.documents set archived_at = now() where id = '10000000-0000-4000-e000-000000000001' $$,
  'knowledge manager can archive a document');
select is((select count(*) from public.search_documents('onboarding')), 0::bigint, 'archived documents drop out of search');
select pg_temp.logout();
select ok(exists (select 1 from public.audit_log where action = 'document.archived' and target_id = '10000000-0000-4000-e000-000000000001'),
  'archiving is recorded in the audit log');

-- Other organisation
select pg_temp.login('00000000-0000-4000-c000-000000000005');
select results_eq($$ select title from public.documents $$, array['Contoso secret'], 'contoso admin sees only Contoso documents');
select is((select count(*) from public.search_documents('zebracorn')), 1::bigint, 'contoso search never returns Northwind content');

-- Anonymous
select pg_temp.logout();
set local role anon;
select throws_ok($$ select * from public.search_documents('zebracorn') $$, '42501', null, 'anonymous visitors cannot search');

select * from finish();
rollback;
