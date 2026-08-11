// Applies every migration to a real Postgres, in order, and fails loudly on
// the first one that won't run.
//
// This exists because until now not one line of supabase/migrations had ever
// been executed — the app was developed against a mock, so a typo, a column
// that moved, or a function signature that no longer matches would only have
// surfaced against the user's live project, halfway through a deploy.
//
// PGlite is Postgres proper, compiled to WASM, so no Docker and no local
// install: `npm run test:migrations` works on any machine that can run node.
//
// What it proves: the SQL applies to an empty database, in filename order, and
// leaves the objects the app expects behind. What it does NOT prove: that the
// RLS policies decide correctly — for that a policy has to be evaluated as a
// real signed-in user, which needs Supabase's auth. Those are the checks in
// scripts/test/visibility.mjs, and they still have to be re-run for real once
// the project is connected.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const DIR = "supabase/migrations";

// Supabase ships these before any migration runs. Recreated here just far
// enough that the migrations can reference them: the roles policies are
// granted to, the auth schema, and auth.uid() reading the same JWT claim
// Supabase sets. auth.uid() returns null here, which is what an anonymous
// caller looks like — enough to compile every policy that calls it.
const SUPABASE_PRELUDE = `
create schema if not exists auth;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
end $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;

create or replace function auth.email() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '');
$$;

-- Just enough of storage for 0030 to register its bucket. The real table has
-- a dozen more columns; only the three the migration names are needed for it
-- to apply, and nothing here should be read as a description of Supabase's
-- actual schema.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz default now()
);
`;

// Objects the app reads or writes by name. If a migration is renamed, split or
// reordered and something stops being created, this is what notices.
const EXPECTED_TABLES = [
  "organizations", "profiles", "clients", "projects", "project_members",
  "project_billing", "project_milestones", "tasks", "task_assignees",
  "task_comments", "comment_reactions", "task_subtasks", "time_entries",
  "invoices", "invoice_line_items", "payment_methods", "files",
  "project_links", "project_requirements", "personal_todos",
  "notifications", "activity_log", "project_invites",
];

const EXPECTED_FUNCTIONS = [
  "is_admin", "current_org_id", "project_role_of", "has_project_access",
  "is_project_team", "is_project_client", "is_task_assignee",
  "is_internal_user", "is_client_of", "create_client_project",
  "redeem_project_invite", "peek_project_invite",
];

const EXPECTED_VIEWS = ["project_hours_summary"];

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL  ${message}`);
};

const db = await PGlite.create();
await db.exec(SUPABASE_PRELUDE);

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

// Supabase keys applied migrations on the numeric prefix, so two files sharing
// one would collide on insert and the second would never be recorded.
const versions = new Map();
for (const file of files) {
  const version = file.split("_")[0];
  if (versions.has(version)) fail(`duplicate migration version ${version}: ${versions.get(version)} and ${file}`);
  versions.set(version, file);
}

for (const file of files) {
  const sql = readFileSync(join(DIR, file), "utf8");
  try {
    await db.exec(sql);
    console.log(`ok    ${file}`);
  } catch (error) {
    fail(`${file}\n      ${error.message}`);
    // Later migrations build on this one, so carrying on would bury the real
    // cause under a cascade of failures.
    break;
  }
}

// The seed runs right after the migrations during setup, so it is part of
// "does this apply to an empty database" and gets checked the same way.
try {
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  console.log("ok    seed.sql");
} catch (error) {
  fail(`seed.sql\n      ${error.message}`);
}

const has = async (sql, params) => (await db.query(sql, params)).rows.length > 0;

if (!(await has(`select 1 from organizations`))) fail("seed.sql left no organization row");

for (const table of EXPECTED_TABLES) {
  if (!(await has(`select 1 from pg_tables where schemaname = 'public' and tablename = $1`, [table]))) {
    fail(`table ${table} was never created`);
  }
}

for (const view of EXPECTED_VIEWS) {
  if (!(await has(`select 1 from pg_views where schemaname = 'public' and viewname = $1`, [view]))) {
    fail(`view ${view} was never created`);
  }
}

for (const fn of EXPECTED_FUNCTIONS) {
  if (!(await has(
    `select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1`, [fn]
  ))) {
    fail(`function ${fn}() was never created`);
  }
}

// RLS is the authorization boundary, so a public table without it enabled is a
// hole no amount of app-side checking closes.
const { rows: unguarded } = await db.query(`
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  order by c.relname
`);
for (const row of unguarded) fail(`table ${row.relname} has RLS disabled`);

// A table with RLS on and no policy denies everyone, which reads in the app as
// "the feature is broken" rather than as a permissions problem.
const { rows: policyless } = await db.query(`
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  order by c.relname
`);
for (const row of policyless) fail(`table ${row.relname} has RLS on but no policies`);

const { rows: counts } = await db.query(`
  select
    (select count(*) from pg_tables where schemaname = 'public') as tables,
    (select count(*) from pg_policy) as policies,
    (select count(*) from pg_trigger where not tgisinternal) as triggers
`);

await db.close();

console.log(
  `\n${files.length} migrations, ${counts[0].tables} tables, ` +
    `${counts[0].policies} policies, ${counts[0].triggers} triggers`
);

if (failures > 0) {
  console.error(`\n${failures} problem${failures === 1 ? "" : "s"} — the schema is not ready to apply.`);
  process.exit(1);
}
console.log("Schema applies cleanly.");
