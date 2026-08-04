-- Tasker Phase 1 schema
-- Every table is scoped to an organization (directly or transitively) so a
-- later move to multi-tenant only requires signup/billing UI, not a schema rewrite.

-- No pgcrypto: the only thing it was here for was gen_random_uuid(), which has
-- been in core Postgres since 13, and nothing else in this schema calls a
-- pgcrypto function.

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id),
  role text not null check (role in ('admin', 'member', 'client')),
  full_name text not null,
  email text not null,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_org_role_idx on profiles (org_id, role);

-- ---------------------------------------------------------------------------
-- clients (billing entity / company, distinct from portal users)
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  name text not null,
  contact_email text,
  contact_phone text,
  billing_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_org_idx on clients (org_id);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  client_id uuid not null references clients (id),
  name text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'on_hold', 'completed', 'archived')),
  hourly_rate numeric(10, 2),
  start_date date,
  end_date date,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_org_idx on projects (org_id);
create index projects_client_idx on projects (client_id);
create index projects_status_idx on projects (status);

-- ---------------------------------------------------------------------------
-- project_members — the single per-project RBAC mechanism.
-- A team member's role can differ project to project (two rows, two roles).
-- A client user is granted access to exactly the project(s) they belong to
-- via a project_role = 'client' row here — never implicitly via `clients`.
-- ---------------------------------------------------------------------------
create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  project_role text not null check (project_role in ('manager', 'editor', 'viewer', 'client')),
  added_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_members_project_idx on project_members (project_id);
create index project_members_user_idx on project_members (user_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid references profiles (id),
  due_date date,
  position integer not null default 0,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_status_idx on tasks (project_id, status);
create index tasks_assignee_idx on tasks (assignee_id);

-- ---------------------------------------------------------------------------
-- task_comments
-- ---------------------------------------------------------------------------
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  author_id uuid not null references profiles (id),
  body text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_comments_task_idx on task_comments (task_id, created_at);

-- ---------------------------------------------------------------------------
-- invoices & invoice_line_items (created before time_entries so the FK from
-- time_entries -> invoice_line_items can be declared)
-- ---------------------------------------------------------------------------
create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  client_id uuid not null references clients (id),
  invoice_number text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'void')),
  issue_date date not null,
  due_date date not null,
  currency text not null default 'USD',
  subtotal numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  pdf_path text,
  paid_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_client_status_idx on invoices (client_id, status);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  project_id uuid references projects (id),
  line_type text not null check (line_type in ('time', 'flat_fee')),
  description text not null,
  quantity numeric(10, 2) not null,
  unit_price numeric(10, 2) not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index invoice_line_items_invoice_idx on invoice_line_items (invoice_id);

-- ---------------------------------------------------------------------------
-- time_entries — no separate "active timer" table. A running timer is a row
-- with ended_at = null; the partial unique index below enforces at most one
-- running timer per user at the database level.
-- ---------------------------------------------------------------------------
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id),
  task_id uuid references tasks (id),
  user_id uuid not null references profiles (id),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer,
  description text,
  is_billable boolean not null default true,
  invoice_line_item_id uuid references invoice_line_items (id),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (duration_minutes is null or duration_minutes >= 0)
);

create index time_entries_project_idx on time_entries (project_id);
create index time_entries_task_idx on time_entries (task_id);
create index time_entries_user_started_idx on time_entries (user_id, started_at);

create unique index one_running_timer_per_user
  on time_entries (user_id)
  where (ended_at is null);

-- ---------------------------------------------------------------------------
-- files (attachments)
-- ---------------------------------------------------------------------------
create table files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  project_id uuid references projects (id),
  task_id uuid references tasks (id),
  uploaded_by uuid not null references profiles (id),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  storage_provider text not null default 'local'
    check (storage_provider in ('local', 'supabase', 's3')),
  is_client_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index files_project_idx on files (project_id);
create index files_task_idx on files (task_id);

-- ---------------------------------------------------------------------------
-- activity_log — populated by triggers (see 0003_activity_triggers.sql), not
-- by application code, so it can't be silently skipped by a missed call site.
-- ---------------------------------------------------------------------------
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  actor_id uuid references profiles (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_org_created_idx on activity_log (org_id, created_at desc);
create index activity_log_entity_idx on activity_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger projects_set_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger task_comments_set_updated_at before update on task_comments
  for each row execute function set_updated_at();
create trigger invoices_set_updated_at before update on invoices
  for each row execute function set_updated_at();
