-- Projects sorted by what's alive, the way Slack orders channels: whatever was
-- touched most recently sits at the top, so the sidebar reorders itself around
-- the work instead of being an alphabetical filing cabinet.
--
-- `updated_at` can't answer this. It means "this row changed", and a task
-- added, an hour logged or a comment left changes a different row entirely —
-- the project's own timestamp sits still while the project is busy. Overloading
-- it to mean two things would be a lie the next person has to discover.
--
-- Denormalised on purpose. The honest alternative is a max() across tasks,
-- comments, time entries, files, links and requirements on every page load,
-- which is six scans to order a sidebar.

alter table projects
  add column if not exists last_activity_at timestamptz not null default now();

-- Sorting reads this on every page load, newest first.
create index if not exists projects_last_activity_idx on projects (last_activity_at desc);

-- Start from something truthful rather than "everything happened at once".
update projects set last_activity_at = greatest(updated_at, created_at);

create or replace function touch_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  -- Most of these tables carry project_id directly; comments and subtasks
  -- reach it through their task.
  if tg_table_name in ('task_comments', 'task_subtasks') then
    select project_id into v_project_id
    from tasks
    where id = coalesce(new.task_id, old.task_id);
  else
    v_project_id := coalesce(new.project_id, old.project_id);
  end if;

  if v_project_id is not null then
    update projects set last_activity_at = now() where id = v_project_id;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function touch_project() from public, anon, authenticated;

create trigger tasks_touch_project
  after insert or update or delete on tasks
  for each row execute function touch_project();

create trigger task_comments_touch_project
  after insert on task_comments
  for each row execute function touch_project();

create trigger time_entries_touch_project
  after insert or update on time_entries
  for each row execute function touch_project();

create trigger files_touch_project
  after insert on files
  for each row execute function touch_project();

create trigger project_links_touch_project
  after insert on project_links
  for each row execute function touch_project();

create trigger project_requirements_touch_project
  after insert or update on project_requirements
  for each row execute function touch_project();

create trigger project_members_touch_project
  after insert on project_members
  for each row execute function touch_project();

-- ---------------------------------------------------------------------------
-- The bump must not become an event of its own.
--
-- log_project_activity fires on every update to projects, so without this
-- guard each task added would also write "project updated" to the activity
-- feed — the feed would fill with echoes of entries already in it.
-- ---------------------------------------------------------------------------
create or replace function log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
    values (new.org_id, auth.uid(), 'project', new.id, 'created', null);
  elsif tg_op = 'UPDATE' then
    -- Nothing about the project itself changed; this is the activity stamp
    -- moving because something inside it did, and that already logged itself.
    if (new.name, new.description, new.status, new.client_id, new.start_date, new.end_date)
       is not distinct from
       (old.name, old.description, old.status, old.client_id, old.start_date, old.end_date)
    then
      return new;
    end if;

    if new.status is distinct from old.status then
      insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
      values (new.org_id, auth.uid(), 'project', new.id, 'status_changed',
        jsonb_build_object('from', old.status, 'to', new.status));
    else
      insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
      values (new.org_id, auth.uid(), 'project', new.id, 'updated', null);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function log_project_activity() from public, anon, authenticated;
