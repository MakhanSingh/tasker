-- Hardening pass, from Supabase's database linter on the live project.
--
-- Two real findings, both invisible until the schema met a real Postgres:
--
-- 1. `create function` grants EXECUTE to PUBLIC by default. Every helper and
--    every trigger function was therefore callable by anyone — signed in or
--    not — over PostgREST at /rest/v1/rpc/<name>. The `grant ... to
--    authenticated` lines in earlier migrations added a grant; they never took
--    the default one away.
--
--    Trigger functions are the sharper edge: nothing should ever call
--    notify_task_completed() or prevent_self_role_escalation() directly.
--    Postgres checks EXECUTE when a trigger is *created*, not when it fires,
--    so revoking it here costs the triggers nothing.
--
-- 2. `set_updated_at` was the one function without a pinned search_path. Every
--    other SECURITY DEFINER function in this schema sets it, because a mutable
--    search_path lets a caller who can create objects shadow the names the
--    function body resolves. It is only SECURITY INVOKER, so the exposure is
--    small — but it is the odd one out for no reason.
--
-- Not changed: project_hours_summary stays `security_invoker = false`. The
-- linter flags every definer view on principle, and that property is the whole
-- point of migration 0013 — it is what lets a client read their hours without
-- being granted the raw time_entries rows. The view does its own scoping in
-- the where clause, and it is granted to `authenticated` only.

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger functions: reachable by the triggers that own them, by nobody else.
-- ---------------------------------------------------------------------------
revoke all on function set_updated_at() from public, anon, authenticated;
revoke all on function prevent_self_role_escalation() from public, anon, authenticated;

revoke all on function log_project_activity() from public, anon, authenticated;
revoke all on function log_task_activity() from public, anon, authenticated;
revoke all on function log_time_entry_activity() from public, anon, authenticated;
revoke all on function log_invoice_activity() from public, anon, authenticated;
revoke all on function log_requirement_activity() from public, anon, authenticated;

revoke all on function notify_task_assigned() from public, anon, authenticated;
revoke all on function notify_task_created() from public, anon, authenticated;
revoke all on function notify_task_completed() from public, anon, authenticated;
revoke all on function notify_task_comment() from public, anon, authenticated;
revoke all on function notify_invoice_sent() from public, anon, authenticated;
revoke all on function notify_requirement_signoff() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policy helpers: a signed-in user must keep EXECUTE, because these are called
-- inside the RLS expressions on their own queries — without it every policy
-- that names one would error instead of filtering. `anon` has no rows to
-- filter and no business asking.
-- ---------------------------------------------------------------------------
revoke all on function is_admin() from public, anon;
revoke all on function current_org_id() from public, anon;
revoke all on function project_role_of(uuid) from public, anon;
revoke all on function has_project_access(uuid) from public, anon;
revoke all on function is_project_team(uuid) from public, anon;
revoke all on function is_project_client(uuid) from public, anon;
revoke all on function is_task_assignee(uuid) from public, anon;
revoke all on function is_internal_user() from public, anon;
revoke all on function is_client_of(uuid) from public, anon;
revoke all on function can_view_activity_entity(text, uuid) from public, anon;

grant execute on function is_admin() to authenticated;
grant execute on function current_org_id() to authenticated;
grant execute on function project_role_of(uuid) to authenticated;
grant execute on function has_project_access(uuid) to authenticated;
grant execute on function is_project_team(uuid) to authenticated;
grant execute on function is_project_client(uuid) to authenticated;
grant execute on function is_task_assignee(uuid) to authenticated;
grant execute on function is_internal_user() to authenticated;
grant execute on function is_client_of(uuid) to authenticated;
grant execute on function can_view_activity_entity(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The one function the app calls as RPC. Signing in is the floor: it derives
-- the caller's company from auth.uid(), and for an anonymous caller that is
-- null, so it could only ever have raised an exception — but it should not be
-- reachable at all.
-- ---------------------------------------------------------------------------
revoke all on function create_client_project(text, text, text, text, numeric, numeric, date, date)
  from public, anon;
grant execute on function create_client_project(text, text, text, text, numeric, numeric, date, date)
  to authenticated;

-- The client's only route to hours. Signed-in callers only; the where clause
-- inside the view is what decides which project's hours they actually get.
revoke all on project_hours_summary from anon;
grant select on project_hours_summary to authenticated;
