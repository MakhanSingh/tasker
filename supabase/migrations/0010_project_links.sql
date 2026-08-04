-- Links live alongside files: a Figma board or staging URL belongs in the
-- same place as the uploaded assets, with the same visibility rule.

create table project_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  url text not null,
  is_client_visible boolean not null default true,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index project_links_project_idx on project_links (project_id);

alter table project_links enable row level security;

-- Mirrors files exactly.
create policy project_links_select on project_links
  for select using (
    is_admin()
    or is_project_team(project_id)
    or (is_project_client(project_id) and is_client_visible)
  );

create policy project_links_insert on project_links
  for insert with check (
    created_by = auth.uid()
    and (is_admin() or project_role_of(project_id) in ('manager', 'editor'))
  );

create policy project_links_delete on project_links
  for delete using (is_admin() or created_by = auth.uid());
