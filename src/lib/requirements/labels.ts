import type { RequirementPriority, RequirementStatus } from "@/types/database.types";

export const PRIORITY_LABEL: Record<RequirementPriority, string> = {
  must_have: "Must have",
  should_have: "Should have",
  nice_to_have: "Nice to have",
};

export const PRIORITY_VARIANT: Record<RequirementPriority, "danger" | "warning" | "default"> = {
  must_have: "danger",
  should_have: "warning",
  nice_to_have: "default",
};

export const STATUS_LABEL: Record<RequirementStatus, string> = {
  proposed: "Awaiting sign-off",
  approved: "Approved",
  rejected: "Rejected",
  delivered: "Delivered",
};

export const STATUS_VARIANT: Record<RequirementStatus, "default" | "success" | "danger" | "info"> = {
  proposed: "default",
  approved: "success",
  rejected: "danger",
  delivered: "info",
};
