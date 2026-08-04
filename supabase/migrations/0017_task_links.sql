-- Files & Links stopped being a place you add things and became a read-only
-- view of everything attached across the project's tasks. Files already
-- carried task_id; links did not, so a link had nowhere to be added from once
-- the project-level form went away.
--
-- Nullable, not required: links created before this migration belong to the
-- project rather than any one task, and dropping them would lose real data.

alter table project_links
  add column if not exists task_id uuid references tasks (id) on delete cascade;

create index if not exists project_links_task_idx on project_links (task_id);

-- A client may add a link to a task they raised, exactly as migration 0015
-- let them attach a file — and on the same condition, that it be visible to
-- them. An internal link from the client would be one they couldn't see.
drop policy if exists project_links_insert on project_links;

create policy project_links_insert on project_links
  for insert with check (
    created_by = auth.uid()
    and (
      is_admin()
      or project_role_of(project_id) in ('manager', 'editor')
      or (is_project_client(project_id) and is_client_visible)
    )
  );
