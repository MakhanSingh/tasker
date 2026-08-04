"use client";

import { forwardRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, X } from "lucide-react";
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
import { FieldError, FormError } from "@/components/ui/field-error";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createClientTask,
  createTask,
  type FormState,
} from "@/app/(dashboard)/projects/[projectId]/tasks/actions";
import { FileDropzone } from "@/components/files/FileDropzone";
import { uploadFiles } from "@/lib/files/uploadClient";

type Project = { id: string; name: string };

/**
 * The one dialog for creating a task, in two shapes.
 *
 * A client's version drops the assignee list — they can't see the team
 * roster, let alone allocate it — and its wording says "request", because
 * that's what it is. Everything else, attachments included, is identical:
 * two dialogs would have drifted, and the first thing the client's copy lost
 * when it was separate was the ability to paste a screenshot.
 *
 * With `projects` instead of a `projectId` it also carries a project picker,
 * which is what the sidebar's quick-add needs.
 */
export function NewTaskDialog({
  projectId,
  projects,
  assignees = [],
  variant = "team",
  trigger,
}: {
  /** Fixed project, when opened from that project's board. */
  projectId?: string;
  /** Or a picker, when opened from the sidebar with no project in context. */
  projects?: Project[];
  assignees?: Array<{ id: string; full_name: string }>;
  variant?: "team" | "client";
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const isClient = variant === "client";

  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState("medium");
  const [selectedProject, setSelectedProject] = useState(projectId ?? projects?.[0]?.id ?? "");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // One state for the whole action result: its identity is what tells
  // useFieldErrors a new verdict has arrived.
  const [result, setResult] = useState<FormState | null>(null);
  const [isPending, startTransition] = useTransition();
  const { formRef, formError, field, errorProps, errors: fieldErrors, clear } = useFieldErrors(result);

  const targetProject = projectId ?? selectedProject;

  const reset = () => {
    setPendingFiles([]);
    setPriority("medium");
    setResult(null);
  };

  // Awaiting the action inside a transition, rather than reacting to
  // useActionState settling, keeps "create the task, then upload against it,
  // then close" as one readable sequence.
  const submit = (formData: FormData) => {
    if (!targetProject) {
      setResult({ error: "Pick a project first", fieldErrors: { project: "Pick a project first" } });
      return;
    }
    startTransition(async () => {
      const outcome = isClient
        ? await createClientTask(targetProject, { error: null }, formData)
        : await createTask(targetProject, { error: null }, formData);

      if (outcome.error || !outcome.taskId) {
        setResult({ ...outcome, error: outcome.error ?? "Failed to create task" });
        return;
      }

      // Files ride behind the task rather than blocking its creation, so a
      // failed upload leaves the task standing and says so.
      if (pendingFiles.length > 0) {
        const uploadError = await uploadFiles({
          projectId: targetProject,
          taskId: outcome.taskId,
          files: pendingFiles,
        });
        if (uploadError) window.alert(`Task created, but an attachment failed: ${uploadError}`);
      }

      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button>{isClient ? "Request a task" : "New task"}</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isClient ? "Request a task" : "New task"}</DialogTitle>
        </DialogHeader>

        <FileDropzone onFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}>
          <form ref={formRef} action={submit} noValidate className="flex flex-col gap-4">
            <input type="hidden" name="priority" value={priority} />

            {projects && projects.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label required>Project</Label>
                <Select
                  value={selectedProject}
                  onValueChange={(value) => {
                    setSelectedProject(value);
                    clear("project");
                  }}
                >
                  <SelectTrigger aria-invalid={!!fieldErrors.project || undefined}>
                    <SelectValue placeholder="Pick a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError {...errorProps("project")} />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label required htmlFor="title">
                {isClient ? "What do you need?" : "Title"}
              </Label>
              <Input
                id="title"
                name="title"
                required
                autoFocus
                placeholder={isClient ? "Swap the homepage banner for the sale creative" : undefined}
                {...field("title")}
              />
              <FieldError {...errorProps("title")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">{isClient ? "Details" : "Description"}</Label>
              <Input
                id="description"
                name="description"
                placeholder={isClient ? "Anything that helps us get it right first time." : undefined}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="due_date">{isClient ? "Needed by" : "Due date"}</Label>
                <Input id="due_date" name="due_date" type="date" />
              </div>
            </div>

            {!isClient && (
              <div className="flex flex-col gap-1.5">
                <Label>Assignees</Label>
                {/* Native checkboxes named assignee_ids — the server action
                    reads them with formData.getAll, so several people can be
                    picked with no hidden-input bookkeeping. */}
                <div className="flex max-h-36 flex-col gap-0.5 overflow-y-auto rounded-[8px] border border-border p-1.5">
                  {assignees.length === 0 && (
                    <p className="px-1 py-0.5 text-[13px] text-ink-muted">No team members on this project yet.</p>
                  )}
                  {assignees.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2 rounded-[5px] px-1.5 py-1 text-[14px] text-ink hover:bg-hover"
                    >
                      <input type="checkbox" name="assignee_ids" value={a.id} className="h-4 w-4" />
                      {a.full_name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Attachments</Label>
              <FileDropzone
                onFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
                clickToBrowse
                className="flex items-center gap-2 border border-dashed border-border px-3 py-2.5 text-[13px] text-ink-muted hover:border-ink-faint hover:text-ink"
              >
                <ImagePlus className="h-4 w-4 shrink-0 text-ink-faint" />
                Drop a screenshot anywhere in this dialog, paste one, or click to browse
              </FileDropzone>

              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pendingFiles.map((file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                      className="inline-flex items-center gap-1.5 rounded-[5px] bg-hover px-2 py-1 text-[12px] text-ink-secondary"
                    >
                      {file.name}
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                        className="text-ink-faint hover:text-danger"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {isClient && (
              <p className="text-[12px] text-ink-muted">
                This lands in the team&apos;s To do — they&apos;ll pick it up and keep you posted here.
              </p>
            )}

            <FormError error={formError} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : isClient ? "Add task" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </FileDropzone>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The sidebar's red "+ Add task" row, as a dialog trigger.
 *
 * forwardRef and the props spread are load-bearing: Radix's `asChild` clones
 * its onClick and ref onto this element, and a plain component that ignored
 * them would render a button that looks right and does nothing.
 */
export const SidebarAddTaskTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SidebarAddTaskTrigger(props, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className="mb-3 flex w-full items-center gap-2 rounded-[5px] px-1 py-1.5 font-medium text-primary hover:bg-hover"
    >
      <span className="flex h-[21px] w-[21px] items-center justify-center rounded-full bg-primary">
        <Plus className="h-3.5 w-3.5 text-white" />
      </span>
      Add task
    </button>
  );
});
