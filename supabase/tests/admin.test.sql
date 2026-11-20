-- Phase 7 administration and analytics tests. Run with: npm run test:db
begin;
select plan(19);

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

-- Users: northwind admin c001, km c002, support employee c003, finance c004; contoso admin c005.
-- Departments: northwind support b001, finance b004; contoso b005.
insert into public.invitations (id, organisation_id, email, role) values
  ('70000000-0000-4000-f000-000000000001', '00000000-0000-4000-a000-000000000001', 'new.starter@northwind.test', 'employee');
-- Sending an invitation creates an unconfirmed auth user (and profile) straight away.
insert into auth.users (id, email, aud, role) values
  ('70000000-0000-4000-c000-000000000009', 'new.starter@northwind.test', 'authenticated', 'authenticated');

select pg_temp.login('00000000-0000-4000-c000-000000000001');
select lives_ok($$ select public.admin_update_member('00000000-0000-4000-c000-000000000004', 'knowledge_manager', '00000000-0000-4000-b000-000000000004', true) $$,
  'admins can change a member''s role and department');
select lives_ok($$ select public.admin_update_member('00000000-0000-4000-c000-000000000004', 'employee', '00000000-0000-4000-b000-000000000004', false) $$,
  'admins can deactivate a member');
select throws_ok($$ select public.admin_update_member('00000000-0000-4000-c000-000000000001', 'employee', null, true) $$,
  '42501', 'You can''t remove your own admin access', 'admins cannot demote themselves');
select throws_ok($$ select public.admin_update_member('00000000-0000-4000-c000-000000000001', 'admin', null, false) $$,
  '42501', 'You can''t remove your own admin access', 'admins cannot deactivate themselves');
select throws_ok($$ select public.admin_update_member('00000000-0000-4000-c000-000000000005', 'employee', null, true) $$,
  'P0002', 'Member not found', 'admins cannot change members of another organisation');
select throws_ok($$ select public.admin_update_member('00000000-0000-4000-c000-000000000003', 'employee', '00000000-0000-4000-b000-000000000005', true) $$,
  'P0002', 'Department not found', 'departments must belong to the organisation');
select lives_ok($$ select public.admin_revoke_invitation('70000000-0000-4000-f000-000000000001') $$, 'admins can revoke a pending invitation');
select throws_ok($$ select public.admin_revoke_invitation('70000000-0000-4000-f000-000000000001') $$,
  'P0002', 'Pending invitation not found', 'an invitation can only be revoked once');
select pg_temp.logout();
select ok(not exists (select 1 from auth.users where email = 'new.starter@northwind.test'),
  'revoking removes the unconfirmed account so the emailed link stops working');
select ok(not exists (select 1 from public.profiles where email = 'new.starter@northwind.test'),
  'revoking removes the pending profile');
select pg_temp.login('00000000-0000-4000-c000-000000000001');
select ok((select public.org_analytics(30) ? 'questions'), 'admins can read analytics');
select is((select (public.org_analytics(30) -> 'users' ->> 'total')::int),
  (select count(*)::int from public.profiles where organisation_id = '00000000-0000-4000-a000-000000000001'),
  'analytics count only the admin''s organisation');
select pg_temp.logout();

select results_eq($$ select role::text, is_active from public.profiles where id = '00000000-0000-4000-c000-000000000004' $$,
  $$ values ('employee', false) $$, 'member changes are saved');
select ok(exists (select 1 from public.audit_log where action = 'member.updated' and target_id = '00000000-0000-4000-c000-000000000004'),
  'member changes are audited');
select ok(exists (select 1 from public.audit_log where action = 'invitation.revoked'), 'revocations are audited');

-- Last admin: the contoso admin is the only one, so a second admin there cannot remove them.
select pg_temp.login('00000000-0000-4000-c000-000000000005');
select throws_ok($$ select public.admin_update_member('00000000-0000-4000-c000-000000000005', 'employee', null, true) $$,
  '42501', null, 'the last admin cannot lose admin access');
select pg_temp.logout();

select pg_temp.login('00000000-0000-4000-c000-000000000003');
select throws_ok($$ select public.admin_update_member('00000000-0000-4000-c000-000000000003', 'admin', null, true) $$,
  '42501', 'Only organisation admins can manage members', 'members cannot promote themselves');
select throws_ok($$ select public.org_analytics(30) $$, '42501', null, 'members cannot read analytics');
select pg_temp.logout();

set local role anon;
select throws_ok($$ select public.org_analytics(30) $$, '42501', null, 'anonymous users cannot read analytics');
reset role;

select * from finish();
rollback;
