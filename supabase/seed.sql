-- Seeds the single organization row for Phase 1 (single-tenant use).
-- The first admin user is created separately via `npm run create-admin`
-- (needs a real auth.users row, which Supabase's Admin API must create —
-- not something safe/possible to do from a plain SQL seed file).
insert into organizations (name, slug)
values ('Default Organization', 'default')
on conflict (slug) do nothing;
