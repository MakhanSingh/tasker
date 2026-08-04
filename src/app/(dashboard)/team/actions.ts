"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { inviteMemberSchema } from "@/lib/validations/team";
import { inviteUser, InviteUserError } from "@/lib/auth/inviteUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type FormState = {
  error: string | null;
  success?: boolean;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

export async function inviteTeamMember(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = inviteMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  try {
    await inviteUser({
      email: parsed.data.email,
      fullName: parsed.data.full_name,
      role: parsed.data.role,
      orgId: admin.org_id,
    });
  } catch (err) {
    if (err instanceof InviteUserError) {
      return { error: err.message };
    }
    throw err;
  }

  revalidatePath("/team");
  return { error: null, success: true };
}

export async function setMemberActive(profileId: string, isActive: boolean) {
  const admin = await requireAdmin();
  if (profileId === admin.id && !isActive) {
    throw new Error("You can't disable your own account.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", profileId);
  if (error) throw new Error(error.message);

  revalidatePath("/team");
}

/**
 * Removes someone completely — the login as well as the profile.
 *
 * Only for an account nobody ever worked as: an invite to a mistyped address,
 * a duplicate. Anyone with hours, comments, assigned tasks or uploads is
 * refused by a database trigger, which says what they have and to disable them
 * instead. Disabling is the usual answer and revokes access just as fast; it
 * simply keeps their hours on the invoices they were billed on.
 *
 * Deleting the auth user is what actually does it — profiles.id references
 * auth.users with on delete cascade, so the profile follows. Doing it the
 * other way round would leave a login with no profile behind it: able to sign
 * in, and landing nowhere.
 */
export async function deleteTeamMember(profileId: string) {
  const admin = await requireAdmin();
  if (profileId === admin.id) {
    throw new Error("You can't delete your own account.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) throw new Error("That person is no longer here.");

  // Delete the profile first so our trigger can refuse in plain English. The
  // Admin API would report the same rejection as an opaque 500.
  const { error: profileError } = await supabase.from("profiles").delete().eq("id", profileId);
  if (profileError) throw new Error(profileError.message);

  const { error: authError } = await createAdminClient().auth.admin.deleteUser(profileId);
  if (authError) throw new Error(authError.message);

  revalidatePath("/team");
}
