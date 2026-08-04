"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { toggleTaskAssignee } from "@/app/(dashboard)/projects/[projectId]/tasks/actions";
import { initialsOf } from "@/lib/utils/initials";
import { cn } from "@/lib/utils/cn";
import { SidebarRow } from "./SidebarRow";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={name}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-avatar text-[10px] font-semibold text-white",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

// A task can have several assignees, so this is a checkbox list rather than
// a Select — a single-choice control can't express "Priya and Rahul", and
// each tick is its own small server call.
export function AssigneeField({
  projectId,
  taskId,
  assigneeIds,
  options,
  editable,
}: {
  projectId: string;
  taskId: string;
  assigneeIds: string[];
  options: Array<{ id: string; full_name: string }>;
  editable: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(assigneeIds);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep in step when the server sends a fresh list (e.g. after a move).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with a server-provided prop
    setSelected(assigneeIds);
  }, [assigneeIds]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const names = selected
    .map((id) => options.find((o) => o.id === id)?.full_name)
    .filter((name): name is string => !!name);

  if (!editable) {
    return (
      <SidebarRow label={selected.length > 1 ? "Assignees" : "Assignee"}>
        {names.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {names.map((name) => (
              <span key={name} className="flex items-center gap-1.5">
                <Avatar name={name} />
                <span className="text-[14px] text-ink">{name}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-[14px] text-ink-faint">Unassigned</span>
        )}
      </SidebarRow>
    );
  }

  const toggle = (userId: string) => {
    const assigned = !selected.includes(userId);
    setSelected((prev) => (assigned ? [...prev, userId] : prev.filter((id) => id !== userId)));
    startTransition(async () => {
      try {
        await toggleTaskAssignee(projectId, taskId, userId, assigned);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Failed to update assignees");
        setSelected(assigneeIds);
      }
    });
  };

  return (
    <SidebarRow label={selected.length > 1 ? "Assignees" : "Assignee"}>
      <div ref={rootRef} className="relative w-full">
        <button
          type="button"
          disabled={isPending}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-8 w-full items-center justify-between gap-2 rounded-[5px] border border-transparent px-1.5 text-left text-[14px] text-ink hover:border-border hover:bg-hover-soft"
        >
          {names.length > 0 ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="flex -space-x-1.5">
                {names.slice(0, 3).map((name) => (
                  <Avatar key={name} name={name} className="ring-1 ring-white" />
                ))}
              </span>
              <span className="truncate">
                {names.length === 1 ? names[0] : `${names.length} people`}
              </span>
            </span>
          ) : (
            <span className="text-ink-faint">Unassigned</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-full min-w-[200px] overflow-y-auto rounded-[8px] border border-border bg-white p-1 shadow-md">
            {options.length === 0 && (
              <p className="px-2 py-1.5 text-[13px] text-ink-muted">No team members on this project.</p>
            )}
            {options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className="flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-[14px] text-ink hover:bg-hover"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border",
                      checked ? "border-primary bg-primary text-white" : "border-checkbox text-transparent"
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <Avatar name={option.full_name} />
                  <span className="truncate">{option.full_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </SidebarRow>
  );
}
