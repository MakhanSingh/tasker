export type DueBucket = "overdue" | "today" | "tomorrow" | "this_week" | "later" | "someday";


export const BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "Later this week",
  later: "Later",
  someday: "No due date",
};

// Local calendar date as YYYY-MM-DD. Deliberately not toISOString(), which
// converts to UTC first and so reports the wrong day for part of every day
// in any non-UTC timezone.
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

// Buckets are derived from the due date on every read, so an item left
// unfinished simply lands in "overdue" the next day. Nothing has to run
// overnight to move it, and nothing can miss a day and leave stale state.
export function bucketFor(dueDate: string | null, today = todayKey()): DueBucket {
  if (!dueDate) return "someday";

  const due = dueDate.slice(0, 10);
  if (due < today) return "overdue";
  if (due === today) return "today";

  const tomorrow = new Date(`${today}T00:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due === toDateKey(tomorrow)) return "tomorrow";

  const weekEnd = new Date(`${today}T00:00:00`);
  weekEnd.setDate(weekEnd.getDate() + 7);
  if (due <= toDateKey(weekEnd)) return "this_week";

  return "later";
}


// Todoist-style short date: "1 Mar", with the year only when it differs
// from the current one ("1 Mar 2022").
export function formatDueDate(dueDate: string): string {
  const date = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return date.toLocaleDateString("en-GB", options);
}

// What the sidebar badge counts: everything that needs attention right now.
export function needsAttention(dueDate: string | null, today = todayKey()): boolean {
  const bucket = bucketFor(dueDate, today);
  return bucket === "overdue" || bucket === "today";
}
