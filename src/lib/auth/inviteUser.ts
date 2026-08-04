import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/appUrl";
import type { ProfileRole } from "@/types/database.types";

export class InviteUserError extends Error {}

// Creates the auth.users row via Supabase's invite email (the user gets a
// link to set their own password — we never generate or see one), then the
// matching profiles row. Used for both team members and client portal users;
// only the `role` differs.
export async function inviteUser(params: {
  email: string;
  fullName: string;
  role: ProfileRole;
  orgId: string;
  /**
   * Which company a portal user belongs to. Required in practice for
   * role: "client" — a client profile without it belongs to nobody, can't be
   * offered access to their own company's projects, and can't create one.
   */
  clientId?: string;
}) {
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(params.email, {
    redirectTo: `${await getAppUrl()}/login`,
  });

  if (createError || !created.user) {
    throw new InviteUserError(createError?.message ?? "Failed to invite user");
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    org_id: params.orgId,
    role: params.role,
    full_name: params.fullName,
    email: params.email,
    client_id: params.role === "client" ? (params.clientId ?? null) : null,
  });

  if (profileError) {
    // Roll back the auth user so a failed invite doesn't leave an orphaned
    // login with no profile behind it.
    await admin.auth.admin.deleteUser(created.user.id);
    throw new InviteUserError(profileError.message);
  }

  return created.user.id;
}
