import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  // Lets the list view's per-section "Add task" drop the new task straight
  // into that section.
  status: z.enum(["todo", "in_progress", "in_review", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  due_date: z.string().trim().optional(),
});

// Multiple assignees arrive as repeated assignee_ids form fields; read with
// formData.getAll, validated here.
export const assigneeIdsSchema = z.array(z.uuid()).max(20);

// What a client may set when raising a task. Status is absent on purpose —
// a request starts in To do — and so are assignees, which a client can't see.
export const clientTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  due_date: z.string().trim().optional(),
});

export const taskStatusSchema = z.enum(["todo", "in_progress", "in_review", "done"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const taskCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment can't be empty"),
  // An unchecked checkbox submits nothing at all, so absence means "not
  // internal". z.coerce.boolean() can't express this — it maps any
  // non-empty string, including "false", to true.
  is_internal: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Present when the comment is a reply.
  parent_id: z.union([z.literal(""), z.uuid()]).optional(),
});
