"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import {
  createMilestone,
  deleteMilestone,
  updateMilestoneStatus,
  type FormState,
} from "@/app/(dashboard)/projects/actions";
import { MILESTONE_STATUS_LABEL, type MilestoneView } from "@/lib/projects/billingTypes";
import type { MilestoneStatus } from "@/types/database.types";

const STATUSES: MilestoneStatus[] = ["pending", "in_progress", "completed"];

// The admin's controls over a fixed-budget project's milestones. The client
// sees the same list through ProjectPayments, read-only — this component is
// never rendered for them, and project_milestones' RLS refuses the writes
// regardless of what reaches the action.
export function MilestoneManager({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: MilestoneView[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  // One state for the whole action result: its identity is what tells
  // useFieldErrors a new verdict has arrived.
  const [result, setResult] = useState<FormState | null>(null);
  const [isPending, startTransition] = useTransition();
  const { formRef, formError, field, errorProps } = useFieldErrors(result);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const next = await createMilestone(projectId, { error: null }, formData);
      setResult(next);
      if (next.error) return;
      setAdding(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border-soft px-4 py-3">
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-1">
          {milestones.map((milestone) => (
            <li key={milestone.id} className="flex items-center gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-ink-muted">{milestone.title}</span>
              <Select
                value={milestone.status}
                onValueChange={(value) =>
                  run(() => updateMilestoneStatus(projectId, milestone.id, value))
                }
              >
                <SelectTrigger className="h-7 w-36 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {MILESTONE_STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                aria-label={`Delete ${milestone.title}`}
                disabled={isPending}
                onClick={() => run(() => deleteMilestone(projectId, milestone.id))}
                className="rounded p-1 text-ink-faint hover:text-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form ref={formRef} action={submit} noValidate className="flex flex-col gap-2 rounded-[6px] bg-hover-soft p-3">
          <div className="flex flex-col gap-1.5">
            <Label required htmlFor="milestone-title">
              Title
            </Label>
            <Input
              id="milestone-title"
              name="title"
              required
              autoFocus
              placeholder="Design sign-off"
              {...field("title")}
            />
            <FieldError {...errorProps("title")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="milestone-amount">Amount (USD)</Label>
              <Input id="milestone-amount" name="amount" type="number" min="0" step="0.01" placeholder="1500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="milestone-due">Due date</Label>
              <Input id="milestone-due" name="due_date" type="date" />
            </div>
          </div>
          <FormError error={formError} className="text-[12px] text-accent" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Adding…" : "Add milestone"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => {
                setAdding(false);
                setResult(null);
              }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 py-1 text-[13px] text-ink-muted hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          Add milestone
        </button>
      )}
    </div>
  );
}
