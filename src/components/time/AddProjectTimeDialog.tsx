"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { logProjectTime, type FormState } from "@/app/(dashboard)/projects/[projectId]/time-actions";

const initialState: FormState = { error: null };

/** Today in the viewer's own timezone — `toISOString()` would give UTC's day. */
function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const GENERAL = "general";

// Adding a day's work straight from the timesheet, without opening the task
// it belongs to. The task is optional — time_entries.task_id is nullable, and
// "general project work" is a real category (a client call, a planning hour).
export function AddProjectTimeDialog({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState(GENERAL);
  const [result, setResult] = useState<FormState | null>(null);
  const [isPending, startTransition] = useTransition();
  const { formRef, formError, field, errorProps } = useFieldErrors(result);

  // The action is awaited inside a transition rather than driven by
  // useActionState, so closing on success is part of the submit itself
  // instead of an effect that has to watch for the state settling.
  const submit = (formData: FormData) => {
    startTransition(async () => {
      const next = await logProjectTime(projectId, initialState, formData);
      setResult(next);
      if (next.error) return;
      setTaskId(GENERAL);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          Add time
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add time</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={submit} noValidate className="flex flex-col gap-4">
          {/* Radix's Select is not a native control, so the chosen task rides
              along in a hidden input for the form to submit. */}
          <input type="hidden" name="task_id" value={taskId === GENERAL ? "" : taskId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label required htmlFor="time-date">
                Date worked
              </Label>
              <Input
                id="time-date"
                name="date"
                type="date"
                required
                defaultValue={todayLocal()}
                {...field("date")}
              />
              <FieldError {...errorProps("date")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label required htmlFor="time-hours">
                Hours
              </Label>
              <Input
                id="time-hours"
                name="hours"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                required
                placeholder="2.5"
                {...field("hours")}
              />
              <FieldError {...errorProps("hours")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Task</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL}>General project work</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="time-note">Note</Label>
            <Input id="time-note" name="description" placeholder="What did you work on? (optional)" />
          </div>

          <FormError error={formError} />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add time"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
