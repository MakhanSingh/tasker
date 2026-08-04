-- A client portal user had no recorded company. `inviteClientUser(clientId, …)`
-- took the client it was invited for and used it only to revalidate a page —
-- the profile row it created carried role='client' and nothing else.
--
-- The company was therefore only ever inferred backwards, through
-- project_members -> projects.client_id, which breaks in three places:
--
--   * a freshly invited portal user belongs to no company, so they never
--     appear on the client's own page;
--   * the Members tab offered every client-role profile in the org as a
--     candidate, so an admin could grant one company's user access to another
--     company's project — two clicks from a confidentiality incident;
--   * create_client_project() derives the caller's company the same backwards
--     way, so a client with no project yet cannot create their first one.
--
-- Recording it on the profile fixes all three at the source.

alter table profiles
  add column if not exists client_id uuid references clients (id) on delete set null;

create index if not exists profiles_client_idx on profiles (client_id);

-- Backfill from what could be inferred before, so existing portal users keep
-- working. A user on two companies' projects is left null rather than guessed
-- at — that is a real ambiguity for an admin to resolve, not for a migration.
update profiles p
set client_id = sole.client_id
from (
  -- array_agg, not min: Postgres has no min() for uuid. The `having` below
  -- means there is exactly one distinct value, so taking the first is exact.
  select pm.user_id, (array_agg(distinct pr.client_id))[1] as client_id
  from project_members pm
  join projects pr on pr.id = pm.project_id
  where pm.project_role = 'client'
  group by pm.user_id
  having count(distinct pr.client_id) = 1
) sole
where p.id = sole.user_id and p.role = 'client' and p.client_id is null;

-- Only an admin may set or move someone's company; the existing
-- profiles_update policy lets a user edit their own row, and without this a
-- client could reassign themselves to another company and read its projects.
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
  if new.client_id is distinct from old.client_id and not is_admin() then
    raise exception 'Only an admin can change which client a profile belongs to';
  end if;
  return new;
end;
$$;

revoke all on function prevent_self_role_escalation() from public, anon, authenticated;

-- Now that the company is recorded, derive it from the profile rather than
-- from whatever project the caller happens to already be on. This is what
-- lets a client create their first project.
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

  -- Read from the caller's own profile. Never taken as an argument: trusting a
  -- posted value would let a client file a project under another company.
  select client_id, org_id into v_client_id, v_org_id
  from profiles
  where id = auth.uid() and role = 'client';

  if v_client_id is null then
    raise exception 'Your account is not linked to a company — ask your account manager';
  end if;

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

revoke all on function create_client_project(text, text, text, text, numeric, numeric, date, date)
  from public, anon;
grant execute on function create_client_project(text, text, text, text, numeric, numeric, date, date)
  to authenticated;

-- Same shortcut for the membership check.
create or replace function is_client_of(p_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'client' and client_id = p_client_id
  );
$$;

revoke all on function is_client_of(uuid) from public, anon;
grant execute on function is_client_of(uuid) to authenticated;
