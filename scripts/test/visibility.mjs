// Asserts the confidentiality rules against the actually-rendered HTML,
// rather than trusting that the right component was used.
const BASE = "http://localhost:3000";
const P = { website: "30000000-0000-4000-8000-000000000001",
            mobile:  "30000000-0000-4000-8000-000000000002",
            dash:    "30000000-0000-4000-8000-000000000003" };
const T = "40000000-0000-4000-8000-000000000001";

const get = async (path, role) =>
  (await fetch(BASE + path, { headers: { cookie: `tasker_preview_role=${role}` } })).text();

// Same caveat as pages.mjs: these leak checks read rendered HTML, so against a
// server that isn't in PREVIEW_MODE every page is the login page — which
// contains no rates, no invoices and no client names, and therefore "leaks"
// nothing. A green run would mean nothing at all.
const preflight = await fetch(BASE + "/", {
  headers: { cookie: `tasker_preview_role=admin` },
  redirect: "manual",
}).catch(() => null);

if (!preflight) {
  console.error(`No server on ${BASE}. Start one with PREVIEW_MODE=true first.`);
  process.exit(1);
}
if (preflight.status >= 300 && preflight.status < 400) {
  console.error(
    `The server on ${BASE} redirected / to ${preflight.headers.get("location")}.\n` +
      "PREVIEW_MODE is off, so every page here would be the login page and every\n" +
      "leak check would pass for the wrong reason. Set PREVIEW_MODE=true and retry."
  );
  process.exit(1);
}


const checks = [
  // A team member must see no money anywhere.
  ["member sees no rate on the project", `/projects/${P.website}/time`, "member", ["USD", "Hourly", "Payments", "INV-"]],
  ["member sees no money on a task", `/projects/${P.website}/tasks/${T}`, "member", ["USD", "per hour"]],
  ["member sees no money on overview", `/projects/${P.website}/overview`, "member", ["USD", "Hourly rate"]],
  // A client must not see internal material, nor another client's work.
  ["client sees no internal comment", `/projects/${P.website}/tasks/${T}`, "client", ["hardcode for now", "phase 2 scope doc"]],
  ["client sees no internal file", `/projects/${P.website}/files`, "client", ["internal-scope-notes", "Internal scope sheet"]],
  ["client sees no draft invoice", "/invoices", "client", ["INV-0003"]],
  ["client sees no other client's project", "/", "client", ["Analytics Dashboard", "Nova Fintech"]],
  ["client sees no internal team roster", `/projects/${P.website}/tasks/${T}`, "client", ["Assignees"]],
  // A member is not on the dashboard project at all.
  ["member sees no unassigned project", "/", "member", ["Analytics Dashboard"]],
];

let failures = 0;
for (const [name, path, role, forbidden] of checks) {
  const html = await get(path, role);
  const hits = forbidden.filter((needle) => html.includes(needle));
  if (hits.length) { failures++; console.log(`LEAK  ${name} → found ${JSON.stringify(hits)}`); }
  else console.log(`ok    ${name}`);
}
console.log(failures === 0 ? "\nNo leaks." : `\n${failures} leaks.`);
