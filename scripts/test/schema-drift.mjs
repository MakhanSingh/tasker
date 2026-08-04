// Compares src/types/database.types.ts against the schema the migrations
// actually produce.
//
// Those types are hand-written, and every query in the app is typed by them.
// A column renamed in SQL but not in the types type-checks perfectly and then
// returns undefined at runtime against the real database — the one class of
// bug a mock-backed dev loop cannot show you. This is the check that would
// have caught `hourly_rate` moving off projects into project_billing.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const TYPES = "src/types/database.types.ts";
const DIR = "supabase/migrations";

const PRELUDE = `
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
`;

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL  ${message}`);
};

const db = await PGlite.create();
await db.exec(PRELUDE);
for (const file of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(DIR, file), "utf8"));
}

const { rows: columns } = await db.query(`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, column_name
`);

const live = new Map();
for (const { table_name, column_name } of columns) {
  if (!live.has(table_name)) live.set(table_name, new Set());
  live.get(table_name).add(column_name);
}

// The types file nests each table as `name: { Row: { ... } }`. Reading the Row
// block by brace depth rather than by regex keeps nested object types (jsonb
// payloads) from ending the block early.
const source = readFileSync(TYPES, "utf8");
const declared = new Map();
const tableRe = /^ {6}(\w+): \{$/gm;
let match;
while ((match = tableRe.exec(source)) !== null) {
  const table = match[1];
  const rowStart = source.indexOf("Row: {", match.index);
  if (rowStart === -1) continue;
  let depth = 0;
  let i = source.indexOf("{", rowStart);
  const start = i;
  for (; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const body = source.slice(start + 1, i);
  const fields = new Set(
    [...body.matchAll(/^\s{8,}(\w+)\??:/gm)].map((m) => m[1])
  );
  if (fields.size > 0) declared.set(table, fields);
}

if (declared.size === 0) {
  fail(`could not parse any table out of ${TYPES} — has its shape changed?`);
}

for (const [table, fields] of declared) {
  const actual = live.get(table);
  if (!actual) {
    fail(`${TYPES} declares table "${table}", which the migrations never create`);
    continue;
  }
  for (const field of fields) {
    if (!actual.has(field)) fail(`${table}.${field} is in the types but not in the schema`);
  }
}

// The reverse direction is a warning, not a failure: a column the app has no
// reason to read (a trigger's bookkeeping, say) is allowed to go untyped.
let untyped = 0;
for (const [table, actual] of live) {
  const fields = declared.get(table);
  if (!fields) continue;
  for (const column of actual) {
    if (!fields.has(column)) {
      console.warn(`warn  ${table}.${column} exists but is not in the types`);
      untyped += 1;
    }
  }
}

await db.close();

console.log(
  `\n${declared.size} typed tables checked against ${live.size} live ones` +
    (untyped > 0 ? `, ${untyped} untyped column${untyped === 1 ? "" : "s"}` : "")
);

if (failures > 0) {
  console.error(`\n${failures} mismatch${failures === 1 ? "" : "es"} — the types would lie at runtime.`);
  process.exit(1);
}
console.log("Types match the schema.");
