"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { taskCommentSchema } from "@/lib/validations/task";

// commentId comes back so the client can attach dropped screenshots to the
// row it just created.
export type FormState = { error: string | null; commentId?: string };

const CAN_MANAGE = ["admin", "manager", "editor"];

function revalidateTask(projectId: string, taskId: string) {
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
}

export async function addComment(
  projectId: string,
  taskId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const role = await getProjectRole(projectId);
  if (!role) return { error: "No access to this project." };

  const parsed = taskCommentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  // A reply must stay under the same task, and a client must never reply
  // under an internal thread they cannot see.
  const parentId = parsed.data.parent_id || null;
  if (parentId) {
    const { data: parent } = await supabase
      .from("task_comments")
      .select("task_id, is_internal")
      .eq("id", parentId)
      .single();
    if (!parent || parent.task_id !== taskId) return { error: "Reply target not found." };
    if (role === "client" && parent.is_internal) return { error: "Reply target not found." };
  }

  const { data: comment, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      author_id: profile.id,
      body: parsed.data.body,
      parent_id: parentId,
      // Clients can only ever post client-visible comments — enforced here
      // and mirrored by the task_comments RLS insert policy.
      is_internal: role === "client" ? false : parsed.data.is_internal,
    })
    .select("id")
    .single();

  if (error || !comment) return { error: error?.message ?? "Failed to post comment" };

  revalidateTask(projectId, taskId);
  return { error: null, commentId: comment.id };
}

// RLS already restricts comment updates/deletes to the author (or admin);
// failing loudly here just gives a clearer message than a zero-row update.
export async function updateComment(projectId: string, taskId: string, commentId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment can't be empty");

  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").update({ body: trimmed }).eq("id", commentId);
  if (error) throw new Error(error.message);

  revalidateTask(projectId, taskId);
}

export async function deleteComment(projectId: string, taskId: string, commentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);

  revalidateTask(projectId, taskId);
}

export async function toggleReaction(projectId: string, taskId: string, commentId: string, emoji: string) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("comment_reactions")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", profile.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("comment_reactions").delete().eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("comment_reactions").insert({
      comment_id: commentId,
      user_id: profile.id,
      emoji,
    });
    if (error) throw new Error(error.message);
  }

  revalidateTask(projectId, taskId);
}

// ---------------------------------------------------------------------------
// Sub-tasks — the checklist inside a task card.
// ---------------------------------------------------------------------------

export async function addSubtask(projectId: string, taskId: string, title: string) {
  const role = await getProjectRole(projectId);
  if (!role || !CAN_MANAGE.includes(role)) throw new Error("You don't have permission to add sub-tasks.");

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Sub-task needs a title");

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("task_subtasks")
    .select("position")
    .eq("task_id", taskId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("task_subtasks").insert({
    task_id: taskId,
    title: trimmed,
    position: (last?.position ?? -1) + 1,
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);

  revalidateTask(projectId, taskId);
}

export async function toggleSubtask(projectId: string, taskId: string, subtaskId: string, isDone: boolean) {
  // Managers/editors may toggle anything; a task assignee may toggle their
  // own checklist even as a viewer — same rule as task status.
  const role = await getProjectRole(projectId);
  if (!role || role === "client") throw new Error("No access.");
  if (!CAN_MANAGE.includes(role)) {
    const profile = await requireProfile();
    const supabase = await createClient();
    const { data: assignment } = await supabase
      .from("task_assignees")
      .select("id")
      .eq("task_id", taskId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!assignment) {
      throw new Error("Only an assignee, manager, or editor can tick sub-tasks.");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("task_subtasks").update({ is_done: isDone }).eq("id", subtaskId);
  if (error) throw new Error(error.message);

  revalidateTask(projectId, taskId);
}

export async function deleteSubtask(projectId: string, taskId: string, subtaskId: string) {
  const role = await getProjectRole(projectId);
  if (!role || !CAN_MANAGE.includes(role)) throw new Error("You don't have permission to delete sub-tasks.");

  const supabase = await createClient();
  const { error } = await supabase.from("task_subtasks").delete().eq("id", subtaskId);
  if (error) throw new Error(error.message);

  revalidateTask(projectId, taskId);
}

// Moving a task rewrites the denormalised project_id on its time entries and
// files too — and both of those need is_admin() under RLS, so the whole
// operation is admin-only rather than pretending managers can do a move
// that would half-fail.
export async function moveTaskToProject(projectId: string, taskId: string, targetProjectId: string) {
  const profile = await requireProfile();
  if (profile.role !== "admin") throw new Error("Only an admin can move a task to another project.");
  if (targetProjectId === projectId) return;

  const supabase = await createClient();

  // Invoiced time is locked to its project — the invoice references it.
  const { count: invoicedCount } = await supabase
    .from("time_entries")
    .select("*", { count: "exact", head: true })
    .eq("task_id", taskId)
    .not("invoice_line_item_id", "is", null);
  if ((invoicedCount ?? 0) > 0) {
    throw new Error("This task has invoiced time and can't leave its project.");
  }

  // Keep only the assignees who are on the target project's team.
  const [{ data: assignments }, { data: targetTeam }] = await Promise.all([
    supabase.from("task_assignees").select("user_id").eq("task_id", taskId),
    supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", targetProjectId)
      .neq("project_role", "client"),
  ]);
  const targetIds = new Set((targetTeam ?? []).map((m) => m.user_id));
  const dropIds = (assignments ?? []).map((a) => a.user_id).filter((id) => !targetIds.has(id));
  if (dropIds.length > 0) {
    const { error: dropError } = await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId)
      .in("user_id", dropIds);
    if (dropError) throw new Error(dropError.message);
  }

  const { error: taskError } = await supabase
    .from("tasks")
    .update({ project_id: targetProjectId })
    .eq("id", taskId);
  if (taskError) throw new Error(taskError.message);

  const [{ error: timeError }, { error: fileError }] = await Promise.all([
    supabase.from("time_entries").update({ project_id: targetProjectId }).eq("task_id", taskId),
    supabase.from("files").update({ project_id: targetProjectId }).eq("task_id", taskId),
  ]);
  if (timeError) throw new Error(timeError.message);
  if (fileError) throw new Error(fileError.message);

  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${targetProjectId}/tasks`);
}
