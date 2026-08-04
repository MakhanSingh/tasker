"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTaskStatus } from "@/app/(dashboard)/projects/[projectId]/tasks/actions";
import { TASK_STATUS_LABEL } from "@/lib/tasks/labels";
import { cn } from "@/lib/utils/cn";
import type { TaskStatus } from "@/types/database.types";

export function TaskStatusSelect({
  projectId,
  taskId,
  status,
  className,
}: {
  projectId: string;
  taskId: string;
  status: TaskStatus;
  /** Board cards want a small fixed-width trigger; the detail sidebar wants a full-width borderless one. */
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    startTransition(async () => {
      try {
        await updateTaskStatus(projectId, taskId, value);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Failed to update status");
      }
    });
  };

  return (
    <Select value={status} onValueChange={handleChange}>
      <SelectTrigger className={cn("h-7 w-32 text-xs", className)} disabled={isPending}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
