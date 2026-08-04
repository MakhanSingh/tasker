"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMinutes } from "@/lib/utils/time";
import { deleteTimeEntry } from "@/app/(dashboard)/projects/[projectId]/time-actions";

export function TimeEntryRow({
  entry,
  authorName,
  taskTitle,
  canDelete,
}: {
  entry: {
    id: string;
    project_id: string;
    started_at: string;
    duration_minutes: number | null;
    description: string | null;
    invoice_line_item_id: string | null;
  };
  authorName: string;
  taskTitle?: string;
  canDelete: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isBilled = entry.invoice_line_item_id !== null;

  return (
    <div className="flex items-center justify-between border-b border-border-soft px-6 py-3 last:border-0">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-ink">{entry.description || taskTitle || "Time entry"}</p>
        <p className="text-xs text-ink-muted">
          {authorName} · {new Date(entry.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          {taskTitle && entry.description ? ` · ${taskTitle}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {isBilled && <Badge variant="info">invoiced</Badge>}
        <span className="text-sm font-medium text-ink">
          {entry.duration_minutes != null ? formatMinutes(entry.duration_minutes) : "running"}
        </span>
        {canDelete && !isBilled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await deleteTimeEntry(entry.id, entry.project_id);
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed to delete entry");
                }
              })
            }
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
