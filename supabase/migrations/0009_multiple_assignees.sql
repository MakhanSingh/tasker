-- A task can have several assignees. tasks.assignee_id moves into a join
-- table; every "am I the assignee?" rule becomes "am I *an* assignee".

create table task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create index task_assignees_task_idx on task_assignees (task_id);
create index task_assignees_user_idx on task_assignees (user_id);

-- Carry the existing single assignee over.
insert into task_assignees (task_id, user_id)
select id, assignee_id from tasks where assignee_id is not null;

-- SECURITY DEFINER so policies on tasks/task_subtasks can consult the join
-- table without recursing through its own RLS.
create or replace function is_task_assignee(p_task_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from task_assignees
    where task_id = p_task_id and user_id = auth.uid()
  );
$$;

grant execute on function is_task_assignee(uuid) to authenticated;

alter table task_assignees enable row level security;

-- Visibility mirrors the task; assignment changes are manage-level actions.
create policy task_assignees_select on task_assignees
  for select using (
    exists (
      select 1 from tasks t
      where t.id = task_assignees.task_id
        and (is_admin() or is_project_team(t.project_id) or is_project_client(t.project_id))
    )
  );

create policy task_assignees_insert on task_assignees
  for insert with check (
    exists (
      select 1 from tasks t
      where t.id = task_assignees.task_id
        and (is_admin() or project_role_of(t.project_id) in ('manager', 'editor'))
    )
  );

create policy task_assignees_delete on task_assignees
  for delete using (
    exists (
      select 1 from tasks t
      where t.id = task_assignees.task_id
        and (is_admin() or project_role_of(t.project_id) in ('manager', 'editor'))
    )
  );

-- Self-service rules that keyed on assignee_id now key on the join table.
drop policy tasks_update on tasks;
create policy tasks_update on tasks
  for update using (
    is_admin()
    or project_role_of(project_id) in ('manager', 'editor')
    or is_task_assignee(id)
  )
  with check (
    is_admin()
    or project_role_of(project_id) in ('manager', 'editor')
    or is_task_assignee(id)
  );

drop policy task_subtasks_update on task_subtasks;
create policy task_subtasks_update on task_subtasks
  for update using (
    exists (
      select 1 from tasks t
      where t.id = task_subtasks.task_id
        and (
          is_admin()
          or project_role_of(t.project_id) in ('manager', 'editor')
          or is_task_assignee(t.id)
        )
    )
  )
  with check (
    exists (
      select 1 from tasks t
      where t.id = task_subtasks.task_id
        and (
          is_admin()
          or project_role_of(t.project_id) in ('manager', 'editor')
          or is_task_assignee(t.id)
        )
    )
  );

-- The assignment notification now fires per join-row insert, replacing the
-- column-watching trigger from 0006.
drop trigger tasks_notify_assigned on tasks;
drop function notify_task_assigned();

create or replace function notify_task_assignee_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_title text;
  v_project_id uuid;
begin
  if new.user_id = auth.uid() then
    return new;
  end if;

  select t.title, t.project_id into v_title, v_project_id from tasks t where t.id = new.task_id;
  select org_id into v_org_id from projects where id = v_project_id;

  insert into notifications (org_id, user_id, type, title, body, link, entity_type, entity_id)
  values (
    v_org_id,
    new.user_id,
    'task_assigned',
    'New task assigned to you',
    v_title,
    '/projects/' || v_project_id || '/tasks/' || new.task_id,
    'task',
    new.task_id
  );

  return new;
end;
$$;

create trigger task_assignees_notify
  after insert on task_assignees
  for each row execute function notify_task_assignee_added();

-- The column is now dead.
drop index if exists tasks_assignee_idx;
alter table tasks drop column assignee_id;
