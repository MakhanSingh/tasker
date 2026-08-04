"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CalendarDays, Check, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/hooks/useTimer";
import { formatElapsed } from "@/lib/utils/time";
import { formatDueDate } from "@/lib/todo/buckets";
import { completeTask } from "@/app/(dashboard)/todo/actions";
import { startTimer, stopTimer } from "@/app/(dashboard)/projects/[projectId]/time-actions";

export function TodoTaskRow({
  task,
  projectName,
  isOverdue,
  runningEntry,
}: {
  task: {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
  };
  projectName: string;
  isOverdue: boolean;
  // The user's one running timer, wherever it is — needed here to know
  // whether this row's timer is the live one.
  runningEntry: { id: string; project_id: string; task_id: string | null; started_at: string } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const runningHere = runningEntry != null && runningEntry.task_id === task.id;
  const elapsed = useTimer(runningHere ? runningEntry.started_at : null);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  return (
    <div className="group flex items-start gap-3 border-b border-border-soft py-2.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => completeTask(task.id, true))}
        aria-label={`Mark "${task.title}" done`}
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-checkbox text-transparent hover:border-ink-muted hover:text-ink-muted"
      >
        <Check className="h-3 w-3" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={`/projects/${task.project_id}/tasks/${task.id}`} className="text-[14px] text-ink hover:underline">
          {task.title}
        </Link>
        {task.description && <p className="truncate text-[12px] text-ink-muted">{task.description}</p>}
        {isOverdue && task.due_date && (
          <span className="flex items-center gap-1 text-[12px] text-accent">
            <CalendarDays className="h-3 w-3" />
            {formatDueDate(task.due_date)}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {runningHere ? (
          <span className="flex items-center gap-2 rounded-md border border-success-border bg-success-bg px-2 py-0.5">
            {/* Ticks off Date.now(), so the server-rendered second can differ
                from the client's first paint — harmless, corrected every tick. */}
            <span suppressHydrationWarning className="font-mono text-xs font-medium text-success">
              {formatElapsed(elapsed)}
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => stopTimer(runningEntry.id, runningEntry.project_id))}
              className="text-success hover:text-success/80"
              aria-label="Stop timer"
            >
              <Square className="h-3 w-3" />
            </button>
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => run(() => startTimer(task.project_id, task.id))}
            aria-label={`Start timer on ${task.title}`}
            className="h-6 px-1.5 opacity-0 group-hover:opacity-100"
          >
            <Play className="h-3 w-3 text-ink-muted" />
          </Button>
        )}
        <span className="text-[12px] text-ink-muted">{projectName}</span>
      </div>
    </div>
  );
}
