-- Team members could not read the name of anyone they didn't share a
-- project_members row with — and admins are never in project_members, since
-- they bypass it entirely. The result was an admin's comments and time
-- entries rendering as "Unknown" to every member.
--
-- Internal accounts (admin/member) may now read any profile in their own org,
-- which is what a single-company tool needs to render author names at all.
-- Client accounts deliberately keep the narrower project-peer rule, so a
-- client still never sees the internal team roster or another client's people.

create or replace function is_internal_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'member') and is_active
  );
$$;

drop policy if exists profiles_select on profiles;

create policy profiles_select on profiles
  for select using (
    is_admin()
    or id = auth.uid()
    -- SECURITY DEFINER, so this does not recurse back through this policy.
    or (is_internal_user() and org_id = current_org_id())
    or exists (
      select 1 from project_members my, project_members theirs
      where my.user_id = auth.uid()
        and theirs.user_id = profiles.id
        and my.project_id = theirs.project_id
    )
  );
