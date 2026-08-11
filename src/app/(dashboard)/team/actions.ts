"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { inviteMemberSchema, updateMemberSchema } from "@/lib/validations/team";
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

/**
 * Edits someone's name, email address and account type.
 *
 * The email is the awkward one, because there are two of them: `profiles.email`
 * is what the app renders, and `auth.users.email` is what you actually sign in
 * with. Writing only the first is the bug worth avoiding — the Team page would
 * show the corrected address while the account still answered to the old one,
 * so an admin fixing a typo would believe they had fixed it and the person
 * still couldn't log in. Both move together here, auth first because it is the
 * one that can be refused (the address may belong to another account), and the
 * profile write rolls it back if it fails.
 */
export async function updateTeamMember(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = updateMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const { profile_id: profileId, full_name: fullName, role } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const supabase = await createSupabaseServerClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) return { error: "That person is no longer here." };

  // Demoting yourself would take the Team page away mid-edit, and with it the
  // ability to undo it. Someone else has to do it to you.
  if (profileId === admin.id && role !== target.role) {
    return { error: "You can't change your own account type." };
  }

  const emailChanged = email !== target.email.toLowerCase();

  if (emailChanged) {
    const { error: authError } = await createAdminClient().auth.admin.updateUserById(profileId, {
      email,
      // The admin is asserting the address, so skip the confirmation round
      // trip — otherwise the account sits on the old email until someone
      // clicks a link sent to the address we are trying to correct.
      email_confirm: true,
    });

    if (authError) {
      return {
        error: authError.message,
        fieldErrors: { email: "That address is already used by another account." },
      };
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, email, role })
    .eq("id", profileId);

  if (profileError) {
    if (emailChanged) {
      await createAdminClient().auth.admin.updateUserById(profileId, {
        email: target.email,
        email_confirm: true,
      });
    }
    return { error: profileError.message };
  }

  revalidatePath("/team");
  return { error: null, success: true };
}

/**
 * Emails someone a link to set their own password.
 *
 * Deliberately not "type a new password for them": that hands the admin a
 * password the account holder never chose and the admin now knows. This is the
 * same mailer, token and callback the forgot-password page uses — the only
 * difference is who pressed the button. It works equally for someone who never
 * set a password at all, which is the usual reason to reach for it.
 */
export async function sendPasswordResetLink(profileId: string) {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", profileId)
    .maybeSingle();

  if (!target) throw new Error("That person is no longer here.");

  const { error } = await supabase.auth.resetPasswordForEmail(target.email, {
    redirectTo: `${await getAppUrl()}/auth/callback?next=/reset-password`,
  });

  if (error) throw new Error("Couldn't send the email just now. Try again in a minute.");
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
