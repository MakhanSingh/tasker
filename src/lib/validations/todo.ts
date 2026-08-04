import { z } from "zod";

export const personalTodoSchema = z.object({
  title: z.string().trim().min(1, "What needs doing?"),
  due_date: z.union([z.literal(""), z.iso.date()]).optional(),
});

