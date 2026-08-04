"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { projectMemberSchema } from "@/lib/validations/team";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type FormState = {
  error: string | null;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

export async function addProjectMember(projectId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = projectMemberSchema.safeParse({ ...Object.fromEntries(formData), project_id: projectId });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_members").insert(parsed.data);
  if (error) {
    return { error: error.code === "23505" ? "That person is already on this project." : error.message };
  }

  revalidatePath(`/projects/${projectId}/members`);
  return { error: null };
}

export async function updateProjectMemberRole(projectId: string, memberRowId: string, projectRole: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .update({ project_role: projectRole as "manager" | "editor" | "viewer" | "client" })
    .eq("id", memberRowId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}/members`);
}

export async function removeProjectMember(projectId: string, memberRowId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").delete().eq("id", memberRowId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}/members`);
}
