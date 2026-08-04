"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTaskField } from "@/app/(dashboard)/projects/[projectId]/tasks/actions";
import { TASK_PRIORITY_FLAG_COLOR, TASK_PRIORITY_LABEL } from "@/lib/tasks/labels";
import { cn } from "@/lib/utils/cn";
import { SidebarRow } from "./SidebarRow";
import type { TaskPriority } from "@/types/database.types";

const PRIORITIES = Object.keys(TASK_PRIORITY_LABEL) as TaskPriority[];

export function PriorityField({
  projectId,
  taskId,
  priority,
  editable,
}: {
  projectId: string;
  taskId: string;
  priority: TaskPriority;
  editable: boolean;
}) {
  const [value, setValue] = useState<TaskPriority>(priority);
  const [isPending, startTransition] = useTransition();

  const flag = <Flag className={cn("h-4 w-4 shrink-0 fill-current", TASK_PRIORITY_FLAG_COLOR[value])} />;

  if (!editable) {
    return (
      <SidebarRow label="Priority">
        {flag}
        <span className="text-[14px] text-ink">{TASK_PRIORITY_LABEL[priority]}</span>
      </SidebarRow>
    );
  }

  return (
    <SidebarRow label="Priority">
      {flag}
      <Select
        value={value}
        disabled={isPending}
        onValueChange={(next) => {
          const parsed = next as TaskPriority;
          setValue(parsed);
          startTransition(() => {
            updateTaskField(projectId, taskId, "priority", parsed).catch((err) => {
              window.alert(err instanceof Error ? err.message : "Failed to update priority");
              setValue(priority);
            });
          });
        }}
      >
        <SelectTrigger className="h-8 flex-1 border-transparent px-1.5 text-[14px] hover:border-border hover:bg-hover-soft">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {TASK_PRIORITY_LABEL[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SidebarRow>
  );
}
