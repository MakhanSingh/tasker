import type { TaskPriority, TaskStatus } from "@/types/database.types";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

// Matches the badge palette used elsewhere for these same priorities.
export const TASK_PRIORITY_FLAG_COLOR: Record<TaskPriority, string> = {
  low: "text-ink-faint",
  medium: "text-info",
  high: "text-warning",
  urgent: "text-danger",
};
