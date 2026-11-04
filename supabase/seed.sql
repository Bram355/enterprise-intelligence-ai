-- LOCAL DEVELOPMENT ONLY. Fictional organisations and demo users.
-- Never run against a hosted project. All demo users share the password: Password123!

insert into public.organisations (id, name, slug) values
  ('00000000-0000-4000-a000-000000000001', 'Northwind Payments (fictional)', 'northwind'),
  ('00000000-0000-4000-a000-000000000002', 'Contoso Retail (fictional)', 'contoso');

insert into public.departments (id, organisation_id, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'Technical Support'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001', 'Integrations'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000001', 'Operations'),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000001', 'Finance'),
  ('00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000002', 'Customer Support');

-- Accounts are invite-only, so each demo user gets an invitation first;
-- the auth trigger turns it into a profile.
insert into public.invitations (organisation_id, email, role, department_id) values
  ('00000000-0000-4000-a000-000000000001', 'admin@northwind.test', 'admin', null),
  ('00000000-0000-4000-a000-000000000001', 'km@northwind.test', 'knowledge_manager', '00000000-0000-4000-b000-000000000001'),
  ('00000000-0000-4000-a000-000000000001', 'employee@northwind.test', 'employee', '00000000-0000-4000-b000-000000000001'),
  ('00000000-0000-4000-a000-000000000001', 'finance@northwind.test', 'employee', '00000000-0000-4000-b000-000000000004'),
  ('00000000-0000-4000-a000-000000000002', 'admin@contoso.test', 'admin', null);

with demo (id, email, full_name) as (
  values
    ('00000000-0000-4000-c000-000000000001'::uuid, 'admin@northwind.test', 'Alex Admin'),
    ('00000000-0000-4000-c000-000000000002'::uuid, 'km@northwind.test', 'Kim Knowledge'),
    ('00000000-0000-4000-c000-000000000003'::uuid, 'employee@northwind.test', 'Eli Employee'),
    ('00000000-0000-4000-c000-000000000004'::uuid, 'finance@northwind.test', 'Fran Finance'),
    ('00000000-0000-4000-c000-000000000005'::uuid, 'admin@contoso.test', 'Casey Contoso')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', d.id, 'authenticated', 'authenticated', d.email,
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', d.full_name), now(), now(),
  '', '', '', '', '', '', '', ''
from demo d;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%.test';
