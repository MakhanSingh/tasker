"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { projectTimeEntrySchema, taskTimeEntrySchema } from "@/lib/validations/time-entry";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type FormState = {
  error: string | null;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

// Time is logged from inside a task card, so these live at the project
// segment root rather than under the (now read-only) time tab.
function revalidateTimeViews(projectId: string, taskId?: string | null) {
  revalidatePath(`/projects/${projectId}/tasks`);
  if (taskId) revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  revalidatePath(`/projects/${projectId}/time`);
  revalidatePath("/time");
}

async function assertCanLogTime(projectId: string) {
  const role = await getProjectRole(projectId);
  if (!role || role === "client") {
    throw new Error("You don't have access to log time on this project.");
  }
}

export async function startTimer(projectId: string, taskId: string | null) {
  await assertCanLogTime(projectId);

  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("time_entries").insert({
    project_id: projectId,
    task_id: taskId,
    user_id: profile.id,
    started_at: new Date().toISOString(),
  });

  if (error) {
    // The partial unique index on (user_id) where ended_at is null is what
    // enforces one running timer per user — surface that as plain English
    // rather than auto-stopping the other timer behind the user's back.
    if (error.code === "23505") {
      throw new Error("You already have a timer running — stop it before starting another.");
    }
    throw new Error(error.message);
  }

  revalidateTimeViews(projectId, taskId);
}

export async function stopTimer(entryId: string, projectId: string) {
  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("time_entries")
    .select("started_at, task_id")
    .eq("id", entryId)
    .single();
  if (!entry) throw new Error("Time entry not found");

  const startedAt = new Date(entry.started_at);
  const durationMinutes = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000));

  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString(), duration_minutes: durationMinutes })
    .eq("id", entryId);

  if (error) throw new Error(error.message);

  revalidateTimeViews(projectId, entry.task_id);
}

// Shared by both manual-entry forms — the one inside a task card and the one
// on the project timesheet — so the date handling and the future-date guard
// can't drift between them.
async function insertManualEntry(
  projectId: string,
  taskId: string | null,
  input: { date: string; hours: number; description?: string }
): Promise<FormState> {
  const role = await getProjectRole(projectId);
  if (!role || role === "client") {
    return { error: "You don't have access to log time on this project." };
  }

  // A day of slack against UTC, so someone whose local date is already
  // tomorrow can still log today's work.
  const latestAllowed = new Date(Date.now() + 24 * 60 * 60000).toISOString().slice(0, 10);
  if (input.date > latestAllowed) {
    return { error: "You can't log time for a future date." };
  }

  const profile = await requireProfile();
  const durationMinutes = Math.round(input.hours * 60);

  // Anchored at noon UTC rather than a real clock time: a manual entry only
  // claims which day the work happened on, and noon keeps that day the same
  // in every timezone the entry is later read from.
  const startedAt = new Date(`${input.date}T12:00:00.000Z`);
  const endedAt = new Date(startedAt.getTime() + durationMinutes * 60000);

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    project_id: projectId,
    task_id: taskId,
    user_id: profile.id,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_minutes: durationMinutes,
    description: input.description || null,
  });

  if (error) return { error: error.message };

  revalidateTimeViews(projectId, taskId);
  return { error: null };
}

export async function logTimeOnTask(
  projectId: string,
  taskId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = taskTimeEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  return insertManualEntry(projectId, taskId, parsed.data);
}

// The timesheet's own Add time: same entry, but the task is picked in the
// form and may be left blank for general project work.
export async function logProjectTime(
  projectId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = projectTimeEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  return insertManualEntry(projectId, parsed.data.task_id || null, parsed.data);
}

export async function deleteTimeEntry(entryId: string, projectId: string) {
  const supabase = await createClient();
  const { data: entry } = await supabase.from("time_entries").select("task_id").eq("id", entryId).single();

  const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
  if (error) throw new Error(error.message);

  revalidateTimeViews(projectId, entry?.task_id);
}
