-- Activity log is populated exclusively by triggers (SECURITY DEFINER, so
-- they can insert into activity_log even though `authenticated` has no
-- insert policy on it) — this can't be silently skipped by an app code path
-- that forgets to log something.

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

create trigger projects_log_activity
  after insert or update on projects
  for each row execute function log_project_activity();

create or replace function log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from projects where id = coalesce(new.project_id, old.project_id);

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
    values (v_org_id, auth.uid(), 'task', new.id, 'created', null);
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
      values (v_org_id, auth.uid(), 'task', new.id, 'status_changed',
        jsonb_build_object('from', old.status, 'to', new.status));
    else
      insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
      values (v_org_id, auth.uid(), 'task', new.id, 'updated', null);
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_log_activity
  after insert or update on tasks
  for each row execute function log_task_activity();

create or replace function log_time_entry_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from projects where id = new.project_id;

  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
    values (v_org_id, auth.uid(), 'time_entry', new.id, 'created', null);
  elsif tg_op = 'UPDATE' then
    if old.ended_at is null and new.ended_at is not null then
      insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
      values (v_org_id, auth.uid(), 'time_entry', new.id, 'completed',
        jsonb_build_object('duration_minutes', new.duration_minutes));
    end if;
  end if;
  return new;
end;
$$;

create trigger time_entries_log_activity
  after insert or update on time_entries
  for each row execute function log_time_entry_activity();

create or replace function log_invoice_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
    values (new.org_id, auth.uid(), 'invoice', new.id, 'created', null);
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into activity_log (org_id, actor_id, entity_type, entity_id, action, metadata)
      values (new.org_id, auth.uid(), 'invoice', new.id, 'status_changed',
        jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  end if;
  return new;
end;
$$;

create trigger invoices_log_activity
  after insert or update on invoices
  for each row execute function log_invoice_activity();
