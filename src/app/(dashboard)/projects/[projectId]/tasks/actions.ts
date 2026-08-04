"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProjectRole } from "@/lib/auth/getProjectRole";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import {
  assigneeIdsSchema,
  clientTaskSchema,
  taskPrioritySchema,
  taskSchema,
  taskStatusSchema,
} from "@/lib/validations/task";
import { notifyTaskAssigned } from "@/lib/email/notifications";
import { fieldErrorsFrom } from "@/components/ui/field-error";

// taskId comes back from createTask so staged attachments can be uploaded
// against the new task.
export type FormState = {
  error: string | null; success?: boolean; taskId?: string;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

const CAN_MANAGE_TASKS = ["admin", "manager", "editor"];

async function isTaskAssignee(taskId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_assignees")
    .select("id")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function createTask(projectId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const role = await getProjectRole(projectId);
  if (!role || !CAN_MANAGE_TASKS.includes(role)) {
    return { error: "You don't have permission to create tasks on this project." };
  }

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  // Repeated fields vanish under Object.fromEntries, so assignees are read
  // separately.
  const parsedAssignees = assigneeIdsSchema.safeParse(formData.getAll("assignee_ids"));
  if (!parsedAssignees.success) {
    return { error: "Invalid assignee selection" };
  }
  const assigneeIds = [...new Set(parsedAssignees.data)];

  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      due_date: parsed.data.due_date || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !task) return { error: error?.message ?? "Failed to create task" };

  if (assigneeIds.length > 0) {
    const { error: assignError } = await supabase
      .from("task_assignees")
      .insert(assigneeIds.map((userId) => ({ task_id: task.id, user_id: userId })));
    if (assignError) return { error: assignError.message };

    for (const userId of assigneeIds) {
      if (userId !== profile.id) {
        await notifyTaskAssigned({
          taskId: task.id,
          assigneeId: userId,
          taskTitle: parsed.data.title,
          projectId,
        });
      }
    }
  }

  revalidatePath(`/projects/${projectId}/tasks`);
  return { error: null, success: true, taskId: task.id };
}

// A client raising a task on their own project. A separate action rather
// than a branch inside createTask, so what a client may set is stated once
// and plainly: a title, a brief, a priority and a date they need it by.
// Never a status (it starts in To do like any request) and never an
// assignee — a client can't see the team roster, let alone allocate it.
export async function createClientTask(
  projectId: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const role = await getProjectRole(projectId);
  if (role !== "client") {
    return { error: "You don't have permission to add a task this way." };
  }

  const parsed = clientTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: "todo",
      priority: parsed.data.priority,
      due_date: parsed.data.due_date || null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !task) return { error: error?.message ?? "Failed to add task" };

  revalidatePath(`/projects/${projectId}/tasks`);
  return { error: null, success: true, taskId: task.id };
}

// Backs the task detail card's inline fields — each field saves itself on
// blur/change, so one small action per field keeps every save a single,
// obviously-correct column update.
export async function updateTaskField(
  projectId: string,
  taskId: string,
  field: "title" | "description" | "priority" | "due_date",
  value: string
) {
  const role = await getProjectRole(projectId);
  if (!role || !CAN_MANAGE_TASKS.includes(role)) {
    throw new Error("You don't have permission to edit this task.");
  }

  const supabase = await createClient();

  if (field === "title") {
    const title = value.trim();
    if (!title) throw new Error("Title is required");
    const { error } = await supabase.from("tasks").update({ title }).eq("id", taskId);
    if (error) throw new Error(error.message);
  } else if (field === "description") {
    const { error } = await supabase.from("tasks").update({ description: value.trim() || null }).eq("id", taskId);
    if (error) throw new Error(error.message);
  } else if (field === "due_date") {
    const { error } = await supabase.from("tasks").update({ due_date: value || null }).eq("id", taskId);
    if (error) throw new Error(error.message);
  } else {
    const parsed = taskPrioritySchema.safeParse(value);
    if (!parsed.success) throw new Error("Invalid priority");
    const { error } = await supabase.from("tasks").update({ priority: parsed.data }).eq("id", taskId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

// Adds or removes one assignee. The multi-select in the task card toggles
// people one at a time, so the smallest possible mutation is also the whole
// API.
export async function toggleTaskAssignee(projectId: string, taskId: string, userId: string, assigned: boolean) {
  const role = await getProjectRole(projectId);
  if (!role || !CAN_MANAGE_TASKS.includes(role)) {
    throw new Error("You don't have permission to change assignees.");
  }

  const supabase = await createClient();

  if (assigned) {
    const { error } = await supabase.from("task_assignees").insert({ task_id: taskId, user_id: userId });
    // A duplicate assignment (two tabs racing) is already the desired state.
    if (error && error.code !== "23505") throw new Error(error.message);

    const profile = await requireProfile();
    if (userId !== profile.id) {
      const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).single();
      await notifyTaskAssigned({ taskId, assigneeId: userId, taskTitle: task?.title ?? "", projectId });
    }
  } else {
    const { error } = await supabase.from("task_assignees").delete().eq("task_id", taskId).eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

// Anyone with project access can move status IF they are an assignee, on
// top of managers/editors — the "member can change status, not reassign"
// restriction the RLS policy leaves to the app layer.
export async function updateTaskStatus(projectId: string, taskId: string, status: string) {
  const parsedStatus = taskStatusSchema.safeParse(status);
  if (!parsedStatus.success) throw new Error("Invalid status");

  const role = await getProjectRole(projectId);
  if (!role) throw new Error("No access to this project");

  if (!CAN_MANAGE_TASKS.includes(role)) {
    const profile = await requireProfile();
    if (!(await isTaskAssignee(taskId, profile.id))) {
      throw new Error("Only an assignee, manager, or editor can change this task's status.");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status: parsedStatus.data }).eq("id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

// One drop on the board can change both which column a task is in and where
// it sits within that column, so both are written together — a status-only
// action would leave the card visually snapping back to its old slot.
export async function moveTaskOnBoard(
  projectId: string,
  taskId: string,
  status: string,
  orderedIdsInColumn: string[]
) {
  const parsedStatus = taskStatusSchema.safeParse(status);
  if (!parsedStatus.success) throw new Error("Invalid status");

  const role = await getProjectRole(projectId);
  if (!role) throw new Error("No access to this project");

  if (!CAN_MANAGE_TASKS.includes(role)) {
    const profile = await requireProfile();
    if (!(await isTaskAssignee(taskId, profile.id))) {
      throw new Error("Only an assignee, manager, or editor can move this task.");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status: parsedStatus.data }).eq("id", taskId);
  if (error) throw new Error(error.message);

  // Positions are rewritten for the destination column only. A viewer who
  // may move their own task can reorder that column too — the rows they
  // can't update are simply skipped by RLS rather than failing the drop.
  await Promise.all(
    orderedIdsInColumn.map((id, index) =>
      supabase.from("tasks").update({ position: index }).eq("id", id)
    )
  );

  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath(`/projects/${projectId}/tasks/${taskId}`);
}

export async function deleteTask(projectId: string, taskId: string) {
  const role = await getProjectRole(projectId);
  if (role !== "admin" && role !== "manager") {
    throw new Error("Only a manager or admin can delete tasks.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}/tasks`);
}
