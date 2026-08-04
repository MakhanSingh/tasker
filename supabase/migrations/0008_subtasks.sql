-- Sub-tasks: the checklist inside a task card. A separate table rather than
-- self-referencing tasks — sub-tasks are lightweight (title + done), don't
-- appear on boards/calendars/reports, and never carry time or assignees, so
-- reusing the tasks table would force "parent_task_id is null" filters into
-- every existing query for no benefit.

create table task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_subtasks_task_idx on task_subtasks (task_id, position);

create trigger task_subtasks_set_updated_at before update on task_subtasks
  for each row execute function set_updated_at();

alter table task_subtasks enable row level security;

-- Visibility mirrors the parent task.
create policy task_subtasks_select on task_subtasks
  for select using (
    exists (
      select 1 from tasks t
      where t.id = task_subtasks.task_id
        and (is_admin() or is_project_team(t.project_id) or is_project_client(t.project_id))
    )
  );

create policy task_subtasks_insert on task_subtasks
  for insert with check (
    exists (
      select 1 from tasks t
      where t.id = task_subtasks.task_id
        and (is_admin() or project_role_of(t.project_id) in ('manager', 'editor'))
    )
  );

-- Toggling: managers/editors, or the parent task's assignee — the same rule
-- as changing the task's status.
create policy task_subtasks_update on task_subtasks
  for update using (
    exists (
      select 1 from tasks t
      where t.id = task_subtasks.task_id
        and (
          is_admin()
          or project_role_of(t.project_id) in ('manager', 'editor')
          or t.assignee_id = auth.uid()
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
          or t.assignee_id = auth.uid()
        )
    )
  );

create policy task_subtasks_delete on task_subtasks
  for delete using (
    exists (
      select 1 from tasks t
      where t.id = task_subtasks.task_id
        and (is_admin() or project_role_of(t.project_id) in ('manager', 'editor'))
    )
  );
