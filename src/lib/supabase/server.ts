import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";
import { isPreviewMode, normalizeRole, PREVIEW_ROLE_COOKIE } from "./preview/config";
import { createMockClient } from "./preview/mockClient";

// Use inside Server Components, Server Actions, and Route Handlers. Runs
// with the caller's session, so every Postgres RLS policy applies exactly
// as it would for a direct client call — there is no separate authorization
// layer to keep in sync with the database policies.
export async function createClient() {
  const cookieStore = await cookies();

  // PREVIEW_MODE swaps in fixture data so the UI can be reviewed before a
  // Supabase project exists. Never enabled outside local review.
  if (isPreviewMode()) {
    const role = normalizeRole(cookieStore.get(PREVIEW_ROLE_COOKIE)?.value);
    return createMockClient(role) as unknown as ReturnType<typeof createServerClient<Database>>;
  }

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render — middleware already
          // refreshes the session, so this can be safely ignored.
        }
      },
    },
  });
}
