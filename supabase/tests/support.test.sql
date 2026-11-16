-- Technical support case access tests. Run with: npm run test:db
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

-- Users: northwind admin c001, support employee c003, finance employee c004; contoso admin c005.
delete from public.support_cases;
insert into public.support_cases (id, organisation_id, user_id, category, title, problem, provider, model) values
  ('50000000-0000-4000-f000-000000000003', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000003', 'webhooks', 'Webhook 401', 'Webhook signatures fail in live', 'mock', 'm'),
  ('50000000-0000-4000-f000-000000000004', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000004', 'payments', 'Payout late', 'Payout has not arrived after 4 days', 'mock', 'm'),
  ('50000000-0000-4000-f000-000000000005', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-c000-000000000005', 'pos_terminal', 'Till offline', 'The till terminal shows offline', 'mock', 'm');
insert into public.support_case_steps (case_id, position, action, expected) values
  ('50000000-0000-4000-f000-000000000003', 1, 'Compute the signature over the raw body', 'Signatures match'),
  ('50000000-0000-4000-f000-000000000004', 1, 'Check the settlement date', 'Payout is within T+3');

select pg_temp.login('00000000-0000-4000-c000-000000000003');
select results_eq($$ select title from public.support_cases $$, $$ values ('Webhook 401') $$,
  'members see only their own cases');
select results_eq($$ select action from public.support_case_steps $$, $$ values ('Compute the signature over the raw body') $$,
  'members see only the steps of their own cases');
update public.support_case_steps set outcome = 'not_fixed' where case_id = '50000000-0000-4000-f000-000000000003';
update public.support_cases set status = 'escalated' where id = '50000000-0000-4000-f000-000000000003';
update public.support_case_steps set outcome = 'fixed' where case_id = '50000000-0000-4000-f000-000000000004';
update public.support_cases set status = 'resolved' where id = '50000000-0000-4000-f000-000000000004';
select throws_ok($$ update public.support_case_steps set action = 'Do something else' $$,
  '42501', null, 'members cannot rewrite diagnostic steps');
select throws_ok($$ update public.support_cases set summary = 'Forged' $$,
  '42501', null, 'members cannot rewrite the diagnosis');
select throws_ok($$ insert into public.support_cases (organisation_id, user_id, category, title, problem, provider, model) values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000003', 'other', 'x', 'made up problem', 'mock', 'm') $$,
  '42501', null, 'cases are only created by the server');
select throws_ok($$ delete from public.support_cases $$, '42501', null, 'members cannot delete cases');
select pg_temp.logout();

select is((select outcome::text from public.support_case_steps where case_id = '50000000-0000-4000-f000-000000000003'), 'not_fixed',
  'members record outcomes on their own steps');
select ok((select status = 'escalated' and closed_at is not null from public.support_cases where id = '50000000-0000-4000-f000-000000000003'),
  'escalating a case stamps closed_at');
select is((select outcome::text from public.support_case_steps where case_id = '50000000-0000-4000-f000-000000000004'), 'pending',
  'members cannot record outcomes on someone else''s case');
select is((select status::text from public.support_cases where id = '50000000-0000-4000-f000-000000000004'), 'open',
  'members cannot close someone else''s case');

select pg_temp.login('00000000-0000-4000-c000-000000000001');
select results_eq($$ select title from public.support_cases order by title $$, $$ values ('Payout late'), ('Webhook 401') $$,
  'admins see their organisation''s cases only');
update public.support_cases set status = 'resolved' where id = '50000000-0000-4000-f000-000000000004';
select pg_temp.logout();
select is((select status::text from public.support_cases where id = '50000000-0000-4000-f000-000000000004'), 'open',
  'admins can read but not change members'' cases');

select pg_temp.login('00000000-0000-4000-c000-000000000005');
select results_eq($$ select title from public.support_cases $$, $$ values ('Till offline') $$,
  'other organisations never see Northwind cases');
select pg_temp.logout();

set local role anon;
select throws_ok($$ select * from public.support_cases $$, '42501', null, 'anonymous users cannot read cases');

select * from finish();
rollback;
