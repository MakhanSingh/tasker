"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { milestoneSchema, projectSchema, projectStatusSchema } from "@/lib/validations/project";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type FormState = {
  error: string | null;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

/** Splits the one form into the project row and its (separately secured) billing row. */
function splitProjectInput(data: {
  billing_type: "hourly" | "fixed";
  hourly_rate?: number;
  fixed_budget?: number;
  description?: string;
  start_date?: string;
  end_date?: string;
  client_id?: string;
  name: string;
  status: "active" | "on_hold" | "completed" | "archived";
}) {
  const { billing_type, hourly_rate, fixed_budget, ...project } = data;
  return {
    project: {
      ...project,
      client_id: project.client_id || null,
      description: project.description || null,
      start_date: project.start_date || null,
      end_date: project.end_date || null,
    },
    billing: {
      billing_type,
      hourly_rate: hourly_rate ?? null,
      fixed_budget: fixed_budget ?? null,
    },
  };
}

export async function createProject(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const { project, billing } = splitProjectInput(parsed.data);
  const supabase = await createSupabaseServerClient();
  const { data: created, error } = await supabase
    .from("projects")
    .insert({ ...project, org_id: admin.org_id, created_by: admin.id })
    .select("id")
    .single();

  if (error || !created) {
    return { error: error?.message ?? "Failed to create project" };
  }

  // Every project gets a billing row, even an empty one, so later reads can
  // treat "no row" as "you aren't allowed to see this" rather than having to
  // distinguish that from "nobody filled it in".
  const { error: billingError } = await supabase
    .from("project_billing")
    .insert({ project_id: created.id, ...billing });
  if (billingError) return { error: billingError.message };

  revalidatePath("/projects");
  redirect(`/projects/${created.id}`);
}

export async function updateProject(projectId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const { project, billing } = splitProjectInput(parsed.data);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("projects").update(project).eq("id", projectId);
  if (error) return { error: error.message };

  // upsert, not update: a project created before this table existed has no
  // billing row yet.
  const { error: billingError } = await supabase
    .from("project_billing")
    .upsert({ project_id: projectId, ...billing }, { onConflict: "project_id" });
  if (billingError) return { error: billingError.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/time`);
  return { error: null };
}

// A client starting a project of their own — the same form and the same
// fields an admin fills in.
//
// It goes through a SECURITY DEFINER function rather than a plain insert for
// two reasons: the company is derived from the caller instead of trusted from
// the form, and the function can write the project_billing row without
// project_billing_insert being widened to clients (which would let them edit
// the rate on an existing project, not just set one here).
export async function createClientProject(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: projectId, error } = await supabase.rpc("create_client_project", {
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
    p_status: parsed.data.status,
    p_billing_type: parsed.data.billing_type,
    p_hourly_rate: parsed.data.hourly_rate ?? null,
    p_fixed_budget: parsed.data.fixed_budget ?? null,
    p_start_date: parsed.data.start_date || null,
    p_end_date: parsed.data.end_date || null,
  });

  if (error || !projectId) {
    return { error: error?.message ?? "Failed to create project" };
  }

  revalidatePath("/projects");
  redirect(`/projects/${projectId}/tasks`);
}

// ---------------------------------------------------------------------------
// Milestones — admin-only, matching project_milestones' RLS. requireAdmin()
// here is a courteous error message; the policy is the actual gate.
// ---------------------------------------------------------------------------

export async function createMilestone(
  projectId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = milestoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("project_milestones")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { error } = await supabase.from("project_milestones").insert({
    project_id: projectId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    amount: parsed.data.amount,
    due_date: parsed.data.due_date || null,
    status: parsed.data.status,
    position: count ?? 0,
    created_by: admin.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/time`);
  return { error: null };
}

export async function updateMilestoneStatus(projectId: string, milestoneId: string, status: string) {
  await requireAdmin();
  const parsed = milestoneSchema.shape.status.safeParse(status);
  if (!parsed.success) throw new Error("Invalid milestone status");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("project_milestones")
    .update({ status: parsed.data })
    .eq("id", milestoneId);
  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}/time`);
}

export async function deleteMilestone(projectId: string, milestoneId: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // A milestone already on an invoice is part of a bill that has gone out;
  // deleting it here would leave the invoice claiming work that no longer
  // exists in the project.
  const { data: milestone } = await supabase
    .from("project_milestones")
    .select("invoice_line_item_id")
    .eq("id", milestoneId)
    .maybeSingle();
  if (milestone?.invoice_line_item_id) {
    throw new Error("This milestone is already on an invoice — void that invoice first.");
  }

  const { error } = await supabase.from("project_milestones").delete().eq("id", milestoneId);
  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}/time`);
}

// Closing a project out, without opening the edit form. Marking one complete
// or archived is a routine end-of-engagement action; burying it in a dropdown
// among the dates and the rate is why every finished project was still sitting
// in the sidebar.
export async function setProjectStatus(projectId: string, status: string) {
  const parsed = projectStatusSchema.safeParse(status);
  if (!parsed.success) throw new Error("Invalid project status");

  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("projects").update({ status: parsed.data }).eq("id", projectId);
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

// Only for a project nothing has happened on — a mistyped one created minutes
// ago. Logged hours, invoice lines and files are refused by a database
// trigger, which explains itself, so this can't be routed around.
export async function deleteProject(projectId: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/");
}
