"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { formatMinutes } from "@/lib/utils/time";
import { deleteTimeEntry } from "@/app/(dashboard)/projects/[projectId]/time-actions";

// Fixed locale + explicit fields so server render and client hydration agree.
function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// One work-diary line in the task sidebar: the day, the hours, and — once
// invoiced — nothing to delete. The note and author sit underneath only when
// they add something the day and hours don't already say.
export function TaskTimeEntryRow({
  entry,
  authorName,
  showAuthor,
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
  showAuthor: boolean;
  canDelete: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isBilled = entry.invoice_line_item_id !== null;
  const subtitle = [entry.description, showAuthor ? authorName : null].filter(Boolean).join(" · ");

  return (
    <div className="group flex items-start justify-between gap-2 py-1.5">
      <div className="flex min-w-0 flex-col">
        <span className="text-[13px] text-ink">{formatDay(entry.started_at)}</span>
        {subtitle && <span className="truncate text-[11px] text-ink-faint">{subtitle}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-[13px] font-medium text-ink tabular-nums">
          {entry.duration_minutes != null ? formatMinutes(entry.duration_minutes) : "—"}
        </span>
        {canDelete && !isBilled && (
          <button
            type="button"
            aria-label="Delete entry"
            disabled={isPending}
            className="rounded p-0.5 text-ink-faint opacity-0 hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
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
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
