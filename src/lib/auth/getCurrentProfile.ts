import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VERIFIED_USER_HEADER } from "@/lib/supabase/verifiedUser";
import type { Database } from "@/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * The signed-in user, asked once per request.
 *
 * `auth.getUser()` is a network call to Supabase's auth server, not a cookie
 * read — it verifies the token rather than trusting it, which is the point.
 * But a layout, a nested layout and a page all needing to know who you are
 * meant asking three times over the wire, and on a project page it was closer
 * to eight.
 *
 * React's cache() dedupes for the lifetime of one request: the first caller
 * pays, the rest get the same promise. Nothing is cached between requests, so
 * a signed-out user is never served a stale identity.
 */
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The id of whoever is signed in, without a second trip to the auth server.
 *
 * The middleware verified the token a moment ago and put the result on the
 * request, so the common path is a header read. Anything the middleware
 * doesn't cover falls back to verifying properly — the header is a shortcut
 * past work already done, never a substitute for doing it.
 */
const getVerifiedUserId = cache(async (): Promise<string | null> => {
  const fromMiddleware = (await headers()).get(VERIFIED_USER_HEADER);
  if (fromMiddleware !== null) return fromMiddleware || null;
  return (await getSessionUser())?.id ?? null;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const userId = await getVerifiedUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();

  return profile;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}
