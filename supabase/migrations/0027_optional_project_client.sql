-- A project need not belong to a client. An agency runs its own work too —
-- its website, its marketing, a tool it builds for itself — and until now
-- every one of those had to be filed under a fictional client.
--
-- What this does not change: a project with no client cannot be invoiced,
-- because an invoice is addressed to somebody. It simply won't appear in the
-- invoice builder's project list, and the client rollups won't count it.
--
-- The RLS policies need no edit. Each one reaches a project through
-- `projects.client_id = clients.id`, and a null never matches an equality —
-- so an internal project is invisible to every client, which is right.

alter table projects alter column client_id drop not null;

-- One place did need a guard. A client-role invite copies the project's
-- company onto the profile of whoever joins; on a project with no company that
-- would have written null and left them a client account belonging to nobody —
-- unable to see their own billing or start a project. Refuse it instead, at the
-- point where the mistake is still just a bad link.
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

  if exists (
    select 1 from project_members
    where project_id = v_invite.project_id and user_id = auth.uid()
  ) then
    return v_invite.project_id;
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

  if v_invite.email is not null and lower(v_invite.email) <> lower(v_email) then
    raise exception 'This invite was issued to a different email address';
  end if;

  if (v_role = 'client') <> (v_invite.project_role = 'client') then
    raise exception 'This invite is for a different kind of account';
  end if;

  select * into v_project from projects where id = v_invite.project_id;
  if v_project.id is null then
    raise exception 'That project no longer exists';
  end if;

  if v_invite.project_role = 'client' and v_project.client_id is null then
    raise exception 'This is an internal project — it has no client to invite';
  end if;

  insert into project_members (project_id, user_id, project_role)
  values (v_invite.project_id, auth.uid(), v_invite.project_role);

  if v_invite.project_role = 'client' then
    update profiles set client_id = v_project.client_id
    where id = auth.uid() and client_id is null;
  end if;

  update project_invites set used_count = used_count + 1 where id = v_invite.id;

  return v_invite.project_id;
end;
$$;

revoke all on function redeem_project_invite(text) from public, anon;
grant execute on function redeem_project_invite(text) to authenticated;
