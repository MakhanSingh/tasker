-- Private scratch list for things that aren't project tasks — "call the
-- client back", "chase the signed SOW". Strictly personal: no one else in
-- the org can read another person's todos, not even an admin.

create table personal_todos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  due_date date,
  is_done boolean not null default false,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_todos_user_idx on personal_todos (user_id, is_done, due_date);

create trigger personal_todos_set_updated_at before update on personal_todos
  for each row execute function set_updated_at();

alter table personal_todos enable row level security;

-- Deliberately owner-only on every verb, with no admin escape hatch: an
-- admin overseeing the agency has no business reading someone's private
-- list, and leaving one out would silently grant that.
create policy personal_todos_select on personal_todos
  for select using (user_id = auth.uid());

create policy personal_todos_insert on personal_todos
  for insert with check (user_id = auth.uid());

create policy personal_todos_update on personal_todos
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy personal_todos_delete on personal_todos
  for delete using (user_id = auth.uid());
