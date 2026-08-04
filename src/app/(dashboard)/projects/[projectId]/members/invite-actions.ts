"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { generateInviteToken, hashInviteToken, inviteUrl } from "@/lib/invites/token";
import { projectRoleSchema } from "@/lib/validations/team";

export type InviteLinkState = {
  error: string | null;
  /** The link, returned exactly once — it cannot be recovered afterwards. */
  url?: string;
};

const MAX_DAYS = 30;

/**
 * Mints a shareable link for one project at one role.
 *
 * The URL is returned here and nowhere else: the database only holds a hash,
 * so if the admin closes the dialog without copying it, the link is gone and
 * they mint another. That is a deliberate trade — a link that can be re-read
 * later is a link sitting in a table waiting to be read by someone else.
 */
export async function createInviteLink(
  projectId: string,
  _prevState: InviteLinkState,
  formData: FormData
): Promise<InviteLinkState> {
  const admin = await requireAdmin();

  const parsedRole = projectRoleSchema.safeParse(formData.get("project_role"));
  if (!parsedRole.success) return { error: "Pick a role for this link" };

  const days = Number(formData.get("expires_days") ?? 7);
  if (!Number.isFinite(days) || days < 1 || days > MAX_DAYS) {
    return { error: `Expiry must be between 1 and ${MAX_DAYS} days` };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const multiUse = formData.get("multi_use") === "true";

  const supabase = await createClient();

  // Confirm the project is in the admin's org before minting anything for it.
  const { data: project } = await supabase
    .from("projects")
    .select("id, org_id")
    .eq("id", projectId)
    .single();

  if (!project || project.org_id !== admin.org_id) {
    return { error: "That project doesn't exist." };
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("project_invites").insert({
    org_id: admin.org_id,
    project_id: projectId,
    project_role: parsedRole.data,
    token_hash: hashInviteToken(token),
    email: email || null,
    expires_at: expiresAt.toISOString(),
    // A link for one named person should be spent once. An open one still
    // expires, and is still capped, so it can't circulate indefinitely.
    max_uses: multiUse ? 25 : 1,
    created_by: admin.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/members`);
  return { error: null, url: inviteUrl(token) };
}

/** Kills a link immediately, whether or not it has been used. */
export async function revokeInviteLink(inviteId: string, projectId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("project_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}/members`);
}
