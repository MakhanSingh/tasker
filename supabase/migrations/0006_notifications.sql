-- In-app notifications. Rows are created by triggers (never by app code), so
-- a notification can't be missed because some code path forgot to send it —
-- the same reasoning as the activity log.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null
    check (type in ('task_assigned', 'task_comment', 'invoice_sent', 'requirement_signoff')),
  title text not null,
  body text,
  /** Where clicking the notification takes you. */
  link text,
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, is_read, created_at desc);

alter table notifications enable row level security;

-- Strictly personal, with no admin escape hatch: someone else's notification
-- feed is none of an admin's business.
create policy notifications_select on notifications
  for select using (user_id = auth.uid());

-- Only the read flag is ever updated, and only by the owner.
create policy notifications_update on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_delete on notifications
  for delete using (user_id = auth.uid());

-- No insert policy: rows arrive only through the SECURITY DEFINER triggers
-- below, so nobody can forge a notification for another user.

-- ---------------------------------------------------------------------------
-- A task is assigned to someone
-- ---------------------------------------------------------------------------
create or replace function notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if new.assignee_id is null then
    return new;
  end if;

  -- Only on a genuine change of assignee, and never notify yourself for
  -- something you just did.
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;
  if new.assignee_id = auth.uid() then
    return new;
  end if;

  select org_id into v_org_id from projects where id = new.project_id;

  insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
  values (
    v_org_id,
    new.assignee_id,
    'task_assigned',
    'New task assigned to you',
    new.title,
    '/projects/' || new.project_id || '/tasks/' || new.id,
    'task',
    new.id
  );

  return new;
end;
$$;

create trigger tasks_notify_assigned
  after insert or update of assignee_id on tasks
  for each row execute function notify_task_assigned();

-- ---------------------------------------------------------------------------
-- Someone comments on a task
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
  v_assignee_id uuid;
  v_link text;
begin
  select t.title, t.project_id, t.assignee_id
    into v_task_title, v_project_id, v_assignee_id
  from tasks t where t.id = new.task_id;

  select org_id into v_org_id from projects where id = v_project_id;
  v_link := '/projects/' || v_project_id || '/tasks/' || new.task_id;

  if v_assignee_id is not null and v_assignee_id <> new.author_id then
    insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
    values (v_org_id, v_assignee_id, 'task_comment', 'New comment on your task',
            left(new.body, 140), v_link, 'task', new.task_id);
  end if;

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

create trigger task_comments_notify
  after insert on task_comments
  for each row execute function notify_task_comment();

-- ---------------------------------------------------------------------------
-- An invoice is sent to a client
-- ---------------------------------------------------------------------------
create or replace function notify_invoice_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'sent' or (tg_op = 'UPDATE' and old.status = 'sent') then
    return new;
  end if;

  insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
  select distinct new.org_id, pm.user_id, 'invoice_sent',
         'Invoice ' || new.invoice_number || ' is ready',
         new.currency || ' ' || new.total::text || ' · due ' || new.due_date::text,
         '/invoices/' || new.id, 'invoice', new.id
  from project_members pm
  join projects p on p.id = pm.project_id
  where p.client_id = new.client_id
    and pm.project_role = 'client';

  return new;
end;
$$;

create trigger invoices_notify_sent
  after insert or update of status on invoices
  for each row execute function notify_invoice_sent();

-- ---------------------------------------------------------------------------
-- A requirement is waiting on the client's sign-off
-- ---------------------------------------------------------------------------
create or replace function notify_requirement_signoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if new.status <> 'proposed' or not new.is_client_visible then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'proposed' and old.is_client_visible then
    return new;
  end if;

  select org_id into v_org_id from projects where id = new.project_id;

  insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
  select v_org_id, pm.user_id, 'requirement_signoff',
         'A requirement needs your sign-off', new.title,
         '/projects/' || new.project_id || '/requirements', 'requirement', new.id
  from project_members pm
  where pm.project_id = new.project_id
    and pm.project_role = 'client';

  return new;
end;
$$;

create trigger project_requirements_notify_signoff
  after insert or update of status, is_client_visible on project_requirements
  for each row execute function notify_requirement_signoff();
