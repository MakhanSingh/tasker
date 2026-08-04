import type { InvoiceStatus } from "@/types/database.types";

export type DisplayStatus = InvoiceStatus | "overdue";

// "Overdue" is never stored — it's derived at display time so no scheduled
// job is needed to flip a column, and there's no clock-drift/timezone bug
// window where the stored value disagrees with reality.
export function displayStatus(invoice: { status: InvoiceStatus; due_date: string }): DisplayStatus {
  if (invoice.status === "sent" && new Date(invoice.due_date) < new Date(new Date().toDateString())) {
    return "overdue";
  }
  return invoice.status;
}

export const STATUS_VARIANT: Record<DisplayStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default",
  sent: "info",
  paid: "success",
  void: "default",
  overdue: "danger",
};
