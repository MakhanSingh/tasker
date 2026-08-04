-- Supabase grants anon SELECT/INSERT/UPDATE/DELETE on every table in `public`
-- by default and leans entirely on RLS to keep the data in. That is the normal
-- model, and it holds — probing the live API as anon returns nothing from any
-- table.
--
-- It is still one policy away from a leak. Every table is protected by exactly
-- one thing, and the day someone writes `using (true)` on a table to debug
-- something, that table is world-readable over /rest/v1/ with a key that ships
-- in the browser bundle. Taking the grant away puts a second lock on the door,
-- one that a policy mistake cannot open.
--
-- Nothing anonymous needs these. The only unauthenticated route in the app is
-- /login, and signing in goes through Supabase's auth API, not PostgREST —
-- middleware redirects every other path before a query is ever made.
--
-- `authenticated` keeps everything: RLS is what decides which rows a signed-in
-- user sees, and that is unchanged.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- Also stop the default from re-granting on tables added later. Without this
-- the next migration that creates a table hands anon the keys to it again.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
