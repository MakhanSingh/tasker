// Creates the very first admin user (auth.users row via the Admin API, plus
// the matching profiles row). Run once after applying migrations + seed.sql:
//
//   npm run create-admin "Admin Name" admin@example.com
//
// The password is asked for, never passed as an argument. An argument would be
// written verbatim into ~/.zsh_history and visible to any other process on the
// machine through `ps` — a password that leaks the moment it is set. It is read
// here with echo switched off, so it is never displayed either.
//
// Not exposed as an in-app "invite" flow yet in Phase 1 — this bootstraps
// the one admin needed to start inviting everyone else through the app.
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";

const [, , fullName, email, passwordArg] = process.argv;

if (!fullName || !email) {
  console.error("Usage: npm run create-admin <full name> <email>");
  process.exit(1);
}

if (passwordArg) {
  console.error(
    "Don't pass the password as an argument — it lands in your shell history\n" +
      "and is visible to other processes. Re-run without it and type it at the prompt."
  );
  process.exit(1);
}

/** Reads a line with the terminal's echo off, so nothing is shown as it's typed. */
function askSecret(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Swallow the echoed characters rather than printing them.
    const write = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (chunk) => {
      if (chunk.includes(prompt)) write?.(chunk);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = await askSecret("Password for the new admin: ");

if (password.length < 8) {
  console.error("That password is under 8 characters — Supabase will reject it.");
  process.exit(1);
}

const confirm = await askSecret("Type it again: ");
if (confirm !== password) {
  console.error("The two passwords don't match.");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: org, error: orgError } = await supabase
  .from("organizations")
  .select("id")
  .eq("slug", "default")
  .single();

if (orgError || !org) {
  console.error("Could not find the seeded 'default' organization. Did you run supabase/seed.sql?", orgError);
  process.exit(1);
}

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createError || !created.user) {
  console.error("Failed to create auth user:", createError);
  process.exit(1);
}

const { error: profileError } = await supabase.from("profiles").insert({
  id: created.user.id,
  org_id: org.id,
  role: "admin",
  full_name: fullName,
  email,
});

if (profileError) {
  console.error("Auth user created, but failed to insert profile row:", profileError);
  process.exit(1);
}

console.log(`Admin user created: ${email}`);
