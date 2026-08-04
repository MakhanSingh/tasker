"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addSubtask,
  deleteSubtask,
  toggleSubtask,
} from "@/app/(dashboard)/projects/[projectId]/tasks/[taskId]/actions";
import { cn } from "@/lib/utils/cn";

export type SubtaskRow = { id: string; title: string; is_done: boolean };

// The checklist inside a task card — same circle-checkbox language as the
// Today list, with an inline add row like Todoist's "Add sub-task".
export function SubtaskSection({
  projectId,
  taskId,
  subtasks,
  canToggle,
  canManage,
}: {
  projectId: string;
  taskId: string;
  subtasks: SubtaskRow[];
  canToggle: boolean;
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const done = subtasks.filter((s) => s.is_done).length;

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  const submitNew = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    run(async () => {
      await addSubtask(projectId, taskId, trimmed);
      setTitle("");
    });
  };

  if (subtasks.length === 0 && !canManage) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Sub-tasks{" "}
        {subtasks.length > 0 && (
          <span className="font-normal normal-case text-ink-faint">
            {done}/{subtasks.length}
          </span>
        )}
      </h3>

      {subtasks.length > 0 && (
        <div className="h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-hover">
          <div
            className="h-full rounded-full bg-success transition-[width]"
            style={{ width: `${subtasks.length ? Math.round((done / subtasks.length) * 100) : 0}%` }}
          />
        </div>
      )}

      <div className="flex flex-col">
        {subtasks.map((subtask) => (
          <div key={subtask.id} className="group/subtask flex items-center gap-3 border-b border-border-soft py-2">
            <button
              type="button"
              disabled={isPending || !canToggle}
              onClick={() => run(() => toggleSubtask(projectId, taskId, subtask.id, !subtask.is_done))}
              aria-label={subtask.is_done ? `Mark "${subtask.title}" not done` : `Mark "${subtask.title}" done`}
              className={cn(
                "flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border",
                subtask.is_done
                  ? "border-ink-muted bg-ink-muted text-white"
                  : "border-checkbox text-transparent hover:border-ink-muted hover:text-ink-muted",
                !canToggle && "cursor-default opacity-60"
              )}
            >
              <Check className="h-2.5 w-2.5" />
            </button>
            <span
              className={cn(
                "flex-1 text-[14px]",
                subtask.is_done ? "text-ink-faint line-through" : "text-ink"
              )}
            >
              {subtask.title}
            </span>
            {canManage && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => deleteSubtask(projectId, taskId, subtask.id))}
                aria-label={`Delete "${subtask.title}"`}
                className="opacity-0 transition-opacity group-hover/subtask:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-ink-faint hover:text-danger" />
              </button>
            )}
          </div>
        ))}
      </div>

      {canManage &&
        (adding ? (
          <div className="flex items-center gap-2">
            <input
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Sub-task title"
              className="h-8 flex-1 rounded-[5px] border border-border px-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-ink-faint focus:outline-none focus:ring-1 focus:ring-focus"
            />
            <Button type="button" size="sm" disabled={isPending || !title.trim()} onClick={submitNew}>
              Add
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)} aria-label="Cancel">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="group flex items-center gap-2 self-start py-1 text-[13px] text-ink-muted hover:text-primary"
          >
            <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full group-hover:bg-primary">
              <Plus className="h-3.5 w-3.5 text-primary group-hover:text-white" />
            </span>
            Add sub-task
          </button>
        ))}
    </section>
  );
}
