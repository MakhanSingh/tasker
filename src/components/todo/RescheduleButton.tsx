"use client";

import { useTransition } from "react";
import { rescheduleOverdueToToday } from "@/app/(dashboard)/todo/actions";

// Todoist's "Reschedule" on the Overdue header: everything overdue moves to
// today in one click.
export function RescheduleButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await rescheduleOverdueToToday();
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "Something went wrong");
          }
        })
      }
      className="text-[13px] font-medium text-primary hover:underline disabled:opacity-50"
    >
      {isPending ? "Rescheduling…" : "Reschedule"}
    </button>
  );
}
