"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Check, Clock, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { completeTask } from "@/app/(dashboard)/todo/actions";
import { bucketFor, formatDueDate, todayKey } from "@/lib/todo/buckets";
import { formatMinutes } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import type { TaskPriority, TaskStatus } from "@/types/database.types";

const PRIORITY_VARIANT = {
  low: "default",
  medium: "info",
  high: "warning",
  urgent: "danger",
} as const;

// Same borderless row as the Today view: circle checkbox, title, meta on the
// right, one hairline separator underneath.
export function TaskListRow({
  projectId,
  task,
  assigneeNames,
  loggedMinutes,
  commentCount,
  isTimerRunning,
  canComplete,
}: {
  projectId: string;
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
  };
  assigneeNames: string[];
  loggedMinutes: number;
  commentCount: number;
  isTimerRunning: boolean;
  canComplete: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const done = task.status === "done";
  const today = todayKey();
  const overdue = !done && bucketFor(task.due_date, today) === "overdue";
  const dueToday = !done && bucketFor(task.due_date, today) === "today";

  const toggle = () =>
    startTransition(async () => {
      try {
        await completeTask(task.id, !done);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  return (
    <div className="group flex items-center gap-3 border-b border-border-soft py-2.5">
      <button
        type="button"
        disabled={isPending || !canComplete}
        onClick={toggle}
        aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-ink-muted bg-ink-muted text-white"
            : "border-checkbox text-transparent hover:border-ink-muted hover:text-ink-muted",
          !canComplete && "cursor-default opacity-60"
        )}
      >
        <Check className="h-3 w-3" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/projects/${projectId}/tasks/${task.id}`}
          className={cn("truncate text-[14px] hover:underline", done ? "text-ink-faint line-through" : "text-ink")}
        >
          {task.title}
        </Link>
        <span className="flex items-center gap-2 text-[12px] text-ink-faint">
          {assigneeNames.length === 0
            ? "Unassigned"
            : assigneeNames.length > 2
              ? `${assigneeNames[0]} +${assigneeNames.length - 1}`
              : assigneeNames.join(", ")}
          {loggedMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatMinutes(loggedMinutes)}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </span>
          )}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isTimerRunning && <Badge variant="success">running</Badge>}
        <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
        {task.due_date && (
          <span
            className={cn(
              "text-[12px]",
              overdue ? "font-medium text-accent" : dueToday ? "font-medium text-ink" : "text-ink-muted"
            )}
          >
            {formatDueDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}
