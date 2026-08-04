"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { logTimeOnTask, type FormState } from "@/app/(dashboard)/projects/[projectId]/time-actions";

const initialState: FormState = { error: null };

/** Today in the viewer's own timezone — `toISOString()` would give UTC's day. */
function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Manual entry for work already done: pick the day, type the hours. A task
// that took a week is logged as one row per day, the way a work diary reads.
// The form only mounts once opened, so the "today" default is computed on the
// client and can't disagree with a server render.
export function AddTimeForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [open, setOpen] = useState(false);
  const logWithIds = logTimeOnTask.bind(null, projectId, taskId);
  const [state, formAction, isPending] = useActionState(logWithIds, initialState);
  const { formRef, formError, field, errorProps, resetForm, dismissAll } = useFieldErrors(state);

  useEffect(() => {
    if (!isPending && state.error === null) resetForm();
  }, [isPending, state.error, resetForm]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 py-1 text-[13px] text-ink-muted hover:text-accent"
      >
        <Plus className="h-3.5 w-3.5" />
        Add time
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Input
            name="date"
            type="date"
            required
            defaultValue={todayLocal()}
            className="h-8 px-2 text-[13px]"
            aria-label="Date worked"
            {...field("date")}
          />
          <FieldError {...errorProps("date")} />
        </div>
        <div className="flex w-16 flex-col gap-1">
          <Input
            name="hours"
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            required
            placeholder="2.5"
            className="h-8 px-2 text-[13px]"
            aria-label="Hours worked"
            {...field("hours")}
          />
          <FieldError {...errorProps("hours")} />
        </div>
      </div>
      <Input
        name="description"
        placeholder="Note (optional)"
        className="h-8 px-2 text-[13px]"
        aria-label="Note"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => {
            setOpen(false);
            dismissAll();
          }}>
          Cancel
        </Button>
      </div>
      <FormError error={formError} className="text-[12px] text-accent" />
    </form>
  );
}
