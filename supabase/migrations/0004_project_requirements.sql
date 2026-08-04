-- Project requirements: the agreed scope for a project, and the client's
-- sign-off on it. Kept separate from tasks — a requirement is what was
-- agreed, a task is the work done to deliver it.

create table project_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'must_have'
    check (priority in ('must_have', 'should_have', 'nice_to_have')),
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected', 'delivered')),
  is_client_visible boolean not null default true,
  position integer not null default 0,
  created_by uuid references profiles (id),
  -- Who signed off, and when. Populated on the approve/reject transition so
  -- a scope dispute can be settled from the record itself.
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_requirements_project_idx on project_requirements (project_id, position);

create trigger project_requirements_set_updated_at before update on project_requirements
  for each row execute function set_updated_at();

alter table project_requirements enable row level security;

-- Visibility mirrors files: team sees everything on their projects, clients
-- only see requirements explicitly marked client-visible.
create policy project_requirements_select on project_requirements
  for select using (
    is_admin()
    or is_project_team(project_id)
    or (is_project_client(project_id) and is_client_visible)
  );

create policy project_requirements_insert on project_requirements
  for insert with check (
    is_admin() or project_role_of(project_id) in ('manager', 'editor')
  );

-- Clients are allowed to update a visible requirement so they can approve or
-- reject it. RLS is row-level only, so the restriction to *just* the status
-- and decided_* columns is enforced in the Server Action, matching how task
-- updates are handled.
create policy project_requirements_update on project_requirements
  for update using (
    is_admin()
    or project_role_of(project_id) in ('manager', 'editor')
    or (is_project_client(project_id) and is_client_visible)
  )
  with check (
    is_admin()
    or project_role_of(project_id) in ('manager', 'editor')
    or (is_project_client(project_id) and is_client_visible)
  );

create policy project_requirements_delete on project_requirements
  for delete using (is_admin() or project_role_of(project_id) = 'manager');

-- Activity logging, consistent with the other entities.
create or replace function log_requirement_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from projects where id = new.project_id;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
    values (v_org_id, auth.uid(), 'requirement', new.id, 'created', null);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
    values (v_org_id, auth.uid(), 'requirement', new.id, 'status_changed',
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

create trigger project_requirements_log_activity
  after insert or update on project_requirements
  for each row execute function log_requirement_activity();

-- Extend the activity-feed visibility helper to cover the new entity type.
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
  elsif p_entity_type = 'requirement' then
    return exists (select 1 from project_requirements where id = p_entity_id and is_project_team(project_id));
  else
    return false;
  end if;
end;
$$;
