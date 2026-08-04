import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";
import { isPreviewMode } from "./preview/config";
import { VERIFIED_USER_HEADER } from "./verifiedUser";

const ADMIN_ONLY_PREFIXES = ["/clients", "/team", "/projects/new"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // In preview mode there is no real session to refresh or gate on — the
  // mock client supplies an identity, and /login is bypassed entirely.
  if (isPreviewMode()) {
    if (request.nextUrl.pathname.startsWith("/login")) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Hand the verified id downstream so the page doesn't ask again. getUser()
  // is a network call to the auth server — it verifies the token rather than
  // trusting it, which is the point, but doing it twice per request bought
  // nothing and cost ~200ms.
  //
  // Set unconditionally, empty string included: a client that forges this
  // header must have it overwritten, not merely left alone when there is no
  // session to overwrite it with.
  request.headers.set(VERIFIED_USER_HEADER, user?.id ?? "");
  response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  // /invite is deliberately public: a shared link has to work for someone who
  // has no account yet, which is the whole reason it exists. The token is what
  // authorizes them, and it is checked server-side.
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/invite");

  if (!user && !isAuthRoute) {
    // An API caller gets an answer it can parse. Redirecting one to /login
    // hands it a 200 and a page of HTML, so the notification poller spent
    // every cycle parsing the login screen and finding no notifications in it.
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Someone already signed in who opens an invite link should land on the
  // invite, not be bounced home before they can accept it.
  if (user && isAuthRoute && !path.startsWith("/invite")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  // UX-only guard — the real authorization boundary is Postgres RLS, not this
  // check. It just avoids flashing an admin page a non-admin can't act on.
  if (user && ADMIN_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }
  }

  return response;
}
