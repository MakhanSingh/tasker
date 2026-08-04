import Link from "next/link";
import { Columns3, LayoutList, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type TaskView = "list" | "board" | "calendar";

export function parseTaskView(value: string | undefined): TaskView {
  return value === "list" || value === "calendar" ? value : "board";
}

const VIEWS: Array<{ value: TaskView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "list", label: "List", icon: LayoutList },
  { value: "board", label: "Board", icon: Columns3 },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
];

// The view lives in the URL rather than component state, so a particular
// view is linkable and survives a reload without any client-side storage.
export function TaskViewSwitcher({ projectId, current }: { projectId: string; current: TaskView }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[8px] bg-hover p-0.5">
      {VIEWS.map(({ value, label, icon: Icon }) => {
        const active = value === current;
        return (
          <Link
            key={value}
            href={`/projects/${projectId}/tasks?view=${value}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors",
              active ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
