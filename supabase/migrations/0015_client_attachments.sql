-- files_insert named only admins, managers and editors, so a client could
-- never attach anything. That already broke a documented behaviour — a client
-- replying with a screenshot on a comment — which the upload route permits but
-- the policy refused; and it blocks attaching a reference to a task they raise.
--
-- The clause below covers both, because it isn't comment-specific: a client
-- may add a file to a project they're on, provided it is client-visible.
-- An internal file from the client would be one they couldn't see themselves,
-- which is nonsense, and it would let them post something the team can't
-- discuss back with them.

drop policy if exists files_insert on files;

create policy files_insert on files
  for insert with check (
    is_admin()
    or (project_id is not null and project_role_of(project_id) in ('manager', 'editor'))
    or (project_id is not null and is_project_client(project_id) and is_client_visible)
  );
