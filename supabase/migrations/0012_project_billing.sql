-- Billing is confidential from the team: a member logs hours and sees hours,
-- never a rate, a budget, an invoice or a payment.
--
-- RLS is row-level, so a policy on `projects` cannot hide one column from
-- members while showing the row. Keeping hourly_rate on `projects` would mean
-- the restriction lived only in page code — a member querying the API with
-- their own token would still read the rate. So the money moves to its own
-- table, where a row policy is exactly the right shape, and comes off
-- `projects` entirely.

create table project_billing (
  project_id uuid primary key references projects (id) on delete cascade,
  billing_type text not null default 'hourly'
    check (billing_type in ('hourly', 'fixed')),
  -- Which one is meaningful follows billing_type; both are nullable so a
  -- project can be created before its commercials are settled.
  hourly_rate numeric(10, 2),
  fixed_budget numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into project_billing (project_id, billing_type, hourly_rate)
select id, 'hourly', hourly_rate from projects;

alter table projects drop column hourly_rate;

-- ---------------------------------------------------------------------------
-- Milestones — what a fixed-budget project bills against, instead of hours.
-- Payment state is NOT stored here: it is read through invoice_line_item_id,
-- exactly as time_entries does, so marking an invoice paid updates every
-- milestone on it with nothing to keep in sync.
-- ---------------------------------------------------------------------------
create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  description text,
  amount numeric(12, 2) not null default 0,
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  position integer not null default 0,
  invoice_line_item_id uuid references invoice_line_items (id) on delete set null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_milestones_project_idx on project_milestones (project_id, position);
create index project_billing_type_idx on project_billing (billing_type);

-- A milestone invoices as its own kind of line, distinct from hours ('time')
-- and an ad-hoc charge ('flat_fee').
alter table invoice_line_items drop constraint invoice_line_items_line_type_check;
alter table invoice_line_items add constraint invoice_line_items_line_type_check
  check (line_type in ('time', 'flat_fee', 'milestone'));

-- ---------------------------------------------------------------------------
-- RLS — admin and the project's own client only. Members are absent from
-- every policy here, which is the whole point of the table.
-- ---------------------------------------------------------------------------
alter table project_billing enable row level security;
alter table project_milestones enable row level security;

create policy project_billing_select on project_billing
  for select using (is_admin() or is_project_client(project_id));

create policy project_billing_insert on project_billing
  for insert with check (is_admin());
create policy project_billing_update on project_billing
  for update using (is_admin()) with check (is_admin());
create policy project_billing_delete on project_billing
  for delete using (is_admin());

create policy project_milestones_select on project_milestones
  for select using (is_admin() or is_project_client(project_id));

create policy project_milestones_insert on project_milestones
  for insert with check (is_admin());
create policy project_milestones_update on project_milestones
  for update using (is_admin()) with check (is_admin());
create policy project_milestones_delete on project_milestones
  for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- A draft invoice is a working document, not yet a claim on the client. The
-- original policy let a client read one, so a bill they had never been sent
-- could appear in their list. Narrow it to invoices that have actually left
-- the building.
-- ---------------------------------------------------------------------------
drop policy if exists invoices_select on invoices;

create policy invoices_select on invoices
  for select using (
    is_admin()
    or (
      status <> 'draft'
      and exists (
        select 1 from projects
        where projects.client_id = invoices.client_id
          and is_project_client(projects.id)
      )
    )
  );

drop policy if exists invoice_line_items_select on invoice_line_items;

create policy invoice_line_items_select on invoice_line_items
  for select using (
    is_admin()
    or exists (
      select 1 from invoices
      join projects on projects.client_id = invoices.client_id
      where invoices.id = invoice_line_items.invoice_id
        and invoices.status <> 'draft'
        and is_project_client(projects.id)
    )
  );

create trigger project_billing_updated_at before update on project_billing
  for each row execute function set_updated_at();
create trigger project_milestones_updated_at before update on project_milestones
  for each row execute function set_updated_at();
