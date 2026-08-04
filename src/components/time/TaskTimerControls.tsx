"use client";

import { useTransition } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/hooks/useTimer";
import { formatElapsed } from "@/lib/utils/time";
import { startTimer, stopTimer } from "@/app/(dashboard)/projects/[projectId]/time-actions";

export function TaskTimerControls({
  projectId,
  taskId,
  runningEntry,
}: {
  projectId: string;
  taskId: string;
  // The user's single running timer, wherever it happens to be — a timer
  // running on another task still has to be surfaced here, because starting
  // a second one is refused at the database level.
  runningEntry: { id: string; project_id: string; task_id: string | null; started_at: string; label: string } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const elapsed = useTimer(runningEntry?.started_at ?? null);
  const runningOnThisTask = runningEntry?.task_id === taskId;

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  if (runningOnThisTask && runningEntry) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-success-border bg-success-bg px-3 py-2">
        {/* Ticks off Date.now(), so the server-rendered second can differ
            from the client's first paint — harmless, corrected every tick. */}
        <span suppressHydrationWarning className="font-mono text-sm font-medium text-success">
          {formatElapsed(elapsed)}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run(() => stopTimer(runningEntry.id, runningEntry.project_id))}
        >
          <Square className="h-3 w-3" />
          Stop
        </Button>
      </div>
    );
  }

  if (runningEntry) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-sm">
        <span className="text-warning">
          Timer running on <span className="font-medium">{runningEntry.label}</span>
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run(() => stopTimer(runningEntry.id, runningEntry.project_id))}
        >
          Stop it
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => run(() => startTimer(projectId, taskId))}
    >
      <Play className="h-3 w-3" />
      Start timer
    </Button>
  );
}
