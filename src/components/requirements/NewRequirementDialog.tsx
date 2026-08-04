"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { createRequirement, type FormState } from "@/app/(dashboard)/projects/[projectId]/requirements/actions";
import { PRIORITY_LABEL } from "@/lib/requirements/labels";

const initialState: FormState = { error: null };

export function NewRequirementDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const createWithProject = createRequirement.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(createWithProject, initialState);
  const { formRef, formError, field, errorProps, dismissAll } = useFieldErrors(state);

  useEffect(() => {
    // Closing the dialog here reacts to the server action's result, not
    // locally-derivable render state — a legitimate effect, not a smell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The action state lives out here, so without this the next open
        // would show last time's error over freshly blank fields.
        if (!next) dismissAll();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Add requirement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New requirement</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label required htmlFor="req-title">
              Title
            </Label>
            <Input id="req-title" name="title" required placeholder="Customer can check out as a guest" {...field("title")} />
            <FieldError {...errorProps("title")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req-description">Description</Label>
            <textarea
              id="req-description"
              name="description"
              rows={3}
              className="rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-focus aria-invalid:border-accent"
              placeholder="What exactly is in scope, and what isn't?"
              {...field("description")}
            />
            <FieldError {...errorProps("description")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="req-priority">Priority</Label>
            <select
              id="req-priority"
              name="priority"
              defaultValue="must_have"
              className="h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-focus"
            >
              {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" name="is_client_visible" value="true" defaultChecked className="h-4 w-4" />
            Visible to client (they can sign off on it)
          </label>
          <FormError error={formError} />
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add requirement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
