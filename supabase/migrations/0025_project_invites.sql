-- Shareable invite links, scoped to one project and one role.
--
-- Deliberately not Trello's "anyone with the link joins": in Trello a leaked
-- link costs you a board, here a client portal shows invoices, amounts owed
-- and hours, and the whole schema exists to keep one client from seeing
-- another's. A link forwarded in a group chat must not be able to undo that.
--
-- So each link carries a project, a role and an expiry, is single-use by
-- default, and can be revoked. The worst a leaked one can do is add a stranger
-- to the one project it names — visible in that project's Members tab, and
-- removable there.
--
-- The token itself is never stored. Only its SHA-256 hash goes in the row, so
-- reading this table — a database dump, a support query, an over-broad policy
-- later — does not hand anyone a working link. The raw token exists once, in
-- the response that created it.

create table project_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  project_role text not null check (project_role in ('manager', 'editor', 'viewer', 'client')),
  token_hash text not null unique,
  -- Optional. When set, the link only works for this address, so forwarding it
  -- achieves nothing.
  email text,
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses >= 1),
  used_count integer not null default 0 check (used_count >= 0),
  revoked_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index project_invites_project_idx on project_invites (project_id);
create index project_invites_token_idx on project_invites (token_hash);

alter table project_invites enable row level security;

-- Admins only, and only their own org. Nobody else has any reason to read
-- these rows; redemption goes through the SECURITY DEFINER function below,
-- which needs no read access of its own.
create policy project_invites_select on project_invites
  for select using (is_admin() and org_id = current_org_id());
create policy project_invites_insert on project_invites
  for insert with check (is_admin() and org_id = current_org_id());
create policy project_invites_update on project_invites
  for update using (is_admin()) with check (is_admin());
create policy project_invites_delete on project_invites
  for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- Redemption.
--
-- SECURITY DEFINER because the person redeeming is, by definition, not yet a
-- member — no RLS policy could authorize the insert on their behalf. It still
-- runs as them: auth.uid() is the identity that gets added, so an anonymous
-- caller can achieve nothing here even with a valid token.
--
-- Every check is inside one function, and the row is locked while it runs, so
-- two people opening the same single-use link at once cannot both get in.
-- ---------------------------------------------------------------------------
create or replace function redeem_project_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite project_invites;
  v_project projects;
  v_email text;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;

  select * into v_invite
  from project_invites
  where token_hash = p_token_hash
  for update;

  if v_invite.id is null then
    raise exception 'This invite link is not valid';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'This invite link has been revoked';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'This invite link has expired';
  end if;
  if v_invite.used_count >= v_invite.max_uses then
    raise exception 'This invite link has already been used';
  end if;

  select email, role into v_email, v_role from profiles where id = auth.uid();

  -- An email-locked link is for one person, not one inbox-shaped hint.
  if v_invite.email is not null and lower(v_invite.email) <> lower(v_email) then
    raise exception 'This invite was issued to a different email address';
  end if;

  -- A client account can only ever be a client on a project, and an internal
  -- account can never be the client. Otherwise a stale link could quietly
  -- change what someone is.
  if (v_role = 'client') <> (v_invite.project_role = 'client') then
    raise exception 'This invite is for a different kind of account';
  end if;

  select * into v_project from projects where id = v_invite.project_id;
  if v_project.id is null then
    raise exception 'That project no longer exists';
  end if;

  -- Already in? Treat it as success rather than an error: clicking the link
  -- twice should land you on the project, not on a failure page.
  if not exists (
    select 1 from project_members
    where project_id = v_invite.project_id and user_id = auth.uid()
  ) then
    insert into project_members (project_id, user_id, project_role)
    values (v_invite.project_id, auth.uid(), v_invite.project_role);

    -- A client joining a project is a client of that company, which is what
    -- lets them see their own billing and start their next project.
    if v_invite.project_role = 'client' then
      update profiles set client_id = v_project.client_id
      where id = auth.uid() and client_id is null;
    end if;

    update project_invites set used_count = used_count + 1 where id = v_invite.id;
  end if;

  return v_invite.project_id;
end;
$$;

revoke all on function redeem_project_invite(text) from public, anon;
grant execute on function redeem_project_invite(text) to authenticated;

-- Reading an invite before redeeming it, so the page can say which project and
-- role it is for. Returns nothing identifying beyond that, and never the
-- token — an expired or revoked link simply yields no row.
create or replace function peek_project_invite(p_token_hash text)
returns table (project_name text, project_role text, client_name text, email text)
language sql
security definer
stable
set search_path = public
as $$
  select p.name, i.project_role, c.name, i.email
  from project_invites i
  join projects p on p.id = i.project_id
  join clients c on c.id = p.client_id
  where i.token_hash = p_token_hash
    and i.revoked_at is null
    and i.expires_at > now()
    and i.used_count < i.max_uses;
$$;

revoke all on function peek_project_invite(text) from public;
grant execute on function peek_project_invite(text) to anon, authenticated;
