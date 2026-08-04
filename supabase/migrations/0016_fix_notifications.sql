-- The notification triggers were written against tasks.assignee_id, which
-- migration 0009 dropped when a task gained several assignees. Every function
-- below still referenced it, so the moment anyone assigned a task or left a
-- comment the trigger raised "record new has no field assignee_id" and the
-- write failed outright. In-app notifications have been broken since 0009.
--
-- This rebuilds them against task_assignees, and adds the two events that
-- were never covered: a task being created, and a task being finished.

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'task_assigned',
    'task_created',
    'task_completed',
    'task_comment',
    'invoice_sent',
    'requirement_signoff'
  ));

-- ---------------------------------------------------------------------------
-- Assigned to you — now keyed on the join table, one row per assignment.
-- ---------------------------------------------------------------------------
-- Two generations of this trigger have to go, not one. 0006 put
-- tasks_notify_assigned on tasks.assignee_id; 0009 dropped that column, moved
-- the trigger to the join table as task_assignees_notify, and pointed it at
-- notify_task_assignee_added(). Dropping only the 0006 name left the 0009
-- trigger standing, and the create below then failed on a fresh database.
drop trigger if exists tasks_notify_assigned on tasks;
drop trigger if exists task_assignees_notify on task_assignees;
drop function if exists notify_task_assigned();
drop function if exists notify_task_assignee_added();

create or replace function notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_org_id uuid;
begin
  -- Assigning something to yourself is not news.
  if new.user_id = auth.uid() then
    return new;
  end if;

  select t.title, t.project_id into v_task from tasks t where t.id = new.task_id;
  select org_id into v_org_id from projects where id = v_task.project_id;

  insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
  values (
    v_org_id, new.user_id, 'task_assigned', 'New task assigned to you', v_task.title,
    '/projects/' || v_task.project_id || '/tasks/' || new.task_id, 'task', new.task_id
  );

  return new;
end;
$$;

create trigger task_assignees_notify
  after insert on task_assignees
  for each row execute function notify_task_assigned();

-- ---------------------------------------------------------------------------
-- A new task appears on a project — the team hears about it, which is what
-- makes a client's request land somewhere rather than sitting unseen.
-- ---------------------------------------------------------------------------
create or replace function notify_task_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from projects where id = new.project_id;

  insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
  select v_org_id, pm.user_id, 'task_created', 'New task on this project', new.title,
         '/projects/' || new.project_id || '/tasks/' || new.id, 'task', new.id
  from project_members pm
  where pm.project_id = new.project_id
    -- The team, not the client: a client raising a task doesn't need telling.
    and pm.project_role in ('manager', 'editor')
    and pm.user_id <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid);

  return new;
end;
$$;

drop trigger if exists tasks_notify_created on tasks;
create trigger tasks_notify_created
  after insert on tasks
  for each row execute function notify_task_created();

-- ---------------------------------------------------------------------------
-- A task is finished — the client sees progress without having to ask, and
-- assignees who didn't move it are kept in the loop.
-- ---------------------------------------------------------------------------
create or replace function notify_task_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_link text;
begin
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;

  select org_id into v_org_id from projects where id = new.project_id;
  v_link := '/projects/' || new.project_id || '/tasks/' || new.id;

  insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
  select distinct v_org_id, recipient, 'task_completed', 'Task completed', new.title,
         v_link, 'task', new.id
  from (
    select ta.user_id as recipient from task_assignees ta where ta.task_id = new.id
    union
    select pm.user_id from project_members pm
    where pm.project_id = new.project_id and pm.project_role in ('manager', 'client')
  ) recipients
  where recipient <> auth.uid();

  return new;
end;
$$;

drop trigger if exists tasks_notify_completed on tasks;
create trigger tasks_notify_completed
  after update of status on tasks
  for each row execute function notify_task_completed();

-- ---------------------------------------------------------------------------
-- Comments — same intent as before, but reaching every assignee rather than
-- the one column that no longer exists.
-- ---------------------------------------------------------------------------
create or replace function notify_task_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_task_title text;
  v_project_id uuid;
  v_link text;
begin
  select t.title, t.project_id into v_task_title, v_project_id
  from tasks t where t.id = new.task_id;

  select org_id into v_org_id from projects where id = v_project_id;
  v_link := '/projects/' || v_project_id || '/tasks/' || new.task_id;

  insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
  select v_org_id, ta.user_id, 'task_comment', 'New comment on your task',
         left(new.body, 140), v_link, 'task', new.task_id
  from task_assignees ta
  where ta.task_id = new.task_id and ta.user_id <> new.author_id;

  -- Clients only hear about comments that were shared with them.
  if not new.is_internal then
    insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
    select v_org_id, pm.user_id, 'task_comment', 'New comment on ' || v_task_title,
           left(new.body, 140), v_link, 'task', new.task_id
    from project_members pm
    where pm.project_id = v_project_id
      and pm.project_role = 'client'
      and pm.user_id <> new.author_id;
  end if;

  return new;
end;
$$;
