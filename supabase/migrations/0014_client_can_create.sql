-- A client can now start a project of their own and raise tasks on it. Both
-- are requests into the agency's workflow, so each is deliberately narrower
-- than the admin equivalent — see the comments on each.

create or replace function is_client_of(p_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from project_members pm
    join projects p on p.id = pm.project_id
    where pm.user_id = auth.uid()
      and pm.project_role = 'client'
      and p.client_id = p_client_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Client-created projects.
--
-- Creating one takes two writes — the project, then the client's own
-- membership of it — and a client who got the first without the second would
-- immediately lose sight of what they just made. Rather than loosen two
-- policies and hope both writes land, the pair is one SECURITY DEFINER
-- function: atomic, and the permission check lives in exactly one place.
--
-- Note what it does NOT do: no project_billing row. Rates and budgets are the
-- agency's to agree, and project_billing's policies still name admins only.
-- The client sees no commercials on their new project until an admin sets them.
-- ---------------------------------------------------------------------------
create or replace function create_client_project(p_name text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_client_count int;
  v_org_id uuid;
  v_project_id uuid;
begin
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'A project needs a name';
  end if;

  -- The client_id is derived, never passed in — otherwise a client could
  -- create a project under another company's name.
  select count(distinct p.client_id), min(p.client_id)
    into v_client_count, v_client_id
  from project_members pm
  join projects p on p.id = pm.project_id
  where pm.user_id = auth.uid()
    and pm.project_role = 'client';

  if v_client_count = 0 then
    raise exception 'Only a client account can add a project this way';
  end if;
  if v_client_count > 1 then
    raise exception 'Your account spans more than one company — ask your account manager to add this project';
  end if;

  select org_id into v_org_id from clients where id = v_client_id;

  insert into projects (org_id, client_id, name, description, status, created_by)
  values (v_org_id, v_client_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), 'active', auth.uid())
  returning id into v_project_id;

  insert into project_members (project_id, user_id, project_role)
  values (v_project_id, auth.uid(), 'client');

  return v_project_id;
end;
$$;

revoke execute on function create_client_project(text, text) from public;
grant execute on function create_client_project(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Client-created tasks.
--
-- Only insert. A client raising a task is asking for work; moving it across
-- the board, reassigning it or deleting it stays with the team delivering it,
-- so tasks_update and tasks_delete are untouched.
-- ---------------------------------------------------------------------------
drop policy if exists tasks_insert on tasks;

create policy tasks_insert on tasks
  for insert with check (
    is_admin()
    or project_role_of(project_id) in ('manager', 'editor', 'client')
  );
