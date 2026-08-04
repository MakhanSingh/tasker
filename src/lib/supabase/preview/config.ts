import type { PreviewRole } from "./mockClient";

export const PREVIEW_ROLE_COOKIE = "tasker_preview_role";

export function isPreviewMode() {
  return process.env.PREVIEW_MODE === "true";
}

export function normalizeRole(value: string | undefined): PreviewRole {
  return value === "member" || value === "client" ? value : "admin";
}
