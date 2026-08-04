-- A client now fills in the same project form an admin does — status, dates
-- and commercials included — so create_client_project has to accept them all
-- and write the project_billing row too.
--
-- Note what did NOT have to change: project_billing_insert is still
-- admin-only. This function is SECURITY DEFINER, so it writes as its owner;
-- widening that policy would have let a client change the rate on any project
-- of theirs at any time, not just set one while creating.
--
-- The company is still derived from the caller and never taken as an
-- argument. That isn't a smaller form — the picker shows a client exactly one
-- option, their own — it's that trusting the posted value would let them file
-- a project under another company's name.

drop function if exists create_client_project(text, text);

create or replace function create_client_project(
  p_name text,
  p_description text default null,
  p_status text default 'active',
  p_billing_type text default 'hourly',
  p_hourly_rate numeric default null,
  p_fixed_budget numeric default null,
  p_start_date date default null,
  p_end_date date default null
)
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
  if p_status not in ('active', 'on_hold', 'completed', 'archived') then
    raise exception 'Invalid project status';
  end if;
  if p_billing_type not in ('hourly', 'fixed') then
    raise exception 'Invalid billing type';
  end if;

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

  insert into projects (org_id, client_id, name, description, status, start_date, end_date, created_by)
  values (
    v_org_id, v_client_id, btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_status, p_start_date, p_end_date, auth.uid()
  )
  returning id into v_project_id;

  insert into project_billing (project_id, billing_type, hourly_rate, fixed_budget)
  values (
    v_project_id,
    p_billing_type,
    case when p_billing_type = 'hourly' then p_hourly_rate end,
    case when p_billing_type = 'fixed' then p_fixed_budget end
  );

  insert into project_members (project_id, user_id, project_role)
  values (v_project_id, auth.uid(), 'client');

  return v_project_id;
end;
$$;

revoke execute on function create_client_project(text, text, text, text, numeric, numeric, date, date) from public;
grant execute on function create_client_project(text, text, text, text, numeric, numeric, date, date) to authenticated;
