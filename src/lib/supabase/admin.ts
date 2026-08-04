import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

// Service-role client — bypasses RLS entirely. Only for server-only
// operations that must run outside a user's own session, such as creating
// an invited user's auth.users row via the Admin API. Never import this
// from anything that could run in the browser.
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
