-- A client could be created and edited but never retired. When an engagement
-- ends the record has to go somewhere: leaving it in every picker forever is
-- how the client list becomes unusable after two years.
--
-- Archiving rather than deleting, because a client is referenced by projects
-- and invoices — financial records that must survive the relationship ending.
-- Deletion stays possible only for a client nothing points at, which is
-- enforced below rather than left to the app to remember.

alter table clients
  add column if not exists is_active boolean not null default true;

create index if not exists clients_active_idx on clients (org_id, is_active);

-- Refuses to delete a client that anything still refers to. A foreign key
-- would already block it, but with a message about constraint names; this
-- says what to do instead.
create or replace function prevent_delete_referenced_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projects int;
  v_invoices int;
begin
  select count(*) into v_projects from projects where client_id = old.id;
  select count(*) into v_invoices from invoices where client_id = old.id;

  if v_projects > 0 or v_invoices > 0 then
    raise exception
      'This client has % project(s) and % invoice(s). Archive it instead — deleting would take that history with it.',
      v_projects, v_invoices;
  end if;

  -- Portal users outlive the company record; unlink rather than orphan them.
  update profiles set client_id = null where client_id = old.id;

  return old;
end;
$$;

revoke all on function prevent_delete_referenced_client() from public, anon, authenticated;

drop trigger if exists clients_prevent_delete on clients;
create trigger clients_prevent_delete
  before delete on clients
  for each row execute function prevent_delete_referenced_client();
