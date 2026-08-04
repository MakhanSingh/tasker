-- Threaded comments + attachments on comments.

-- A reply points at its parent; deleting a comment takes its replies with it.
alter table task_comments
  add column parent_id uuid references task_comments (id) on delete cascade;

create index task_comments_parent_idx on task_comments (parent_id);

-- A file can now hang off a specific comment (a screenshot dropped into a
-- reply). Deleting the comment deletes its attachments' metadata; the blob
-- cleanup is the storage layer's concern.
alter table files
  add column comment_id uuid references task_comments (id) on delete cascade;

create index files_comment_idx on files (comment_id);

-- Comment attachments may be uploaded by ANYONE with access to the project —
-- including viewers and clients, who can comment but could not previously
-- upload. Plain project/task files keep the old manager/editor rule. A
-- client's uploads must always be client-visible (they cannot create
-- internal-only files).
drop policy files_insert on files;
create policy files_insert on files
  for insert with check (
    is_admin()
    or (
      project_id is not null
      and comment_id is null
      and project_role_of(project_id) in ('manager', 'editor')
    )
    or (
      project_id is not null
      and comment_id is not null
      and has_project_access(project_id)
      and (project_role_of(project_id) <> 'client' or is_client_visible)
    )
  );

-- Moving a task between projects rewrites files.project_id; there was no
-- update policy at all, which blocks even admins.
create policy files_update on files
  for update using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Emoji reactions on comments. One row per (comment, user, emoji); toggling
-- off deletes the row.
-- ---------------------------------------------------------------------------
create table comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references task_comments (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create index comment_reactions_comment_idx on comment_reactions (comment_id);

alter table comment_reactions enable row level security;

-- Visibility mirrors the comment itself: team sees everything on their
-- projects, clients only reactions on client-visible comments.
create policy comment_reactions_select on comment_reactions
  for select using (
    is_admin()
    or exists (
      select 1 from task_comments c
      join tasks t on t.id = c.task_id
      where c.id = comment_reactions.comment_id
        and (
          is_project_team(t.project_id)
          or (not c.is_internal and is_project_client(t.project_id))
        )
    )
  );

create policy comment_reactions_insert on comment_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from task_comments c
      join tasks t on t.id = c.task_id
      where c.id = comment_reactions.comment_id
        and (
          is_admin()
          or is_project_team(t.project_id)
          or (not c.is_internal and is_project_client(t.project_id))
        )
    )
  );

create policy comment_reactions_delete on comment_reactions
  for delete using (user_id = auth.uid());
