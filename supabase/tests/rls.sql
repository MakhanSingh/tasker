-- Row Level Security checks. See README.md in this directory.
-- Runs inside a transaction that rolls back: nothing is left behind.

begin;

create temp table rls_check(seq serial, name text, expected int, actual int) on commit drop;

-- An admin sees everything, so their expectations have to be relative to what
-- is already in the database — this file has to give the same answer on an
-- empty project and on a live one with real clients in it. Scoped checks
-- (member, client) stay absolute: the fixtures are all those roles can reach.
create temp table rls_baseline on commit drop as
select
  (select count(*) from projects)        as projects,
  (select count(*) from project_billing) as billing,
  (select count(*) from invoices)        as invoices,
  (select count(*) from payment_methods) as payment_methods;
grant all on rls_baseline to authenticated;
grant all on rls_check to authenticated;
grant all on sequence rls_check_seq_seq to authenticated;

-- Fixtures. No passwords are set: these identities are never authenticated
-- with, only impersonated through the JWT claim the policies read.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'rlstest-admin@example.test'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'rlstest-member@example.test'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'rlstest-client-a@example.test'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'rlstest-client-b@example.test');

insert into clients (id, org_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000001', (select id from organizations where slug='default'), 'Acme (test)'),
  ('bbbbbbbb-0000-4000-8000-000000000002', (select id from organizations where slug='default'), 'Globex (test)');

-- Profiles come after clients now: a portal user records the company it
-- belongs to (migration 0022), so the row can't be written before the company.
insert into profiles (id, org_id, role, full_name, email, client_id)
select u.id, (select id from organizations where slug='default'), r.role, r.nm, u.email, r.client_id
from (values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'admin','RLS Admin',   null::uuid),
  ('aaaaaaaa-0000-4000-8000-000000000002'::uuid,'member','RLS Member', null::uuid),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid,'client','RLS Client A','bbbbbbbb-0000-4000-8000-000000000001'::uuid),
  ('aaaaaaaa-0000-4000-8000-000000000004'::uuid,'client','RLS Client B','bbbbbbbb-0000-4000-8000-000000000002'::uuid)
) r(id, role, nm, client_id) join auth.users u on u.id = r.id;

insert into projects (id, org_id, client_id, name) values
  ('cccccccc-0000-4000-8000-000000000001', (select id from organizations where slug='default'), 'bbbbbbbb-0000-4000-8000-000000000001', 'Acme Site'),
  ('cccccccc-0000-4000-8000-000000000002', (select id from organizations where slug='default'), 'bbbbbbbb-0000-4000-8000-000000000002', 'Globex App');

insert into project_billing (project_id, billing_type, hourly_rate) values
  ('cccccccc-0000-4000-8000-000000000001', 'hourly', 4500),
  ('cccccccc-0000-4000-8000-000000000002', 'hourly', 6000);

-- The member is an editor on Acme only; each client is on their own project.
insert into project_members (project_id, user_id, project_role) values
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','editor'),
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000003','client'),
  ('cccccccc-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000004','client');

insert into tasks (id, project_id, title) values
  ('dddddddd-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','Acme task');

insert into task_comments (task_id, author_id, body, is_internal) values
  ('dddddddd-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','internal chatter', true),
  ('dddddddd-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','shared with client', false);

insert into files (org_id, project_id, task_id, uploaded_by, file_name, storage_path, is_client_visible) values
  ((select id from organizations where slug='default'),'cccccccc-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','internal.pdf','x/1', false),
  ((select id from organizations where slug='default'),'cccccccc-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','shared.pdf','x/2', true);

insert into time_entries (project_id, task_id, user_id, started_at, ended_at, duration_minutes) values
  ('cccccccc-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002', now() - interval '2 hour', now(), 120);

-- One draft and one sent, because a client must see the sent one and not the draft.
insert into invoices (org_id, client_id, invoice_number, status, issue_date, due_date, total) values
  ((select id from organizations where slug='default'),'bbbbbbbb-0000-4000-8000-000000000001','TEST-DRAFT','draft', current_date, current_date + 30, 1000),
  ((select id from organizations where slug='default'),'bbbbbbbb-0000-4000-8000-000000000001','TEST-SENT','sent', current_date, current_date + 30, 2000);

insert into payment_methods (org_id, kind, label, details) values
  ((select id from organizations where slug='default'),'bank','Test bank','acct 123');

insert into personal_todos (org_id, user_id, title) values
  ((select id from organizations where slug='default'),'aaaaaaaa-0000-4000-8000-000000000002','member private note');

-- ===================== MEMBER =====================
-- The confidentiality rule the whole billing split exists for: a member logs
-- hours and sees hours, and never a rate, a budget, an invoice or a payment.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';

insert into rls_check(name, expected, actual) values
  ('member: rates hidden',            0, (select count(*) from project_billing)),
  ('member: invoices hidden',         0, (select count(*) from invoices)),
  ('member: payment methods hidden',  0, (select count(*) from payment_methods)),
  ('member: milestones hidden',       0, (select count(*) from project_milestones)),
  ('member: only own project',        1, (select count(*) from projects)),
  ('member: own time entry visible',  1, (select count(*) from time_entries)),
  ('member: sees both comments',      2, (select count(*) from task_comments));

reset role;

-- ===================== CLIENT A =====================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';

insert into rls_check(name, expected, actual) values
  ('client: only own project',        1, (select count(*) from projects)),
  ('client: only own company visible', 1, (select count(*) from clients)),
  ('client: draft invoice hidden',    1, (select count(*) from invoices)),
  ('client: raw time entries hidden', 0, (select count(*) from time_entries)),
  ('client: hours view readable',     1, (select count(*) from project_hours_summary)),
  ('client: internal comment hidden', 1, (select count(*) from task_comments)),
  ('client: internal file hidden',    1, (select count(*) from files)),
  ('client: payment methods hidden',  0, (select count(*) from payment_methods)),
  ('client: sees own billing',        1, (select count(*) from project_billing)),
  ('client: no member private todos', 0, (select count(*) from personal_todos)),
  ('client: is_client_of own company',  1, (select case when is_client_of('bbbbbbbb-0000-4000-8000-000000000001') then 1 else 0 end)),
  ('client: is_client_of other company',0, (select case when is_client_of('bbbbbbbb-0000-4000-8000-000000000002') then 1 else 0 end));

reset role;

-- ===================== CLIENT B — a different company =====================
-- Isolation between two clients of the same agency, which is the failure that
-- would end a client relationship rather than merely annoy someone.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}';

insert into rls_check(name, expected, actual) values
  ('client B: no Acme project',       1, (select count(*) from projects)),
  ('client B: no Acme invoices',      0, (select count(*) from invoices)),
  ('client B: no Acme tasks',         0, (select count(*) from tasks)),
  ('client B: no Acme files',         0, (select count(*) from files));

reset role;

-- ===================== ADMIN =====================
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

insert into rls_check(name, expected, actual) values
  ('admin: sees both new projects',  2, (select count(*) - (select projects from rls_baseline) from projects)),
  ('admin: sees both new invoices',  2, (select count(*) - (select invoices from rls_baseline) from invoices)),
  ('admin: sees the new rates',      2, (select count(*) - (select billing from rls_baseline) from project_billing)),
  ('admin: sees the new method',     1, (select count(*) - (select payment_methods from rls_baseline) from payment_methods)),
  -- Deliberately no admin bypass: a private list is private from everyone.
  ('admin: NO private todos',         0, (select count(*) from personal_todos));

reset role;

select name,
       expected,
       actual,
       case when expected = actual then 'ok' else 'FAIL' end as result
from rls_check order by seq;

rollback;
