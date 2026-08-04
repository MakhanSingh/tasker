# RLS tests

`rls.sql` checks what each role can actually read, by evaluating the policies
directly rather than by clicking through the UI.

It works by impersonation: `set local role authenticated` plus the same
`request.jwt.claims` setting Supabase populates on a real request, so
`auth.uid()` returns the test identity and every policy runs exactly as it
would for that person. No passwords are involved — these identities are never
signed in as.

Everything happens inside a transaction that **rolls back**, so the fixtures
leave nothing behind. Verify with the count query at the bottom of this file
after a run.

## Running it

Paste into the Supabase SQL editor and run, or send it through whatever
connector you use. It returns one row per check with `ok` or `FAIL`.

## Why this and not the UI

The preview mock mirrored each policy by hand, which means it could only ever
confirm what it had been told. Four real policy bugs got through it — broken
notification triggers, an hours view that returned nothing to clients, refused
client file inserts, and profile names showing as "Unknown". Each looked
perfect on screen while Postgres quietly refused the query. This file asks
Postgres directly.

## Checking nothing was left behind

```sql
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from profiles)   as profiles,
  (select count(*) from clients)    as clients,
  (select count(*) from projects)   as projects;
```

Right after setup that should be 1 admin, 1 profile, 0 clients, 0 projects.

## invites.sql

The same shape, for the shareable invite links: that anonymous callers, expired,
revoked and spent links, links addressed to a different email, and links whose
role doesn't match the account type are all refused — and that opening your own
link a second time simply lands you on the project rather than failing.
