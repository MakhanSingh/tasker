"use client";

import { useTransition } from "react";
import { CalendarDays, Check, Trash2 } from "lucide-react";
import { formatDueDate } from "@/lib/todo/buckets";
import { deletePersonalTodo, togglePersonalTodo } from "@/app/(dashboard)/todo/actions";
import { cn } from "@/lib/utils/cn";

export function PersonalTodoRow({
  todo,
  isOverdue,
}: {
  todo: { id: string; title: string; due_date: string | null; is_done: boolean };
  isOverdue: boolean;
}) {
  const [isPending, startTransition] = useTransition();

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
        onClick={() => run(() => togglePersonalTodo(todo.id, !todo.is_done))}
        aria-label={todo.is_done ? `Mark "${todo.title}" not done` : `Mark "${todo.title}" done`}
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
          todo.is_done
            ? "border-ink-muted bg-ink-muted text-white"
            : "border-checkbox text-transparent hover:border-ink-muted hover:text-ink-muted"
        )}
      >
        <Check className="h-3 w-3" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-[14px]", todo.is_done ? "text-checkbox line-through" : "text-ink")}>
          {todo.title}
        </span>
        {!todo.is_done && isOverdue && todo.due_date && (
          <span className="flex items-center gap-1 text-[12px] text-accent">
            <CalendarDays className="h-3 w-3" />
            {formatDueDate(todo.due_date)}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => deletePersonalTodo(todo.id))}
          aria-label={`Delete "${todo.title}"`}
          className="opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-accent" />
        </button>
        <span className="text-[12px] text-ink-muted">Personal</span>
      </div>
    </div>
  );
}
