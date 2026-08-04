-- Three things an invoice needs that had nowhere to live: a memo the agency
-- puts on every invoice, the account the client should pay into, and the
-- freedom to override the generated invoice number.

-- ---------------------------------------------------------------------------
-- A default memo, set once and dropped onto every new invoice. The invoice
-- keeps its own copy in `notes`, so editing this later never rewrites what a
-- client has already been sent.
-- ---------------------------------------------------------------------------
alter table organizations
  add column if not exists invoice_memo text;

-- ---------------------------------------------------------------------------
-- Where the money goes. Free-text `details` rather than modelled columns:
-- an IBAN, a Wise handle and an Upwork contract reference share no useful
-- shape, and pretending they do would mean a column per payment rail.
-- ---------------------------------------------------------------------------
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  kind text not null check (kind in ('bank', 'wise', 'upwork', 'other')),
  label text not null,
  details text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_methods_org_idx on payment_methods (org_id);

-- At most one default per org, enforced here rather than in app code that
-- could be raced by two admins saving at once.
create unique index payment_methods_one_default
  on payment_methods (org_id) where is_default;

alter table payment_methods enable row level security;

-- The agency's own banking details: admins only. Clients never read this
-- table — they see the snapshot copied onto their invoice instead.
create policy payment_methods_select on payment_methods
  for select using (is_admin() and org_id = current_org_id());
create policy payment_methods_insert on payment_methods
  for insert with check (is_admin() and org_id = current_org_id());
create policy payment_methods_update on payment_methods
  for update using (is_admin()) with check (is_admin());
create policy payment_methods_delete on payment_methods
  for delete using (is_admin());

create trigger payment_methods_updated_at before update on payment_methods
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- The invoice carries a snapshot of how to pay it, not a reference to the
-- method. Changing a bank account next year must not silently restate where
-- last year's invoices said to send the money.
-- ---------------------------------------------------------------------------
alter table invoices
  add column if not exists payment_method_kind text
    check (payment_method_kind in ('bank', 'wise', 'upwork', 'other')),
  add column if not exists payment_details text;
