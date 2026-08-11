// Checks .env.local is filled in and plausible, without ever printing a value.
//
//   npm run check:env
//
// Every message here says what is wrong with a variable, never what is in it,
// so the output is safe to paste anywhere — including into a chat with me.
import { readFileSync, existsSync } from "node:fs";

const FILE = ".env.local";

if (!existsSync(FILE)) {
  console.error(`No ${FILE}. Run:  cp .env.example .env.local`);
  process.exit(1);
}

// Parsed here rather than with --env-file so a missing file gives the message
// above instead of a node crash, and so quotes and comments are handled.
const env = {};
for (const line of readFileSync(FILE, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

let problems = 0;
const bad = (message) => {
  problems += 1;
  console.error(`✗ ${message}`);
};
const good = (message) => console.log(`✓ ${message}`);

// A value still holding the template's placeholder is the commonest miss: the
// file exists, the variable is "set", and nothing works.
const filled = (name) => {
  const value = env[name];
  if (!value) return bad(`${name} is empty`);
  if (/YOUR-PROJECT-REF|placeholder|changeme/i.test(value)) {
    return bad(`${name} still has the example placeholder in it`);
  }
  return value;
};

const url = filled("NEXT_PUBLIC_SUPABASE_URL");
if (url) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    bad("NEXT_PUBLIC_SUPABASE_URL should look like https://<project-ref>.supabase.co — no path, no trailing segments");
  } else {
    good("NEXT_PUBLIC_SUPABASE_URL looks like a project URL");
  }
}

// Supabase issues either the newer sb_publishable_/sb_secret_ pair or the
// original anon/service_role JWTs, depending on when the project was made.
// Both work; what matters is not mixing them up.
const anon = filled("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (anon) {
  if (anon.startsWith("sb_secret_") || /"role":"service_role"/.test(safeJwt(anon))) {
    bad("NEXT_PUBLIC_SUPABASE_ANON_KEY holds the SECRET key. Anything NEXT_PUBLIC_ is shipped to the browser — swap it for the publishable/anon key and rotate the secret one");
  } else if (anon.startsWith("sb_publishable_") || anon.startsWith("eyJ")) {
    good("NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a publishable/anon key");
  } else {
    bad("NEXT_PUBLIC_SUPABASE_ANON_KEY doesn't look like a Supabase key (expected sb_publishable_… or eyJ…)");
  }
}

const service = filled("SUPABASE_SERVICE_ROLE_KEY");
if (service) {
  if (service.startsWith("sb_publishable_") || /"role":"anon"/.test(safeJwt(service))) {
    bad("SUPABASE_SERVICE_ROLE_KEY holds the publishable/anon key — invites and create-admin will fail");
  } else if (service.startsWith("sb_secret_") || service.startsWith("eyJ")) {
    good("SUPABASE_SERVICE_ROLE_KEY looks like a secret/service_role key");
  } else {
    bad("SUPABASE_SERVICE_ROLE_KEY doesn't look like a Supabase key (expected sb_secret_… or eyJ…)");
  }
  if (anon && service === anon) bad("The anon and service_role keys are identical — one of them is pasted in the wrong place");
}

for (const name of Object.keys(env)) {
  if (name.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|SECRET/i.test(name)) {
    bad(`${name} is prefixed NEXT_PUBLIC_, which ships it to every visitor's browser. Rename it and rotate the key`);
  }
}

const preview = env.PREVIEW_MODE;
if (preview === "true") {
  console.log("\n· PREVIEW_MODE=true — still on fixtures. Flip it to false once the schema is applied.");
} else if (preview === "false") {
  console.log("\n· PREVIEW_MODE=false — queries go to Supabase for real.");
} else {
  bad(`PREVIEW_MODE should be "true" or "false"`);
}

const storage = env.STORAGE_PROVIDER ?? "local";
if (storage === "local") {
  const root = env.STORAGE_ROOT ?? "./storage";
  console.log("· STORAGE_PROVIDER=local — needs a host with a persistent disk (a VPS). On serverless, uploads vanish between requests.");
  // The default puts uploads inside the checkout, so the next deploy replaces
  // them. Silent until someone opens a task and finds the attachment gone,
  // which is exactly the failure this line exists to get ahead of.
  if (root.startsWith("./") || root.startsWith("storage")) {
    bad(`STORAGE_ROOT=${root} is inside the checkout — a deploy will replace it and take every attachment with it. Use an absolute path on a persistent disk, or STORAGE_PROVIDER=supabase.`);
  }
} else if (storage === "supabase") {
  console.log(`· STORAGE_PROVIDER=supabase — attachments live in the "${env.STORAGE_BUCKET ?? "attachments"}" bucket and survive deploys. Migration 0030 must have run.`);
} else {
  bad(`STORAGE_PROVIDER should be "supabase" or "local", not "${storage}"`);
}
if ((env.EMAIL_PROVIDER ?? "console") === "console") {
  console.log("· EMAIL_PROVIDER=console — mail is printed to the server log, not sent.");
}

/** Decodes a JWT payload for the role claim only; never returns the signature. */
function safeJwt(token) {
  try {
    return Buffer.from(token.split(".")[1], "base64url").toString("utf8");
  } catch {
    return "";
  }
}

if (problems > 0) {
  console.error(`\n${problems} problem${problems === 1 ? "" : "s"} in ${FILE}.`);
  process.exit(1);
}
console.log("\n.env.local looks ready.");
