import type { ProjectStatus } from "@/types/database.types";

// One source of truth for how a project's status looks, because it had already
// drifted: the dashboard row said "on hold" while the projects list printed the
// raw enum, `on_hold`. Pure data with no server imports, so client components
// can read it too.

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "active",
  on_hold: "on hold",
  completed: "completed",
  archived: "archived",
};

export const PROJECT_STATUS_VARIANT = {
  active: "success",
  on_hold: "warning",
  completed: "info",
  archived: "default",
} as const satisfies Record<ProjectStatus, string>;
