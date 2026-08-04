"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { getFileStorage } from "@/lib/storage";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type LinkFormState = {
  error: string | null; success?: boolean;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

const CAN_ADD = ["admin", "manager", "editor"];
// A client may add a link to a task, but it is always visible to them —
// an internal link from the client would be one they couldn't see. Mirrors
// how their file attachments work (migration 0015).
const CAN_ADD_TASK_LINK = [...CAN_ADD, "client"];

const linkSchema = z.object({
  title: z.string().trim().min(1, "Give the link a name"),
  url: z.url("Enter a full URL, e.g. https://figma.com/…"),
  is_client_visible: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export async function deleteFile(fileId: string, projectId: string) {
  const supabase = await createClient();

  // RLS restricts deletes to the uploader or an admin, so a row only comes
  // back here if this user is actually allowed to remove it.
  const { data: file } = await supabase.from("files").select("storage_path").eq("id", fileId).single();
  if (!file) throw new Error("File not found");

  const { error } = await supabase.from("files").delete().eq("id", fileId);
  if (error) throw new Error(error.message);

  await getFileStorage().deleteFile(file.storage_path);

  revalidatePath(`/projects/${projectId}/files`);
}

/**
 * Adds a link to a task. Links are attached from inside a task now — the
 * project's Files & Links tab is a read-only view of everything gathered
 * across its tasks, with nothing to add from there.
 */
/**
 * A link that belongs to the project rather than to any one task — the Drive
 * folder, the staging URL, the Figma board. `task_id` is left null, which is
 * why that column was made nullable in migration 0017.
 *
 * It lives on the project's Overview, not on Files & Links: that tab is a
 * read-only roll-up of what was attached inside tasks, and putting an "add"
 * control back on it is exactly what was taken off.
 */
export async function addProjectLink(
  projectId: string,
  _prevState: LinkFormState,
  formData: FormData
): Promise<LinkFormState> {
  return insertLink(projectId, null, formData);
}

export async function addTaskLink(
  projectId: string,
  taskId: string,
  _prevState: LinkFormState,
  formData: FormData
): Promise<LinkFormState> {
  return insertLink(projectId, taskId, formData);
}

async function insertLink(
  projectId: string,
  taskId: string | null,
  formData: FormData
): Promise<LinkFormState> {
  const role = await getProjectRole(projectId);
  if (!role || !CAN_ADD_TASK_LINK.includes(role)) {
    return { error: "You don't have permission to add links to this project." };
  }

  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  // Only web links — a javascript: or data: URL here would become a stored
  // XSS the moment someone clicks it.
  const url = new URL(parsed.data.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: "Only http(s) links are allowed." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("project_links").insert({
    org_id: profile.org_id,
    project_id: projectId,
    task_id: taskId,
    title: parsed.data.title,
    url: parsed.data.url,
    // A client's link is always client-visible; the checkbox isn't shown to
    // them and the RLS policy enforces the same rule.
    is_client_visible: role === "client" ? true : parsed.data.is_client_visible,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/files`);
  revalidatePath(`/projects/${projectId}/overview`);
  if (taskId) revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  return { error: null, success: true };
}

export async function deleteProjectLink(linkId: string, projectId: string) {
  const supabase = await createClient();
  // RLS restricts deletes to the creator or an admin.
  const { data: link } = await supabase.from("project_links").select("task_id").eq("id", linkId).maybeSingle();

  const { error } = await supabase.from("project_links").delete().eq("id", linkId);
  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}/files`);
  revalidatePath(`/projects/${projectId}/overview`);
  if (link?.task_id) revalidatePath(`/projects/${projectId}/tasks/${link.task_id}`);
}
