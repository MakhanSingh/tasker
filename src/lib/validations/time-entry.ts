import { z } from "zod";

// Logged from inside a task card. Every entry carries the date it was worked
// on, so a task spread over several days is recorded as one entry per day
// rather than a single lump against today.
export const taskTimeEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  hours: z.coerce
    .number()
    .positive("Enter hours worked")
    .max(24, "More than a day — add it under separate dates"),
  description: z.string().trim().optional(),
});

// Logged from the project's timesheet rather than a task card, so the task is
// chosen here — and may be left blank for general project work, which
// time_entries.task_id already allows.
export const projectTimeEntrySchema = taskTimeEntrySchema.extend({
  task_id: z.union([z.literal(""), z.uuid()]).optional(),
});

