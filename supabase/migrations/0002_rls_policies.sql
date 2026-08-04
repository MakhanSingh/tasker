-- RLS is the authorization boundary for this app. Enable it on every table,
-- no exceptions, and centralize the role logic in SECURITY DEFINER helper
-- functions so policies stay short and consistent. All helpers pin
-- search_path to prevent search-path hijacking of a SECURITY DEFINER function.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from profiles where id = auth.uid();
$$;

create or replace function project_role_of(p_project_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select project_role from project_members
  where project_id = p_project_id and user_id = auth.uid();
$$;

create or replace function has_project_access(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select project_role_of(p_project_id) is not null;
$$;

create or replace function is_project_team(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select project_role_of(p_project_id) in ('manager', 'editor', 'viewer');
$$;

create or replace function is_project_client(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select project_role_of(p_project_id) = 'client';
$$;

grant execute on function is_admin() to authenticated;
grant execute on function current_org_id() to authenticated;
grant execute on function project_role_of(uuid) to authenticated;
grant execute on function has_project_access(uuid) to authenticated;
grant execute on function is_project_team(uuid) to authenticated;
grant execute on function is_project_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Client-safe hours rollup: clients never read raw time_entries (internal
-- notes, exact timestamps) — only this grouped view.
-- ---------------------------------------------------------------------------
create view project_hours_summary
with (security_invoker = true)
as
select
  te.project_id,
  te.task_id,
  date_trunc('day', te.started_at) as work_date,
  sum(coalesce(te.duration_minutes, 0)) as total_minutes,
  bool_or(te.is_billable) as has_billable
from time_entries te
where te.ended_at is not null
group by te.project_id, te.task_id, date_trunc('day', te.started_at);

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table time_entries enable row level security;
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;
alter table files enable row level security;
alter table activity_log enable row level security;

-- ---------------------------------------------------------------------------
-- organizations — read own org only; writes reserved for service role (no
-- multi-tenant signup UI exists yet, so no insert/update policy is defined).
-- ---------------------------------------------------------------------------
create policy organizations_select on organizations
  for select using (id = current_org_id());

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on profiles
  for select using (
    is_admin()
    or id = auth.uid()
    or exists (
      select 1 from project_members my, project_members theirs
      where my.user_id = auth.uid()
        and theirs.user_id = profiles.id
        and my.project_id = theirs.project_id
    )
  );

-- Only self-edit; role changes are blocked below by a trigger regardless of
-- this policy, since RLS cannot restrict individual columns.
create policy profiles_update on profiles
  for update using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

create or replace function prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Only an admin can change a profile role';
  end if;
  if new.org_id is distinct from old.org_id and not is_admin() then
    raise exception 'Only an admin can change a profile org';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_self_role_escalation();

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create policy clients_select on clients
  for select using (
    is_admin()
    or exists (
      select 1 from projects
      where projects.client_id = clients.id
        and has_project_access(projects.id)
    )
  );

create policy clients_insert on clients for insert with check (is_admin());
create policy clients_update on clients for update using (is_admin()) with check (is_admin());
create policy clients_delete on clients for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create policy projects_select on projects
  for select using (is_admin() or has_project_access(id));

create policy projects_insert on projects for insert with check (is_admin());
create policy projects_update on projects for update using (is_admin()) with check (is_admin());
create policy projects_delete on projects for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- project_members
-- ---------------------------------------------------------------------------
create policy project_members_select on project_members
  for select using (
    is_admin()
    or is_project_team(project_id)
    or user_id = auth.uid()
  );

create policy project_members_insert on project_members for insert with check (is_admin());
create policy project_members_update on project_members for update using (is_admin()) with check (is_admin());
create policy project_members_delete on project_members for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- tasks
-- Column-level restriction ("member can change status, not reassign") is
-- enforced in the Server Action layer — RLS only controls row access here.
-- ---------------------------------------------------------------------------
create policy tasks_select on tasks
  for select using (
    is_admin() or is_project_team(project_id) or is_project_client(project_id)
  );

create policy tasks_insert on tasks
  for insert with check (
    is_admin() or project_role_of(project_id) in ('manager', 'editor')
  );

create policy tasks_update on tasks
  for update using (
    is_admin()
    or project_role_of(project_id) in ('manager', 'editor')
    or assignee_id = auth.uid()
  )
  with check (
    is_admin()
    or project_role_of(project_id) in ('manager', 'editor')
    or assignee_id = auth.uid()
  );

create policy tasks_delete on tasks
  for delete using (is_admin() or project_role_of(project_id) = 'manager');

-- ---------------------------------------------------------------------------
-- task_comments — clients only ever see/write client-visible comments.
-- ---------------------------------------------------------------------------
create policy task_comments_select on task_comments
  for select using (
    is_admin()
    or exists (
      select 1 from tasks
      where tasks.id = task_comments.task_id
        and is_project_team(tasks.project_id)
    )
    or (
      not is_internal
      and exists (
        select 1 from tasks
        where tasks.id = task_comments.task_id
          and is_project_client(tasks.project_id)
      )
    )
  );

create policy task_comments_insert on task_comments
  for insert with check (
    author_id = auth.uid()
    and (
      is_admin()
      or exists (
        select 1 from tasks
        where tasks.id = task_comments.task_id
          and is_project_team(tasks.project_id)
      )
      or (
        not is_internal
        and exists (
          select 1 from tasks
          where tasks.id = task_comments.task_id
            and is_project_client(tasks.project_id)
        )
      )
    )
  );

create policy task_comments_update on task_comments
  for update using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());

create policy task_comments_delete on task_comments
  for delete using (author_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- time_entries — clients have no policy here at all; they read the
-- project_hours_summary view instead.
-- ---------------------------------------------------------------------------
create policy time_entries_select on time_entries
  for select using (
    is_admin()
    or user_id = auth.uid()
    or project_role_of(project_id) = 'manager'
  );

create policy time_entries_insert on time_entries
  for insert with check (
    user_id = auth.uid() and (is_admin() or has_project_access(project_id))
  );

create policy time_entries_update on time_entries
  for update using (
    (is_admin() or user_id = auth.uid()) and invoice_line_item_id is null
  )
  with check (
    (is_admin() or user_id = auth.uid()) and invoice_line_item_id is null
  );

create policy time_entries_delete on time_entries
  for delete using (
    (is_admin() or user_id = auth.uid()) and invoice_line_item_id is null
  );

-- ---------------------------------------------------------------------------
-- invoices / invoice_line_items — client read-only on their own invoices;
-- team has no access phase 1; all writes are admin-only.
-- ---------------------------------------------------------------------------
create policy invoices_select on invoices
  for select using (
    is_admin()
    or exists (
      select 1 from projects
      where projects.client_id = invoices.client_id
        and is_project_client(projects.id)
    )
  );

create policy invoices_insert on invoices for insert with check (is_admin());
create policy invoices_update on invoices for update using (is_admin()) with check (is_admin());
create policy invoices_delete on invoices for delete using (is_admin());

create policy invoice_line_items_select on invoice_line_items
  for select using (
    is_admin()
    or exists (
      select 1 from invoices
      join projects on projects.client_id = invoices.client_id
      where invoices.id = invoice_line_items.invoice_id
        and is_project_client(projects.id)
    )
  );

create policy invoice_line_items_insert on invoice_line_items for insert with check (is_admin());
create policy invoice_line_items_update on invoice_line_items for update using (is_admin()) with check (is_admin());
create policy invoice_line_items_delete on invoice_line_items for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- files
-- ---------------------------------------------------------------------------
create policy files_select on files
  for select using (
    is_admin()
    or (project_id is not null and is_project_team(project_id))
    or (project_id is not null and is_project_client(project_id) and is_client_visible)
  );

create policy files_insert on files
  for insert with check (
    is_admin()
    or (project_id is not null and project_role_of(project_id) in ('manager', 'editor'))
  );

create policy files_delete on files
  for delete using (is_admin() or uploaded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- activity_log — insert-only via triggers (SECURITY DEFINER), never directly
-- by `authenticated`; read scoped to admin or projects the user can access.
-- ---------------------------------------------------------------------------
create or replace function can_view_activity_entity(p_entity_type text, p_entity_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if is_admin() then
    return true;
  end if;

  if p_entity_type = 'project' then
    return has_project_access(p_entity_id);
  elsif p_entity_type = 'task' then
    return exists (select 1 from tasks where id = p_entity_id and is_project_team(project_id));
  elsif p_entity_type = 'time_entry' then
    return exists (select 1 from time_entries where id = p_entity_id and is_project_team(project_id));
  elsif p_entity_type = 'file' then
    return exists (select 1 from files where id = p_entity_id and project_id is not null and is_project_team(project_id));
  else
    return false;
  end if;
end;
$$;

grant execute on function can_view_activity_entity(text, uuid) to authenticated;

create policy activity_log_select on activity_log
  for select using (can_view_activity_entity(entity_type, entity_id));
