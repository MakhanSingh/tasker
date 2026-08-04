-- A project could be created and edited but never closed out. `status` had
-- 'completed' and 'archived' from the start, and the only way to reach either
-- was the status dropdown buried in the edit form — so in practice every
-- project a team ever ran stayed in the sidebar and the projects list forever.
--
-- Deleting one needs a guard for the same reason clients do: the row is
-- referenced by hours people were paid for and by lines on invoices already
-- sent. Some of those foreign keys would block the delete anyway, but with a
-- message about constraint names; this says what to do instead.

create or replace function prevent_delete_used_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes int;
  v_lines int;
  v_files int;
begin
  select coalesce(sum(coalesce(duration_minutes, 0)), 0) into v_minutes
  from time_entries where project_id = old.id;

  select count(*) into v_lines from invoice_line_items where project_id = old.id;
  select count(*) into v_files from files where project_id = old.id;

  if v_minutes > 0 or v_lines > 0 or v_files > 0 then
    raise exception
      'This project has % minutes logged, % invoice line(s) and % file(s). Archive it instead — deleting would take that history with it.',
      v_minutes, v_lines, v_files;
  end if;

  -- An empty project may still carry rows nothing depends on: a timer someone
  -- started and abandoned, and files/links whose cascade isn't declared.
  delete from time_entries where project_id = old.id;
  delete from files where project_id = old.id;

  return old;
end;
$$;

revoke all on function prevent_delete_used_project() from public, anon, authenticated;

drop trigger if exists projects_prevent_delete on projects;
create trigger projects_prevent_delete
  before delete on projects
  for each row execute function prevent_delete_used_project();
