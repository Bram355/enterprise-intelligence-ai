-- Phase 7: member administration, invitation revocation, feedback reasons, support audit, analytics.

-- Feedback reasons ("wrong answer", "missing documentation") for knowledge-gap tracking.
alter table public.answer_feedback
  add column reason text check (reason in ('incorrect', 'missing_docs', 'other')),
  add constraint answer_feedback_reason_only_when_unhelpful check (reason is null or rating = 'not_helpful');
grant update (reason) on public.answer_feedback to authenticated;

-- ---------------------------------------------------------------------------
-- Member administration (admins only, same organisation). The profile audit trigger logs changes.
-- ---------------------------------------------------------------------------
create function public.admin_update_member(
  p_member uuid,
  p_role public.app_role,
  p_department_id uuid,
  p_is_active boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_target public.profiles;
begin
  if v_org is null or not private.is_org_admin(v_org) then
    raise exception 'Only organisation admins can manage members' using errcode = '42501';
  end if;
  select * into v_target from public.profiles where id = p_member and organisation_id = v_org for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if p_member = auth.uid() and (p_role <> 'admin' or not p_is_active) then
    raise exception 'You can''t remove your own admin access' using errcode = '42501';
  end if;
  if v_target.role = 'admin' and v_target.is_active and (p_role <> 'admin' or not p_is_active)
     and not exists (
       select 1 from public.profiles
       where organisation_id = v_org and role = 'admin' and is_active and id <> p_member
     ) then
    raise exception 'The organisation needs at least one active admin' using errcode = '42501';
  end if;
  if p_department_id is not null
     and not exists (select 1 from public.departments where id = p_department_id and organisation_id = v_org) then
    raise exception 'Department not found' using errcode = 'P0002';
  end if;
  update public.profiles
    set role = p_role, department_id = p_department_id, is_active = p_is_active
    where id = p_member;
end
$$;

create function public.admin_revoke_invitation(p_invitation uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_email text;
begin
  if v_org is null or not private.is_org_admin(v_org) then
    raise exception 'Only organisation admins can revoke invitations' using errcode = '42501';
  end if;
  update public.invitations set status = 'revoked'
    where id = p_invitation and organisation_id = v_org and status = 'pending'
    returning email into v_email;
  if v_email is null then
    raise exception 'Pending invitation not found' using errcode = 'P0002';
  end if;
  perform private.write_audit(v_org, 'invitation.revoked', 'invitation', p_invitation::text, jsonb_build_object('email', v_email));
end
$$;

-- ---------------------------------------------------------------------------
-- Support case audit trail
-- ---------------------------------------------------------------------------
create function private.audit_support_case()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit(new.organisation_id, 'support_case.created', 'support_case', new.id::text,
      jsonb_build_object('title', new.title, 'category', new.category), new.user_id);
  elsif new.status is distinct from old.status then
    perform private.write_audit(new.organisation_id, 'support_case.' || new.status::text, 'support_case', new.id::text,
      jsonb_build_object('title', new.title, 'from', old.status), coalesce(auth.uid(), new.user_id));
  end if;
  return new;
end
$$;

create trigger support_cases_audit
  after insert or update of status on public.support_cases
  for each row execute function private.audit_support_case();

-- ---------------------------------------------------------------------------
-- Analytics for organisation admins: real figures only, scoped to the caller's organisation.
-- ---------------------------------------------------------------------------
create function public.org_analytics(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_since timestamptz;
begin
  if v_org is null or not private.is_org_admin(v_org) then
    raise exception 'Only organisation admins can view analytics' using errcode = '42501';
  end if;
  v_since := date_trunc('day', now()) - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)) - 1);

  return jsonb_build_object(
    'since', v_since,
    'documents', (
      select jsonb_build_object(
        'total', count(*) filter (where archived_at is null),
        'indexed', count(*) filter (where archived_at is null and status = 'indexed'),
        'failed', count(*) filter (where archived_at is null and status = 'failed'),
        'processing', count(*) filter (where archived_at is null and status in ('uploaded', 'processing')),
        'archived', count(*) filter (where archived_at is not null),
        'added', count(*) filter (where created_at >= v_since))
      from public.documents where organisation_id = v_org),
    'failedDocuments', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'error', processing_error, 'updatedAt', updated_at) order by updated_at desc)
      from (select * from public.documents
            where organisation_id = v_org and status = 'failed' and archived_at is null
            order by updated_at desc limit 10) d), '[]'::jsonb),
    'questions', (
      select jsonb_build_object(
        'total', count(*),
        'answered', count(*) filter (where status = 'answered'),
        'unanswered', count(*) filter (where status = 'no_answer'),
        'clarifications', count(*) filter (where status = 'needs_clarification'),
        'failed', count(*) filter (where status = 'failed'),
        'medianLatencyMs', percentile_cont(0.5) within group (order by latency_ms) filter (where status = 'answered'))
      from public.ai_queries where organisation_id = v_org and created_at >= v_since),
    'perDay', coalesce((
      select jsonb_agg(jsonb_build_object('day', day::date, 'total', total, 'unanswered', unanswered) order by day)
      from (
        select g.day, count(q.id) as total, count(q.id) filter (where q.status = 'no_answer') as unanswered
        from generate_series(v_since, date_trunc('day', now()), interval '1 day') as g(day)
        left join public.ai_queries q
          on q.organisation_id = v_org and q.created_at >= g.day and q.created_at < g.day + interval '1 day'
        group by g.day) s), '[]'::jsonb),
    'topUnanswered', coalesce((
      select jsonb_agg(jsonb_build_object('question', question, 'count', n, 'lastAsked', last_asked) order by n desc, last_asked desc)
      from (
        select min(question) as question, count(*) as n, max(created_at) as last_asked
        from public.ai_queries
        where organisation_id = v_org and created_at >= v_since and status = 'no_answer'
          and coalesce(error, '') not like 'refused%'
        group by lower(btrim(question))
        order by count(*) desc, max(created_at) desc limit 10) u), '[]'::jsonb),
    'topDocuments', coalesce((
      select jsonb_agg(jsonb_build_object('documentId', document_id, 'title', title, 'count', n) order by n desc)
      from (
        select c->>'documentId' as document_id, min(c->>'title') as title, count(distinct q.id) as n
        from public.ai_queries q, jsonb_array_elements(q.citations) c
        where q.organisation_id = v_org and q.created_at >= v_since and q.status = 'answered'
        group by c->>'documentId'
        order by count(distinct q.id) desc limit 5) t), '[]'::jsonb),
    'feedback', (
      select jsonb_build_object(
        'helpful', count(*) filter (where rating = 'helpful'),
        'notHelpful', count(*) filter (where rating = 'not_helpful'),
        'incorrect', count(*) filter (where reason = 'incorrect'),
        'missingDocs', count(*) filter (where reason = 'missing_docs'))
      from public.answer_feedback where organisation_id = v_org and created_at >= v_since),
    'recentNegativeFeedback', coalesce((
      select jsonb_agg(jsonb_build_object('question', question, 'comment', comment, 'reason', reason, 'createdAt', created_at) order by created_at desc)
      from (
        select q.question, f.comment, f.reason, f.created_at
        from public.answer_feedback f join public.ai_queries q on q.id = f.query_id
        where f.organisation_id = v_org and f.rating = 'not_helpful' and f.created_at >= v_since
        order by f.created_at desc limit 10) n), '[]'::jsonb),
    'support', (
      select jsonb_build_object(
        'total', count(*),
        'open', count(*) filter (where status = 'open'),
        'resolved', count(*) filter (where status = 'resolved'),
        'escalated', count(*) filter (where status = 'escalated'),
        'byCategory', coalesce((
          select jsonb_object_agg(category, n) from (
            select category, count(*) as n from public.support_cases
            where organisation_id = v_org and created_at >= v_since group by category) c), '{}'::jsonb))
      from public.support_cases where organisation_id = v_org and created_at >= v_since),
    'users', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where is_active),
        'askedQuestions', (select count(distinct user_id) from public.ai_queries where organisation_id = v_org and created_at >= v_since))
      from public.profiles where organisation_id = v_org)
  );
end
$$;

revoke all on function public.admin_update_member(uuid, public.app_role, uuid, boolean) from public, anon;
revoke all on function public.admin_revoke_invitation(uuid) from public, anon;
revoke all on function public.org_analytics(integer) from public, anon;
grant execute on function public.admin_update_member(uuid, public.app_role, uuid, boolean) to authenticated;
grant execute on function public.admin_revoke_invitation(uuid) to authenticated;
grant execute on function public.org_analytics(integer) to authenticated;
