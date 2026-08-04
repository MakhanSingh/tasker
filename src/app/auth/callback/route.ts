import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where every link Supabase emails comes back to — a password reset today, an
 * invite or a magic link tomorrow.
 *
 * The link carries a one-time `code`. Exchanging it here, on the server, is
 * what turns it into a session cookie; the code itself is spent in the process,
 * so a forwarded link is worth nothing once used.
 *
 * `next` decides where they land afterwards. It is checked to be a path on this
 * site: taken as given, `?next=https://elsewhere.example` would make our own
 * domain redirect people wherever an attacker liked, with the trust that domain
 * carries — and a freshly-authenticated session in hand.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // A single leading slash and nothing else: "//evil.example" is a protocol-
  // relative URL that browsers treat as another host.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link-invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Expired, already used, or issued for a different browser. All three mean
    // the same thing to the person holding it: ask for a fresh one.
    return NextResponse.redirect(`${origin}/login?error=link-expired`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
