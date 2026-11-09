-- Conversation and answer feedback access tests. Run with: npm run test:db
begin;
select plan(15);

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
delete from public.ai_queries;
delete from public.conversations;
insert into public.conversations (id, organisation_id, user_id, title) values
  ('30000000-0000-4000-f000-000000000003', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000003', 'Support chat'),
  ('30000000-0000-4000-f000-000000000004', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000004', 'Finance chat'),
  ('30000000-0000-4000-f000-000000000005', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-c000-000000000005', 'Contoso chat');
insert into public.ai_queries (id, organisation_id, user_id, conversation_id, question, status, provider, model) values
  ('40000000-0000-4000-f000-000000000001', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000003', '30000000-0000-4000-f000-000000000003', 'support question', 'answered', 'mock', 'm'),
  ('40000000-0000-4000-f000-000000000002', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000004', '30000000-0000-4000-f000-000000000004', 'finance question', 'answered', 'mock', 'm'),
  ('40000000-0000-4000-f000-000000000003', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000003', '30000000-0000-4000-f000-000000000003', 'failed question', 'failed', 'mock', 'm'),
  ('40000000-0000-4000-f000-000000000005', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-c000-000000000005', '30000000-0000-4000-f000-000000000005', 'contoso question', 'needs_clarification', 'mock', 'm');

select pg_temp.login('00000000-0000-4000-c000-000000000003');
select results_eq($$ select title from public.conversations $$, $$ values ('Support chat') $$,
  'members see only their own conversations');
update public.conversations set title = 'Webhooks' where id = '30000000-0000-4000-f000-000000000003';
update public.conversations set title = 'Hijack' where id = '30000000-0000-4000-f000-000000000004';
select is((select title from public.conversations where id = '30000000-0000-4000-f000-000000000003'), 'Webhooks',
  'members can rename their own conversation');
select pg_temp.logout();
select is((select title from public.conversations where id = '30000000-0000-4000-f000-000000000004'), 'Finance chat',
  'members cannot rename someone else''s conversation');
select pg_temp.login('00000000-0000-4000-c000-000000000003');
select throws_ok($$ insert into public.conversations (organisation_id, user_id, title) values ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000003', 'x') $$,
  '42501', null, 'conversations are only created by the server');

select lives_ok($$ insert into public.answer_feedback (query_id, rating) values ('40000000-0000-4000-f000-000000000001', 'helpful') $$,
  'members can rate their own answer');
select results_eq($$ select user_id, organisation_id from public.answer_feedback $$,
  $$ values ('00000000-0000-4000-c000-000000000003'::uuid, '00000000-0000-4000-a000-000000000001'::uuid) $$,
  'feedback is stamped with the member and organisation automatically');
select lives_ok($$ update public.answer_feedback set rating = 'not_helpful', comment = 'Missing the retry steps', updated_at = now() where query_id = '40000000-0000-4000-f000-000000000001' $$,
  'members can change their feedback');
select throws_ok($$ insert into public.answer_feedback (query_id, rating) values ('40000000-0000-4000-f000-000000000002', 'not_helpful') $$,
  '42501', null, 'members cannot rate someone else''s answer');
select throws_ok($$ insert into public.answer_feedback (query_id, rating) values ('40000000-0000-4000-f000-000000000003', 'helpful') $$,
  '42501', null, 'failed questions cannot be rated');
select throws_ok($$ insert into public.answer_feedback (query_id, user_id, rating) values ('40000000-0000-4000-f000-000000000002', '00000000-0000-4000-c000-000000000004', 'helpful') $$,
  '42501', null, 'members cannot submit feedback as someone else');

select pg_temp.login('00000000-0000-4000-c000-000000000004');
select is((select count(*) from public.answer_feedback), 0::bigint, 'colleagues cannot read each other''s feedback');

select pg_temp.login('00000000-0000-4000-c000-000000000001');
select results_eq($$ select rating::text, comment from public.answer_feedback $$, $$ values ('not_helpful', 'Missing the retry steps') $$,
  'admins read their organisation''s feedback');
select is((select count(*) from public.conversations), 0::bigint, 'admins cannot read members'' conversations');

select pg_temp.login('00000000-0000-4000-c000-000000000003');
delete from public.conversations where id = '30000000-0000-4000-f000-000000000003';
select pg_temp.login('00000000-0000-4000-c000-000000000001');
select results_eq($$ select question, conversation_id from public.ai_queries where user_id = '00000000-0000-4000-c000-000000000003' order by question $$,
  $$ values ('failed question', null::uuid), ('support question', null::uuid) $$,
  'deleting a conversation keeps the question log for auditing');

select pg_temp.logout();
set local role anon;
select throws_ok($$ select * from public.conversations $$, '42501', null, 'anonymous visitors cannot read conversations');

select * from finish();
rollback;
