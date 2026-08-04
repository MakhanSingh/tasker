-- project_hours_summary exists so clients can read hours without reading raw
-- time_entries — but it was declared `security_invoker = true`, which makes it
-- run under the caller's own permissions. time_entries_select grants a client
-- nothing, so the view returned zero rows to exactly the people it was built
-- for. Clients' hours only ever appeared in the preview mock.
--
-- The fix is the standard security-definer-view shape: run as the view's
-- owner (bypassing time_entries' RLS) and do the scoping in the view itself.
-- is_admin() and has_project_access() are SECURITY DEFINER and read
-- auth.uid(), so they still evaluate per caller — without the where clause
-- this view would hand every project's hours to everyone.

drop view if exists project_hours_summary;

create view project_hours_summary
with (security_invoker = false)
as
select
  te.project_id,
  te.task_id,
  date_trunc('day', te.started_at) as work_date,
  sum(coalesce(te.duration_minutes, 0)) as total_minutes,
  bool_or(te.is_billable) as has_billable
from time_entries te
where te.ended_at is not null
  and (is_admin() or has_project_access(te.project_id))
group by te.project_id, te.task_id, date_trunc('day', te.started_at);

-- The view is the client's only route to hours; the base table stays closed
-- to them. Deliberately no grant to anon.
grant select on project_hours_summary to authenticated;
