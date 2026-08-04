"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/getCurrentProfile";
import { personalTodoSchema } from "@/lib/validations/todo";
import { todayKey } from "@/lib/todo/buckets";
import { fieldErrorsFrom } from "@/components/ui/field-error";

export type FormState = {
  error: string | null;
  success?: boolean;
  /** Per-field messages, keyed by input name, for showing them in place. */
  fieldErrors?: Record<string, string>;
};

function revalidateTodo() {
  revalidatePath("/todo");
  revalidatePath("/", "layout");
}

export async function createPersonalTodo(_prevState: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireProfile();
  if (profile.role === "client") return { error: "Not available for client accounts." };

  const parsed = personalTodoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("personal_todos").insert({
    org_id: profile.org_id,
    user_id: profile.id,
    title: parsed.data.title,
    due_date: parsed.data.due_date || null,
  });

  if (error) return { error: error.message };

  revalidateTodo();
  return { error: null, success: true };
}

export async function togglePersonalTodo(todoId: string, isDone: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("personal_todos")
    .update({ is_done: isDone, completed_at: isDone ? new Date().toISOString() : null })
    .eq("id", todoId);

  if (error) throw new Error(error.message);
  revalidateTodo();
}

export async function deletePersonalTodo(todoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("personal_todos").delete().eq("id", todoId);
  if (error) throw new Error(error.message);
  revalidateTodo();
}

// Todoist's "Reschedule" on the Overdue header: pulls everything overdue
// forward to today. Tasks are limited to the user's own assignments — RLS
// additionally allows an assignee to update their own task rows.
export async function rescheduleOverdueToToday() {
  const profile = await requireProfile();
  if (profile.role === "client") throw new Error("Not available for client accounts.");

  const today = todayKey();
  const supabase = await createClient();

  const [{ error: todoError }, { error: taskError }] = await Promise.all([
    supabase
      .from("personal_todos")
      .update({ due_date: today })
      .eq("user_id", profile.id)
      .eq("is_done", false)
      .lt("due_date", today),
    (async () => {
      const { data: mine } = await supabase
        .from("task_assignees")
        .select("task_id")
        .eq("user_id", profile.id);
      const ids = (mine ?? []).map((row) => row.task_id);
      if (ids.length === 0) return { error: null };
      return supabase
        .from("tasks")
        .update({ due_date: today })
        .in("id", ids)
        .neq("status", "done")
        .lt("due_date", today);
    })(),
  ]);

  const error = todoError ?? taskError;
  if (error) throw new Error(error.message);

  revalidateTodo();
}

// Completing a project task from the todo list. RLS already limits this to
// tasks the user may update, and the assignee-self-update policy is what
// lets a viewer tick off their own task.
export async function completeTask(taskId: string, done: boolean) {
  const supabase = await createClient();
  const { data: task, error: readError } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single();
  if (readError || !task) throw new Error("Task not found");

  const { error } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "todo" })
    .eq("id", taskId);

  if (error) throw new Error(error.message);

  revalidateTodo();
  revalidatePath(`/projects/${task.project_id}/tasks`);
}
