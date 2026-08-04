// Walks every page as each role and reports the HTTP status plus any
// Next.js error marker in the HTML. The preview role is a cookie, so a
// role switch is just a different Cookie header.
const BASE = "http://localhost:3000";
const P = { website: "30000000-0000-4000-8000-000000000001",
            mobile:  "30000000-0000-4000-8000-000000000002",
            dash:    "30000000-0000-4000-8000-000000000003" };
const T = "40000000-0000-4000-8000-000000000001";
const INV = "50000000-0000-4000-8000-000000000001";

const paths = [
  "/", "/todo", "/time", "/clients", "/team", "/invoices", "/invoices/new",
  `/invoices/${INV}`, "/projects", "/projects/new", "/settings",
  `/projects/${P.website}`, `/projects/${P.website}/tasks`,
  `/projects/${P.website}/tasks?view=list`, `/projects/${P.website}/tasks?view=calendar`,
  `/projects/${P.website}/tasks/${T}`, `/projects/${P.website}/overview`,
  `/projects/${P.website}/requirements`, `/projects/${P.website}/time`,
  `/projects/${P.website}/files`, `/projects/${P.website}/members`,
  `/projects/${P.mobile}/time`, `/projects/${P.dash}/tasks`,
];

const roles = ["admin", "member", "client"];

// Paths a role must NOT reach. A denied resource 404s rather than 403s, so
// the response never confirms that it exists.
const denied = {
  admin: [],
  member: [`/invoices/${INV}`, `/projects/${P.dash}/tasks`],
  client: [`/projects/${P.dash}/tasks`],
};

let failures = 0;

// This walk only means anything against a server in PREVIEW_MODE: the paths
// below use fixture ids, and the role is a cookie the mock client reads.
//
// Without the check, the suite passed while testing nothing. With the real
// database and no session, every path redirects to /login — and a redirect is
// counted as a legitimate outcome below, because a client bounced off /todo is
// exactly that. So all 69 went green having loaded the login page 69 times.
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
      "That means PREVIEW_MODE is off, and this suite would pass without loading a single real page.\n" +
      "Set PREVIEW_MODE=true, restart, and run it again."
  );
  process.exit(1);
}

for (const role of roles) {
  for (const path of paths) {
    if (denied[role].includes(path)) {
      const res = await fetch(BASE + path, {
        headers: { cookie: `tasker_preview_role=${role}` },
        redirect: "manual",
      });
      const blocked = res.status === 404 || (res.status >= 300 && res.status < 400);
      if (!blocked) { failures++; console.log(`NOT BLOCKED ${role} ${res.status} ${path}`); }
      continue;
    }
    const res = await fetch(BASE + path, {
      headers: { cookie: `tasker_preview_role=${role}` },
      redirect: "manual",
    });
    const body = res.status < 400 ? await res.text() : "";
    // A redirect is a legitimate outcome (a client bounced off /todo).
    const redirected = res.status >= 300 && res.status < 400;
    const errored = body.includes("__next_error__") || body.includes("Application error");
    const ok = redirected || (res.status === 200 && !errored);
    if (!ok) { failures++; console.log(`FAIL ${role.padEnd(6)} ${res.status} ${path}`); }
  }
}
const total = paths.length * roles.length;
const blocked = Object.values(denied).flat().length;
console.log(
  failures === 0
    ? `\nAll ${total} page loads OK (${total - blocked} reachable, ${blocked} correctly blocked)`
    : `\n${failures} failures`
);
