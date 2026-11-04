-- Row Level Security tests. Run with: npm run test:db (local Supabase must be running).
begin;
select plan(20);

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

-- Seeded users (see supabase/seed.sql)
-- northwind admin ...c001, knowledge manager ...c002, employee ...c003, finance ...c004; contoso admin ...c005

-- Employee
select pg_temp.login('00000000-0000-4000-c000-000000000003');
select is((select count(*) from public.profiles where organisation_id <> '00000000-0000-4000-a000-000000000001'), 0::bigint, 'employee sees only their organisation''s members');
select is((select count(*) from public.organisations), 1::bigint, 'employee sees only their own organisation');
select is((select count(*) from public.departments), 4::bigint, 'employee sees only their organisation''s departments');
select is((select count(*) from public.invitations), 0::bigint, 'employee cannot read invitations');
select is((select count(*) from public.audit_log), 0::bigint, 'employee cannot read the audit log');
select throws_ok($$ update public.profiles set role = 'admin' where id = '00000000-0000-4000-c000-000000000003' $$,
  '42501', null, 'employee cannot change their own role');
select throws_ok($$ update public.profiles set organisation_id = '00000000-0000-4000-a000-000000000002' where id = auth.uid() $$,
  '42501', null, 'employee cannot move to another organisation');
select lives_ok($$ update public.profiles set full_name = 'Eli Renamed' where id = auth.uid() $$,
  'employee can update their own name');
update public.profiles set full_name = 'Hacked' where id = '00000000-0000-4000-c000-000000000001';
select pg_temp.logout();
select is((select full_name from public.profiles where id = '00000000-0000-4000-c000-000000000001'), 'Alex Admin',
  'employee cannot rename another member');
select is((select full_name from public.profiles where id = '00000000-0000-4000-c000-000000000003'), 'Eli Renamed',
  'own name change was saved');

select pg_temp.login('00000000-0000-4000-c000-000000000003');
select throws_ok($$ insert into public.departments (organisation_id, name) values ('00000000-0000-4000-a000-000000000001', 'Rogue') $$,
  '42501', null, 'employee cannot create departments');
select throws_ok($$ insert into public.invitations (organisation_id, email) values ('00000000-0000-4000-a000-000000000001', 'x@example.com') $$,
  '42501', null, 'employee cannot create invitations directly');

-- Admin of another organisation
select pg_temp.login('00000000-0000-4000-c000-000000000005');
select is((select count(*) from public.profiles where organisation_id = '00000000-0000-4000-a000-000000000001'), 0::bigint,
  'contoso admin cannot see northwind members');
select throws_ok($$ insert into public.departments (organisation_id, name) values ('00000000-0000-4000-a000-000000000001', 'Cross-org') $$,
  '42501', null, 'contoso admin cannot create departments in northwind');
update public.departments set name = 'Hijacked' where organisation_id = '00000000-0000-4000-a000-000000000001';
select pg_temp.logout();
select is((select count(*) from public.departments where name = 'Hijacked'), 0::bigint, 'contoso admin cannot rename northwind departments');

-- Admin of own organisation
select pg_temp.login('00000000-0000-4000-c000-000000000001');
select lives_ok($$ insert into public.departments (organisation_id, name) values ('00000000-0000-4000-a000-000000000001', 'Compliance') $$,
  'admin can create a department in their organisation');
select ok((select count(*) from public.audit_log where action = 'department.created') > 0, 'admin can read the audit log');

-- Deactivated member loses all access
select pg_temp.logout();
update public.profiles set is_active = false where id = '00000000-0000-4000-c000-000000000004';
select pg_temp.login('00000000-0000-4000-c000-000000000004');
select is((select count(*) from public.profiles), 0::bigint, 'deactivated member sees no data');

-- Invite-only sign-up
select pg_temp.logout();
select throws_ok($$ insert into auth.users (id, email, aud, role) values (gen_random_uuid(), 'stranger@example.com', 'authenticated', 'authenticated') $$,
  'P0001', 'Sign-up is by invitation only', 'accounts cannot be created without an invitation');

-- Anonymous visitors
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anonymous visitors cannot read profiles');

select * from finish();
rollback;
