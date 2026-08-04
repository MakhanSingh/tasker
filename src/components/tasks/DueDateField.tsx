"use client";

import { useState, useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { updateTaskField } from "@/app/(dashboard)/projects/[projectId]/tasks/actions";
import { formatDueDate } from "@/lib/todo/buckets";
import { SidebarRow } from "./SidebarRow";

export function DueDateField({
  projectId,
  taskId,
  dueDate,
  editable,
}: {
  projectId: string;
  taskId: string;
  dueDate: string | null;
  editable: boolean;
}) {
  const [value, setValue] = useState(dueDate ?? "");
  const [isPending, startTransition] = useTransition();

  if (!editable) {
    return (
      <SidebarRow label="Due date">
        <CalendarDays className="h-4 w-4 shrink-0 text-ink-faint" />
        <span className="text-[14px] text-ink">{dueDate ? formatDueDate(dueDate) : "No due date"}</span>
      </SidebarRow>
    );
  }

  return (
    <SidebarRow label="Due date">
      <CalendarDays className="h-4 w-4 shrink-0 text-ink-faint" />
      <input
        type="date"
        value={value}
        disabled={isPending}
        // Anywhere on the field opens the calendar — not just the tiny
        // browser-native icon at its right edge.
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // Some browsers require extra gestures; the native icon still works.
          }
        }}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          startTransition(() => {
            updateTaskField(projectId, taskId, "due_date", next).catch((err) => {
              window.alert(err instanceof Error ? err.message : "Failed to update due date");
              setValue(dueDate ?? "");
            });
          });
        }}
        className="h-8 flex-1 rounded-[5px] border border-transparent bg-transparent px-1.5 text-[14px] text-ink hover:border-border hover:bg-hover-soft focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus"
      />
    </SidebarRow>
  );
}
