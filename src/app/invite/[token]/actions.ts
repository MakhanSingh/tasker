"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/invites/token";
import { acceptInviteSchema } from "@/lib/validations/invite";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type AcceptState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  projectId?: string;
};

/**
 * Joining with an already-signed-in account.
 *
 * All the checking lives in redeem_project_invite() — expiry, revocation, uses
 * left, whether the link was addressed to someone else, and whether a client
 * account is being handed an internal role. Doing it in the database means it
 * runs under a row lock, so two people opening the same single-use link at the
 * same moment cannot both get in.
 */
export async function acceptInvite(token: string): Promise<AcceptState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_project_invite", {
    p_token_hash: hashInviteToken(token),
  });

  if (error) return { error: error.message };
  return { error: null, projectId: data as string };
}

/**
 * Joining with no account yet.
 *
 * Access is invite-only — `enable_signup = false` — so the account has to be
 * created with the service role rather than by public signup. The invite is
 * verified first, so a valid token is the only thing that can mint an account,
 * and the password is chosen by the person joining and never travels anywhere
 * but Supabase's auth API.
 */
export async function acceptInviteAsNewUser(
  token: string,
  _prevState: AcceptState,
  formData: FormData
): Promise<AcceptState> {
  const parsed = acceptInviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return { error: "The two passwords don't match", fieldErrors: { confirm: "The two passwords don't match" } };
  }

  const tokenHash = hashInviteToken(token);
  const admin = createAdminClient();

  // Read the invite before creating anything, so a bad token can't be used to
  // create an account at all.
  const { data: peeked, error: peekError } = await admin.rpc("peek_project_invite", {
    p_token_hash: tokenHash,
  });
  const invite = Array.isArray(peeked) ? peeked[0] : null;
  if (peekError || !invite) {
    return { error: "This invite link is no longer valid." };
  }

  const email = invite.email ?? parsed.data.email.trim().toLowerCase();
  if (invite.email && invite.email.toLowerCase() !== parsed.data.email.trim().toLowerCase()) {
    return {
      error: "This invite was issued to a different email address.",
      fieldErrors: { email: "This invite was issued to a different email address" },
    };
  }

  const { data: inviteRow } = await admin
    .from("project_invites")
    .select("project_id")
    .eq("token_hash", tokenHash)
    .single();

  const { data: project } = inviteRow
    ? await admin.from("projects").select("org_id, client_id").eq("id", inviteRow.project_id).single()
    : { data: null };

  if (!project) return { error: "That project no longer exists." };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "Couldn't create the account." };
  }

  const isClientInvite = invite.project_role === "client";
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    org_id: project.org_id,
    role: isClientInvite ? "client" : "member",
    full_name: parsed.data.full_name,
    email,
    client_id: isClientInvite ? project.client_id : null,
  });

  if (profileError) {
    // Don't leave a login with no profile behind it.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  // Sign them in with the password they just chose, then redeem as themselves
  // so the membership is created under their own identity rather than the
  // service role's.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (signInError) return { error: "Account created — please sign in and open the link again." };

  const { data: projectId, error: redeemError } = await supabase.rpc("redeem_project_invite", {
    p_token_hash: tokenHash,
  });
  if (redeemError) return { error: redeemError.message };

  return { error: null, projectId: projectId as string };
}
