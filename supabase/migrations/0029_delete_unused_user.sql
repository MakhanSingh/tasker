-- Removing a person, as distinct from switching them off.
--
-- Disabling is the right answer almost every time, and it is why it was built
-- first: it revokes access immediately while their hours stay on the invoices
-- they were billed on and their comments stay readable in the threads they
-- belong to. Someone who worked here for a year cannot be deleted without
-- taking the record of that year with them.
--
-- What deletion is actually for is the invite that went to a mistyped address,
-- or the account made twice by accident. Nobody has done anything as them, so
-- there is nothing to lose — and leaving those in the roster forever is how a
-- team page stops being a list of who works here.
--
-- Postgres would already refuse most of this, because tasks, comments and time
-- entries all reference profiles without a cascade. But it refuses by naming a
-- constraint, which tells an admin nothing about what to do instead.

create or replace function prevent_delete_active_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes int;
  v_comments int;
  v_assignments int;
  v_files int;
begin
  select coalesce(sum(coalesce(duration_minutes, 0)), 0) into v_minutes
  from time_entries where user_id = old.id;

  select count(*) into v_comments from task_comments where author_id = old.id;
  select count(*) into v_assignments from task_assignees where user_id = old.id;
  select count(*) into v_files from files where uploaded_by = old.id;

  if v_minutes > 0 or v_comments > 0 or v_assignments > 0 or v_files > 0 then
    raise exception
      '% has % minutes logged, % comment(s), % task(s) assigned and % file(s). Disable them instead — deleting would take that work off the record.',
      old.full_name, v_minutes, v_comments, v_assignments, v_files;
  end if;

  -- Nothing of theirs is worth keeping, but a few columns still point at them.
  -- These are attribution on rows that outlive the person, so they go to null
  -- rather than blocking the delete or dragging the row along with it.
  update projects              set created_by = null where created_by = old.id;
  update tasks                 set created_by = null where created_by = old.id;
  update task_subtasks         set created_by = null where created_by = old.id;
  update project_requirements  set created_by = null where created_by = old.id;
  update project_requirements  set decided_by = null where decided_by = old.id;
  update project_milestones    set created_by = null where created_by = old.id;
  update invoices              set created_by = null where created_by = old.id;
  update project_invites       set created_by = null where created_by = old.id;
  update activity_log          set actor_id   = null where actor_id   = old.id;

  -- project_links.created_by is NOT NULL, and a link with no author is still a
  -- useful link, so the rows go with the person who added them. They only
  -- exist at all if this person added them, and we already know they did no
  -- other work.
  delete from project_links where created_by = old.id;

  return old;
end;
$$;

revoke all on function prevent_delete_active_user() from public, anon, authenticated;

drop trigger if exists profiles_prevent_delete on profiles;
create trigger profiles_prevent_delete
  before delete on profiles
  for each row execute function prevent_delete_active_user();
