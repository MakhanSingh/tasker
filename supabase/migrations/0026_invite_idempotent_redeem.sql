-- Opening your own invite link a second time said "This invite link has
-- already been used" — to the person it had just let in. A refresh, a back
-- button, or tapping the link again in the chat it was sent in all produced a
-- failure page for someone who already had access.
--
-- The membership check was below the single-use check, so the branch that was
-- meant to make a second visit harmless was never reached. Being already on
-- the project is now answered first, and answered as success: they are asking
-- to get to a project they can already open, and the invite has nothing left
-- to decide.
--
-- Not a loosening. Every check that grants access still runs before anyone is
-- added; this only stops the function from refusing to acknowledge access that
-- already exists.

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

  -- Already in? Then there is nothing to redeem. Answered before expiry and
  -- use-count, because those questions are about granting access and this
  -- person already has it.
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
