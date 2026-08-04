"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { createPersonalTodo, type FormState } from "@/app/(dashboard)/todo/actions";
import { todayKey } from "@/lib/todo/buckets";

const initialState: FormState = { error: null };

// Todoist-style inline add: a quiet "+ Add task" row that expands into a
// form in place. Stays open after a successful add (Todoist behaviour, for
// entering several items in a row) — only Cancel closes it.
export function InlineAddTask() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createPersonalTodo, initialState);
  const titleRef = useRef<HTMLInputElement>(null);
  const { formRef, formError, field, errorProps, resetForm, dismissAll } = useFieldErrors(state);

  useEffect(() => {
    if (state.success) {
      resetForm();
      titleRef.current?.focus();
    }
  }, [state.success, resetForm]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 py-2.5 text-[14px] text-ink-muted hover:text-primary"
      >
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full group-hover:bg-primary">
          <Plus className="h-4 w-4 text-primary group-hover:text-white" />
        </span>
        Add task
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="mt-2 flex flex-col gap-3 rounded-[10px] border border-border p-3"
    >
      <input
        ref={titleRef}
        name="title"
        required
        autoFocus
        placeholder="Task name"
        className="w-full text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
        aria-label="Task name"
        {...field("title")}
      />
      <FieldError {...errorProps("title")} />
      <div className="flex items-center justify-between gap-2">
        <Input name="due_date" type="date" defaultValue={todayKey()} className="h-8 w-36 text-[13px]" aria-label="Due date" />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => {
              setOpen(false);
              dismissAll();
            }}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending} className="bg-primary hover:bg-primary-hover">
            {isPending ? "Adding…" : "Add task"}
          </Button>
        </div>
      </div>
      <FormError error={formError} />
    </form>
  );
}
