"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { requirementSchema, requirementStatusSchema } from "@/lib/validations/requirement";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type FormState = {
  error: string | null; success?: boolean;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

const CAN_EDIT = ["admin", "manager", "editor"];

function revalidateRequirements(projectId: string) {
  revalidatePath(`/projects/${projectId}/requirements`);
}

export async function createRequirement(
  projectId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const role = await getProjectRole(projectId);
  if (!role || !CAN_EDIT.includes(role)) {
    return { error: "You don't have permission to add requirements to this project." };
  }

  const parsed = requirementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  // Append to the end of the list.
  const { data: last } = await supabase
    .from("project_requirements")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("project_requirements").insert({
    project_id: projectId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    priority: parsed.data.priority,
    is_client_visible: parsed.data.is_client_visible,
    position: (last?.position ?? -1) + 1,
    created_by: profile.id,
  });

  if (error) return { error: error.message };

  revalidateRequirements(projectId);
  return { error: null, success: true };
}

export async function updateRequirement(
  projectId: string,
  requirementId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const role = await getProjectRole(projectId);
  if (!role || !CAN_EDIT.includes(role)) {
    return { error: "You don't have permission to edit requirements on this project." };
  }

  const parsed = requirementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_requirements")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      is_client_visible: parsed.data.is_client_visible,
    })
    .eq("id", requirementId);

  if (error) return { error: error.message };

  revalidateRequirements(projectId);
  return { error: null, success: true };
}

// The only write a client is allowed to make. RLS lets a client update a
// client-visible requirement row at all; this is what keeps that permission
// narrowed to the sign-off decision instead of the whole row.
export async function setRequirementStatus(projectId: string, requirementId: string, status: string) {
  const role = await getProjectRole(projectId);
  if (!role) throw new Error("You don't have access to this project.");

  const parsedStatus = requirementStatusSchema.safeParse(status);
  if (!parsedStatus.success) throw new Error("Unknown requirement status.");

  const isClient = role === "client";
  if (isClient && parsedStatus.data !== "approved" && parsedStatus.data !== "rejected") {
    throw new Error("Clients can only approve or reject a requirement.");
  }
  if (!isClient && !CAN_EDIT.includes(role)) {
    throw new Error("You don't have permission to change this requirement.");
  }

  const profile = await requireProfile();
  const isDecision = parsedStatus.data === "approved" || parsedStatus.data === "rejected";

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_requirements")
    .update({
      status: parsedStatus.data,
      decided_by: isDecision ? profile.id : null,
      decided_at: isDecision ? new Date().toISOString() : null,
    })
    .eq("id", requirementId);

  if (error) throw new Error(error.message);

  revalidateRequirements(projectId);
}

export async function deleteRequirement(projectId: string, requirementId: string) {
  const role = await getProjectRole(projectId);
  if (role !== "admin" && role !== "manager") {
    throw new Error("Only an admin or project manager can delete a requirement.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_requirements").delete().eq("id", requirementId);
  if (error) throw new Error(error.message);

  revalidateRequirements(projectId);
}
